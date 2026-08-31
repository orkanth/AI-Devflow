from __future__ import annotations

from typing import Any, Callable

from pydantic import BaseModel, Field


class ToolSpec(BaseModel):
    """MCP-style tool descriptor.

    Model Context Protocol publishes tools with a name, description, and JSON
    Schema so a model can decide *whether* and *how* to call them. We keep the
    same contract without requiring a live MCP server.
    """

    name: str
    description: str
    input_schema: dict[str, Any]


class MCPRegistry:
    def __init__(self) -> None:
        self._specs: dict[str, ToolSpec] = {}
        self._handlers: dict[str, Callable[..., Any]] = {}

    def register(self, spec: ToolSpec, handler: Callable[..., Any]) -> None:
        self._specs[spec.name] = spec
        self._handlers[spec.name] = handler

    def list_tools(self) -> list[ToolSpec]:
        return list(self._specs.values())

    def call(self, name: str, **kwargs: Any) -> Any:
        if name not in self._handlers:
            raise KeyError(f"Unknown MCP tool: {name}")
        return self._handlers[name](**kwargs)


create_task_spec = ToolSpec(
    name="create_task",
    description="Create an engineering task in NestJS, the system of record.",
    input_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "title": {"type": "string"},
            "description": {"type": "string"},
        },
        "required": ["project_id", "title", "description"],
    },
)

search_knowledge_spec = ToolSpec(
    name="search_knowledge",
    description="Semantic search over pgvector-style knowledge chunks.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "project_id": {"type": "string"},
        },
        "required": ["query"],
    },
)

workspace_analytics_spec = ToolSpec(
    name="workspace_analytics",
    description="Aggregate user, project, and task counts from the API.",
    input_schema={"type": "object", "properties": {}},
)
