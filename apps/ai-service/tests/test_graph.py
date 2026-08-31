import os

os.environ.pop("OPENAI_API_KEY", None)

from app.embeddings import cosine_similarity, embed
from app.llm import _parse_json
from app.eval.evaluator import evaluate
from app.graph.supervisor import SupervisorGraph, route_message
from app.schemas import ChatRequest, EvalRequest
from app.tools.nestjs_tools import NestJsTools
from app.vectorstore import default_store


class SilentNest(NestJsTools):
    def list_projects(self) -> list[dict]:
        return [{"id": "p1", "name": "DevFlow Platform"}]

    def list_users(self) -> list[dict]:
        return [{"id": "u1", "name": "Ada Lovelace"}]

    def list_tasks(self) -> list[dict]:
        return [{"id": "t1", "title": "Wire FastAPI LangGraph supervisor"}]

    def create_task(self, project_id: str, title: str, description: str, assignee_id: str | None = None) -> dict:
        return {"id": "local", "projectId": project_id, "title": title, "assigneeId": assignee_id}

    def update_task(self, task_id: str, **fields) -> dict:
        return {"id": task_id, **fields}

    def delete_task(self, task_id: str) -> dict:
        return {"id": task_id, "deleted": True}

    def analytics(self) -> dict:
        return {"users": 2, "projects": 2, "tasks": 4}


def test_embeddings_are_deterministic_and_ranked():
    query = embed("langgraph supervisor routes rag agent")
    related = embed("A supervisor graph routes each request to the RAG agent")
    unrelated = embed("the cafeteria serves tomato soup at noon")
    assert embed("hello") == embed("hello")
    assert cosine_similarity(query, related) > cosine_similarity(query, unrelated)


def test_supervisor_routes_intents():
    assert route_message("create task: Write ADR") == "task"
    assert route_message("assign task to Ada Lovelace") == "task"
    assert route_message("delete project RAG Lab") == "task"
    assert route_message("how many tasks are open?") == "analytics"
    assert route_message("explain pgvector cosine search") == "rag"


def test_rag_agent_returns_context():
    graph = SupervisorGraph(default_store(), tools=SilentNest())
    result = graph.invoke(ChatRequest(message="What is the LangGraph supervisor pattern?"))
    assert result.route == "rag"
    assert result.contexts
    assert "supervisor" in result.answer.lower()
    assert result.llm is False
    assert result.model is None


def test_task_agent_tool_call():
    graph = SupervisorGraph(default_store(), tools=SilentNest())
    result = graph.invoke(ChatRequest(message="create task: Document MCP registry", project_id="p1"))
    assert result.route == "task"
    assert result.trace[0].tool_calls[0].tool == "create_task"


def test_task_agent_assigns():
    graph = SupervisorGraph(default_store(), tools=SilentNest())
    result = graph.invoke(
        ChatRequest(message='assign task "Wire FastAPI LangGraph supervisor" to Ada Lovelace')
    )
    assert result.route == "task"
    assert result.trace[0].tool_calls[0].tool == "update_task"


def test_evaluation_scores_overlap():
    scores = evaluate(
        EvalRequest(
            question="How does pgvector search work?",
            answer="pgvector stores embeddings and supports cosine distance for RAG retrieval.",
            contexts=[
                "pgvector stores embedding columns as vector types and supports cosine distance."
            ],
        )
    )
    assert scores.faithfulness > 0
    assert scores.context_precision > 0


def test_parse_json_tolerates_fences():
    assert _parse_json('{"route": "rag"}')["route"] == "rag"
    assert _parse_json('Sure.\n```json\n{"tool": "create_task", "args": {}}\n```')[
        "tool"
    ] == "create_task"
