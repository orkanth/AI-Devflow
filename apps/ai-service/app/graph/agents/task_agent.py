from __future__ import annotations

import re

from app.schemas import AgentTrace, GraphState, ToolCall
from app.tools.nestjs_tools import NestJsTools


def run_task_agent(state: GraphState, tools: NestJsTools) -> GraphState:
    project_id = state.project_id or "unknown-project"
    title = _extract_title(state.message)
    result = tools.create_task(
        project_id=project_id,
        title=title,
        description=f"Created by LangGraph task agent from: {state.message}",
    )
    state.answer = f'Task agent created "{title}" via NestJS tool calling.'
    if isinstance(result, dict) and result.get("error"):
        state.answer += f" NestJS was unreachable ({result['error']}); payload queued locally."
    state.trace.append(
        AgentTrace(
            agent="task",
            reason="Write intent routed to the task specialist.",
            tool_calls=[
                ToolCall(
                    tool="create_task",
                    args={"project_id": project_id, "title": title},
                    result=result,
                )
            ],
        )
    )
    return state


def _extract_title(message: str) -> str:
    match = re.search(r"task[:\s]+['\"]?([^'\"\n.]+)", message, flags=re.I)
    if match:
        return match.group(1).strip()
    return message.strip()[:80]
