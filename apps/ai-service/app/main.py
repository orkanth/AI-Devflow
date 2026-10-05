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
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        }
    }

v1_router = APIRouter(prefix="/v1")
 
# apps/ai-service/app/main.py
def parse_chat_response(result: dict, user_prompt: str) -> ChatResultResponse:
    messages = result.get("messages", [])
    
    # 1. Safely retrieve the final assistant answer
    last_text = "No response generated."
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, str) and content.strip():
            last_text = content
            break
        elif isinstance(msg, dict) and msg.get("content"):
            last_text = msg["content"]
            break

    text_lower = last_text.lower()

    # 2. Extract State Values (with fallbacks)
    active_agent = result.get("next_node") or "UserAgent"
    status = result.get("status", "completed")
    action_type = result.get("action_type") or "none"
    crud_payload: Optional[Dict[str, Any]] = result.get("crud_payload")
    missing_fields: List[str] = result.get("missing_fields") or []
    requires_confirmation = result.get("requires_confirmation", False)

    # 3. Inspect messages for executed tool calls and payloads
    executed_tool_calls: List[Dict[str, Any]] = []
    for msg in messages:
        # LangChain AIMessages store tool calls
        tool_calls = getattr(msg, "tool_calls", None)
        if tool_calls:
            for tc in tool_calls:
                name = tc.get("name", "")
                args = tc.get("args", {})
                executed_tool_calls.append({"name": name, "args": args})

                # If crud_payload wasn't explicitly set in state, extract it from the tool call
                if not crud_payload and name in {
                    "create_project_tool",
                    "create_user_tool",
                    "update_user_tool",
                    "delete_user_tool",
                    "create_task_tool",
                }:
                    crud_payload = args
                    if action_type == "none":
                        action_type = name.replace("_tool", "")

    # 4. Fallback heuristics for status & confirmation if not handled by node
    if "already exists" in text_lower or "conflict" in text_lower:
        status = "error"
        action_type = "duplicate"
    elif "are you sure you want to delete" in text_lower:
        status = "requires_action"
        action_type = "confirmation"
        requires_confirmation = True
    elif "information is required" in text_lower or "following information" in text_lower:
        status = "requires_action"
        action_type = "missing_info"
        for field in ["name", "email", "role", "description"]:
            if field in text_lower and field not in missing_fields:
                missing_fields.append(field)

    # 5. Build trace entry
    trace_list = [
        TraceEntry(
            agent=active_agent,
            reason=f"Processed user intent for: '{user_prompt[:40]}...'",
            toolCalls=executed_tool_calls,
        )
    ]

    return ChatResultResponse(
        answer=last_text,
        route=active_agent,
        source="langgraph",
        llm=True,
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        engine="langgraph-supervisor",
        trace=trace_list,
        contexts=[],
        status=status,
        action_type=action_type,
        crud_payload=crud_payload,
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