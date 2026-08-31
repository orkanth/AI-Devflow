from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

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
    }


def complete(system: str, user: str, *, json_mode: bool = False, timeout: float = 25.0) -> str:
    """Call GPT (OpenAI-compatible Chat Completions). Raises if disabled or the API fails."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    payload: dict[str, Any] = {
        "model": llm_model(),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    response = httpx.post(
        f"{llm_base_url()}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def complete_json(system: str, user: str) -> dict[str, Any]:
    raw = complete(system, user, json_mode=True)
    return _parse_json(raw)


def classify_route(message: str) -> str | None:
    if not llm_enabled():
        return None
    try:
        data = complete_json(
            "You route a project-management assistant. "
            "Return JSON {\"route\": \"task\"|\"rag\"|\"analytics\"}. "
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


def answer_with_context(question: str, contexts: list[dict[str, Any]]) -> str | None:
    if not llm_enabled() or not contexts:
        return None
    packed = "\n\n".join(
        f"[{i + 1}] {item['title']} (score {item.get('score', '?')})\n{item['content']}"
        for i, item in enumerate(contexts)
    )
    try:
        return complete(
            "Answer using only the retrieved context. If the context is insufficient, say so. "
            "Be concise. Mention the source title when you use a chunk.",
            f"Question:\n{question}\n\nContext:\n{packed}",
        )
    except Exception:
        return None


def plan_workspace_action(message: str, catalog: dict[str, Any]) -> dict[str, Any] | None:
    if not llm_enabled():
        return None
    try:
        data = complete_json(
            "You plan a single workspace tool call against NestJS. "
            "Return JSON {\"tool\": string, \"args\": object}. "
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
