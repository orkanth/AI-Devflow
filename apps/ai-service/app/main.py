import os
from typing import List
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
            "model": os.getenv("OPENAI_MODEL", "gpt-5.6-luna")
        }
    }

v1_router = APIRouter(prefix="/v1")
 
# apps/ai-service/app/main.py

def parse_chat_response(
    result: dict,
    user_prompt: str,
) -> ChatResultResponse:

    messages = result.get("messages", [])

    # ---------------------------------------------------------
    # 1. Final assistant response
    # ---------------------------------------------------------
    last_text = "No response generated."

    for msg in reversed(messages):
        content = getattr(msg, "content", "")

        if isinstance(content, str) and content.strip():
            last_text = content
            break

        if isinstance(msg, dict) and msg.get("content"):
            last_text = msg["content"]
            break

    text_lower = last_text.lower()

    # ---------------------------------------------------------
    # 2. State values
    # ---------------------------------------------------------
    active_agent = result.get("next_node") or "UserAgent"
    status = result.get("status", "completed")

    action_type = result.get("action_type") or "none"

    crud_payload: Optional[Dict[str, Any]] = result.get(
        "crud_payload"
    )

    missing_fields: List[str] = (
        result.get("missing_fields") or []
    )

    requires_confirmation = result.get(
        "requires_confirmation",
        False,
    )

    # ---------------------------------------------------------
    # 3. Extract actual LangChain tool calls
    # ---------------------------------------------------------
    executed_tool_calls: List[ToolCallRecord] = []

    action_map = {
        "create_task_tool": "create_task",
        "update_task_tool": "update_task",
        "delete_task_tool": "delete_task",
        "lookup_task_tool": "lookup_task",
        "reassign_user_tasks_tool": "reassign_tasks",
        "list_tasks_by_user_tool": "list_tasks",
        "lookup_user_tool": "lookup_user",

        "create_project_tool": "create_project",
        "update_project_tool": "update_project",
        "delete_project_tool": "delete_project",

        "create_user_tool": "create_user",
        "update_user_tool": "update_user",
        "delete_user_tool": "delete_user",
    }

    for msg in messages:

        tool_calls = getattr(msg, "tool_calls", None)

        if not tool_calls:
            continue

        for tc in tool_calls:

            name = tc.get("name", "")
            args = tc.get("args", {})

            # IMPORTANT:
            # ToolCallRecord expects "tool", not "name"
            executed_tool_calls.append(
                ToolCallRecord(
                    tool=name,
                    args=args,
                )
            )

            # Extract CRUD payload
            if crud_payload is None:
                crud_payload = args

            # Extract action type
            if name in action_map:
                action_type = action_map[name]

    # ---------------------------------------------------------
    # 4. Fallback status / confirmation rules
    # ---------------------------------------------------------
    if "already exists" in text_lower or "conflict" in text_lower:
        status = "error"
        action_type = "duplicate"

    elif (
        "are you sure you want to permanently delete task"
        in text_lower
        or "are you sure you want to delete"
        in text_lower
    ):
        status = "requires_action"
        action_type = "confirmation"
        requires_confirmation = True

    elif (
        "information is required" in text_lower
        or "following information" in text_lower
    ):
        status = "requires_action"
        action_type = "missing_info"

        for field in [
            "name",
            "email",
            "role",
            "title",
            "project_identifier",
            "description",
        ]:
            if field in text_lower and field not in missing_fields:
                missing_fields.append(field)

    # ---------------------------------------------------------
    # 5. Trace
    # ---------------------------------------------------------
    trace_list = [
        TraceEntry(
            agent=active_agent,
            reason=(
                f"Processed user intent for: "
                f"'{user_prompt[:40]}...'"
            ),
            toolCalls=executed_tool_calls,
        )
    ]

    # ---------------------------------------------------------
    # 6. Final API response
    # ---------------------------------------------------------
    return ChatResultResponse(
        answer=last_text,
        route=active_agent,
        source="langgraph",
        llm=True,
        model=os.getenv(
            "OPENAI_MODEL",
            "gpt-5.6-luna",
        ),
        engine="langgraph-supervisor",
        trace=trace_list,
        contexts=[],
        status=status,
        action_type=action_type,
        crud_payload=crud_payload,
        missing_fields=missing_fields or None,
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