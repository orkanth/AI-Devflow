# apps/ai-service/app/schemas.py
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

class ToolCallRecord(BaseModel):
    tool: str
    args: Dict[str, Any] = Field(default_factory=dict)
    result: Any = None

class TraceEntry(BaseModel):
    agent: str
    reason: str
    toolCalls: List[ToolCallRecord] = Field(default_factory=list)

class ContextEntry(BaseModel):
    title: str
    score: float
    content: str

class ChatRequest(BaseModel):
    prompt: Optional[str] = None
    message: Optional[str] = None
    thread_id: Optional[str] = "default"
    projectId: Optional[str] = None

    def get_text(self) -> str:
        return (self.prompt or self.message or "").strip()

class ChatResultResponse(BaseModel):
    answer: str
    route: str
    source: str
    llm: bool
    model: str
    engine: str
    trace: List[TraceEntry]
    contexts: List[Any]
    status: str
    crud_payload: Optional[Dict[str, Any]] = None
    missing_fields: Optional[List[str]] = None
    requires_confirmation: bool = False
    # Added "duplicate" to allowed action types
    action_type: Literal[
    "create_task",
    "update_task",
    "delete_task",
    "lookup_task",
    "reassign_tasks",
    "list_tasks",
    "create_project",
    "update_project",
    "delete_project",
    "create_user",
    "update_user",
    "delete_user",
    "lookup_user",
    "missing_info",
    "confirmation",
    "duplicate",
    "none",
    ] = "none"
    missing_fields: Optional[List[str]] = None
    requires_confirmation: bool = False
    
    
class AgentTrace(BaseModel):
    agent_name: str
    action: str
    input_preview: Optional[str] = None
    output_preview: Optional[str] = None
    
class ToolCall(BaseModel):
    tool_name: Optional[str] = None
    arguments: Dict[str, Any] = Field(default_factory=dict)
    direct_response: Optional[str] = None

 