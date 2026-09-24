import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from app.schemas import ChatRequest, ChatResultResponse, TraceEntry, ToolCallRecord
from app.graph.supervisor import app_graph

app = FastAPI(title="DevFlow AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root and v1 health checks
@app.get("/health")
@app.get("/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-service",
        "llm": {
            "enabled": True,
            "model": os.getenv("OPENAI_MODEL", "gpt-4o")
        }
    }

v1_router = APIRouter(prefix="/v1")

def parse_chat_response(result: dict, user_prompt: str) -> ChatResultResponse:
    messages = result.get("messages", [])
    last_text = messages[-1].content if messages else "No response generated."
    
    trace_list: list[TraceEntry] = []
    tool_calls_detected: list[ToolCallRecord] = []
    
    for msg in messages:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                tool_calls_detected.append(
                    ToolCallRecord(tool=tc.get("name", "tool"), args=tc.get("args", {}), result=None)
                )
        elif isinstance(msg, ToolMessage) and tool_calls_detected:
            tool_calls_detected[-1].result = msg.content

    active_route = result.get("next_node") or "UserAgent"
    trace_list.append(
        TraceEntry(
            agent=active_route,
            reason=f"Processed user intent for: '{user_prompt[:40]}...'",
            toolCalls=tool_calls_detected
        )
    )

    text_lower = last_text.lower()
    missing_fields: list[str] = []
    action_type = "none"
    requires_confirmation = False
    status = "completed"

    if "following information is required:" in text_lower or "information is required" in text_lower:
        status = "requires_action"
        action_type = "missing_info"
        if "role" in text_lower:
            missing_fields.append("role")
        if "email" in text_lower:
            missing_fields.append("email")
        if "name" in text_lower:
            missing_fields.append("name")
    elif "are you sure you want to delete" in text_lower:
        status = "requires_action"
        action_type = "confirmation"
        requires_confirmation = True

    return ChatResultResponse(
        answer=last_text,
        route=active_route,
        source="langgraph",
        llm=True,
        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        engine="langgraph-supervisor",
        trace=trace_list,
        contexts=[],
        status=status,
        action_type=action_type,
        missing_fields=missing_fields if missing_fields else None,
        requires_confirmation=requires_confirmation,
    )

@v1_router.post("/chat", response_model=ChatResultResponse)
async def chat_endpoint(req: ChatRequest):
    user_prompt = req.get_text()
    inputs = {"messages": [HumanMessage(content=user_prompt)]}
    config = {"configurable": {"thread_id": req.thread_id or "default"}}

    result = await app_graph.ainvoke(inputs, config=config)
    return parse_chat_response(result, user_prompt)

app.include_router(v1_router)