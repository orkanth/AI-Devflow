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
    route: str = "UserAgent"
    source: str = "langgraph"
    llm: bool = True
    model: Optional[str] = "gpt-4o"
    engine: str = "langgraph-supervisor"
    trace: List[TraceEntry] = Field(default_factory=list)
    contexts: List[ContextEntry] = Field(default_factory=list)
    
    # UI Action Metadata
    status: Literal["completed", "requires_action", "error"] = "completed"
    # Added "duplicate" to allowed action types
    action_type: Literal["missing_info", "confirmation", "duplicate", "none"] = "none"
    missing_fields: Optional[List[str]] = None
    requires_confirmation: bool = False