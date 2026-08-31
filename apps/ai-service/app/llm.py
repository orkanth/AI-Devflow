from __future__ import annotations

import json
import os
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

DEFAULT_MODEL = "gpt-4o-mini"


def llm_enabled() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def llm_model() -> str:
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL)


def llm_base_url() -> str:
    return os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def llm_status() -> dict[str, Any]:
    enabled = llm_enabled()
    return {
        "enabled": enabled,
        "model": llm_model() if enabled else None,
        "provider": "openai" if enabled else None,
        "library": "langchain_openai.ChatOpenAI",
    }


def chat_model(*, json_mode: bool = False) -> ChatOpenAI:
    """LangChain chat model. All GPT calls go through this, not raw HTTP."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    kwargs: dict[str, Any] = {
        "model": llm_model(),
        "api_key": api_key,
        "temperature": 0.2,
        "timeout": 25,
    }
    base = llm_base_url()
    if base != "https://api.openai.com/v1":
        kwargs["base_url"] = base
    model = ChatOpenAI(**kwargs)
    if json_mode:
        return model.bind(response_format={"type": "json_object"})  # type: ignore[return-value]
    return model


def complete(system: str, user: str, *, json_mode: bool = False) -> str:
    result = chat_model(json_mode=json_mode).invoke(
        [SystemMessage(content=system), HumanMessage(content=user)]
    )
    content = result.content
    return content.strip() if isinstance(content, str) else str(content)


def complete_json(system: str, user: str) -> dict[str, Any]:
    return _parse_json(complete(system, user, json_mode=True))


def classify_route(message: str) -> str | None:
    """LangChain LLM router used by the LangGraph supervisor node."""
    if not llm_enabled():
        return None
    try:
        data = complete_json(
            "You route a project-management assistant. "
            'Return JSON {"route": "task"|"rag"|"analytics"}. '
            "task = create/edit/delete/assign users, projects, or tasks. "
            "analytics = counts, metrics, dashboards. "
            "rag = architecture/knowledge questions.",
            message,
        )
        route = str(data.get("route", "")).lower()
        if route in {"task", "rag", "analytics"}:
            return route
    except Exception:
        return None
    return None


def plan_workspace_action(message: str, catalog: dict[str, Any]) -> dict[str, Any] | None:
    if not llm_enabled():
        return None
    try:
        data = complete_json(
            "You plan a single workspace tool call against NestJS. "
            'Return JSON {"tool": string, "args": object}. '
            "Tools: create_task, update_task, delete_task, create_project, delete_project, "
            "create_user, delete_user. "
            "For assign, use update_task with task_id and assignee_id from the catalog. "
            "Use catalog ids; never invent UUIDs.",
            f"User: {message}\nCatalog: {json.dumps(catalog)}",
        )
        tool = data.get("tool")
        args = data.get("args") or {}
        if isinstance(tool, str) and isinstance(args, dict):
            return {"tool": tool, "args": args}
    except Exception:
        return None
    return None


def _parse_json(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, flags=re.S)
        if not match:
            return {}
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}
