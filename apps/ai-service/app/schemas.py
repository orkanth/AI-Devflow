from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=2)
    project_id: str | None = None


class ToolCall(BaseModel):
    tool: str
    args: dict[str, Any]
    result: Any


class AgentTrace(BaseModel):
    agent: str
    reason: str
    tool_calls: list[ToolCall] = Field(default_factory=list)


class ContextChunk(BaseModel):
    title: str
    score: float
    content: str


class ChatResponse(BaseModel):
    answer: str
    route: Literal["task", "rag", "analytics"]
    source: str = "fastapi"
    engine: str = "langgraph"
    llm: bool = False
    model: str | None = None
    trace: list[AgentTrace]
    contexts: list[ContextChunk] = Field(default_factory=list)


class EvalRequest(BaseModel):
    question: str
    answer: str
    contexts: list[str]


class EvalResponse(BaseModel):
    faithfulness: float
    context_precision: float
    answer_relevance: float
    notes: str


class GraphState(BaseModel):
    """LangGraph-style shared state that every node reads and writes."""

    message: str
    project_id: str | None = None
    route: Literal["task", "rag", "analytics"] | None = None
    answer: str = ""
    contexts: list[ContextChunk] = Field(default_factory=list)
    trace: list[AgentTrace] = Field(default_factory=list)
