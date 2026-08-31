"""LangChain tools wrapping NestJS. The LLM picks a tool; Python executes HTTP."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.llm import chat_model, llm_enabled
from app.tools.nestjs_tools import NestJsTools


class CreateTaskInput(BaseModel):
    title: str
    project_id: str = ""
    description: str = ""
    assignee_id: str = ""


class UpdateTaskInput(BaseModel):
    task_id: str
    title: str | None = None
    description: str | None = None
    status: str | None = None
    assignee_id: str | None = None


class DeleteIdInput(BaseModel):
    id: str = Field(description="Row id from the catalog")


class CreateProjectInput(BaseModel):
    name: str
    description: str = ""
    owner_id: str = ""


class CreateUserInput(BaseModel):
    name: str
    email: str = ""
    role: str = "engineer"


def nestjs_tools(nest: NestJsTools, default_project_id: str | None = None) -> list[StructuredTool]:
    def create_task(
        title: str,
        project_id: str = "",
        description: str = "",
        assignee_id: str = "",
    ) -> dict[str, Any]:
        return nest.create_task(
            project_id=project_id or default_project_id or "",
            title=title,
            description=description or title,
            assignee_id=assignee_id or None,
        )

    def update_task(
        task_id: str,
        title: str | None = None,
        description: str | None = None,
        status: str | None = None,
        assignee_id: str | None = None,
    ) -> dict[str, Any]:
        fields = {
            k: v
            for k, v in {
                "title": title,
                "description": description,
                "status": status,
                "assignee_id": assignee_id,
            }.items()
            if v is not None
        }
        return nest.update_task(task_id, **fields)

    def delete_task(id: str) -> dict[str, Any]:
        return nest.delete_task(id)

    def create_project(name: str, description: str = "", owner_id: str = "") -> dict[str, Any]:
        users = nest.list_users()
        return nest.create_project(
            name=name,
            description=description or name,
            owner_id=owner_id or (users[0]["id"] if users else ""),
        )

    def delete_project(id: str) -> dict[str, Any]:
        return nest.delete_project(id)

    def create_user(name: str, email: str = "", role: str = "engineer") -> dict[str, Any]:
        resolved = email or f"{name.lower().replace(' ', '.')}@devflow.ai"
        return nest.create_user(name=name, email=resolved, role=role)

    def delete_user(id: str) -> dict[str, Any]:
        return nest.delete_user(id)

    return [
        StructuredTool.from_function(
            name="create_task",
            description="Create a task in NestJS.",
            func=create_task,
            args_schema=CreateTaskInput,
        ),
        StructuredTool.from_function(
            name="update_task",
            description="Update or assign a task. Use catalog task_id and assignee_id.",
            func=update_task,
            args_schema=UpdateTaskInput,
        ),
        StructuredTool.from_function(
            name="delete_task",
            description="Delete a task by catalog id.",
            func=delete_task,
            args_schema=DeleteIdInput,
        ),
        StructuredTool.from_function(
            name="create_project",
            description="Create a project in NestJS.",
            func=create_project,
            args_schema=CreateProjectInput,
        ),
        StructuredTool.from_function(
            name="delete_project",
            description="Delete a project by catalog id.",
            func=delete_project,
            args_schema=DeleteIdInput,
        ),
        StructuredTool.from_function(
            name="create_user",
            description="Create a user in NestJS.",
            func=create_user,
            args_schema=CreateUserInput,
        ),
        StructuredTool.from_function(
            name="delete_user",
            description="Delete a user by catalog id.",
            func=delete_user,
            args_schema=DeleteIdInput,
        ),
    ]


def invoke_tool_calling(message: str, catalog: dict[str, Any], tools: list[StructuredTool]) -> dict[str, Any] | None:
    """LangChain bind_tools: the model emits a tool call, we execute it."""
    if not llm_enabled():
        return None
    try:
        bound = chat_model().bind_tools(tools)
        result = bound.invoke(
            [
                SystemMessage(
                    content=(
                        "You are the DevFlow task agent. Call exactly one NestJS tool. "
                        "Use ids from the catalog; never invent UUIDs. "
                        f"Catalog: {catalog}"
                    )
                ),
                HumanMessage(content=message),
            ]
        )
        calls = getattr(result, "tool_calls", None) or []
        if not calls:
            return None
        call = calls[0]
        name = call["name"]
        args = call.get("args") or {}
        lookup = {tool.name: tool for tool in tools}
        if name not in lookup:
            return None
        executed = lookup[name].invoke(args)
        return {"tool": name, "args": args, "result": executed}
    except Exception:
        return None
