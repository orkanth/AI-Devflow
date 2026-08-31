from __future__ import annotations

import os
import re
from typing import Callable

from langgraph.graph import END, START, StateGraph

from app.graph.agents.analytics_agent import run_analytics_agent
from app.graph.agents.rag_agent import run_rag_agent
from app.graph.agents.task_agent import run_task_agent
from app.llm import classify_route, llm_status
from app.schemas import ChatRequest, ChatResponse, GraphState
from app.tools.nestjs_tools import NestJsTools
from app.vectorstore import VectorStore


def route_message(message: str) -> str:
    """Deterministic router used in tests and when GPT is off."""
    text = message.lower()
    if re.search(
        r"(create|add|open|edit|update|delete|remove|assign|archive).*(task|ticket|project|user|member)",
        text,
    ) or text.startswith("create task"):
        return "task"
    if re.search(r"(how many|analytics|metrics|status of tasks|dashboard)", text):
        return "analytics"
    return "rag"


def resolve_route(message: str) -> str:
    return classify_route(message) or route_message(message)


class SupervisorGraph:
    """LangGraph supervisor: START → supervisor → (task | rag | analytics) → END.

    LangChain is used *inside* the nodes (ChatOpenAI, RAG LCEL, bind_tools).
    LangGraph only decides *which node runs next* from shared state.
    """

    def __init__(self, store: VectorStore, tools: NestJsTools | None = None) -> None:
        self.store = store
        self.tools = tools or NestJsTools()
        self.graph_error: str | None = None
        self._compiled = self._compile_langgraph()

    def invoke(self, request: ChatRequest) -> ChatResponse:
        state = GraphState(message=request.message, project_id=request.project_id)
        engine = "python"
        if self._compiled is not None:
            raw = self._compiled.invoke(state.model_dump())
            state = GraphState.model_validate(raw)
            engine = "langgraph"
        else:
            state = self._run_python(state)
        assert state.route is not None
        return ChatResponse(
            answer=state.answer,
            route=state.route,
            source="fastapi",
            engine=engine,
            llm=bool(llm_status()["enabled"]),
            model=llm_status()["model"],
            trace=state.trace,
            contexts=state.contexts,
        )

    def _run_python(self, state: GraphState) -> GraphState:
        state.route = resolve_route(state.message)  # type: ignore[assignment]
        return self._dispatch(state)

    def _dispatch(self, state: GraphState) -> GraphState:
        workers: dict[str, Callable[[GraphState], GraphState]] = {
            "task": lambda s: run_task_agent(s, self.tools),
            "rag": lambda s: run_rag_agent(s, self.store),
            "analytics": lambda s: run_analytics_agent(s, self.tools),
        }
        return workers[state.route or "rag"](state)

    def _compile_langgraph(self):
        if os.getenv("DEVFLOW_FORCE_FALLBACK_GRAPH") == "1":
            return None
        try:
            return self._build_langgraph()
        except Exception as error:
            self.graph_error = str(error)
            return None

    def _build_langgraph(self):
        def supervisor(state: dict) -> dict:
            parsed = GraphState.model_validate(state)
            parsed.route = resolve_route(parsed.message)  # type: ignore[assignment]
            return parsed.model_dump()

        def task_node(state: dict) -> dict:
            return run_task_agent(GraphState.model_validate(state), self.tools).model_dump()

        def rag_node(state: dict) -> dict:
            return run_rag_agent(GraphState.model_validate(state), self.store).model_dump()

        def analytics_node(state: dict) -> dict:
            return run_analytics_agent(GraphState.model_validate(state), self.tools).model_dump()

        def choose(state: dict) -> str:
            return state.get("route") or "rag"

        graph = StateGraph(dict)
        graph.add_node("supervisor", supervisor)
        graph.add_node("task", task_node)
        graph.add_node("rag", rag_node)
        graph.add_node("analytics", analytics_node)
        graph.add_edge(START, "supervisor")
        graph.add_conditional_edges(
            "supervisor",
            choose,
            {"task": "task", "rag": "rag", "analytics": "analytics"},
        )
        graph.add_edge("task", END)
        graph.add_edge("rag", END)
        graph.add_edge("analytics", END)
        return graph.compile()
