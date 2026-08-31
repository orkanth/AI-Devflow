from __future__ import annotations

import json

from app.schemas import AgentTrace, GraphState, ToolCall
from app.tools.nestjs_tools import NestJsTools


def run_analytics_agent(state: GraphState, tools: NestJsTools) -> GraphState:
    stats = tools.analytics()
    state.answer = (
        "Analytics agent aggregated PostgreSQL-style workspace metrics: "
        + json.dumps(stats)
    )
    state.trace.append(
        AgentTrace(
            agent="analytics",
            reason="Counting / dashboard intent.",
            tool_calls=[
                ToolCall(tool="workspace_analytics", args={}, result=stats)
            ],
        )
    )
    return state
