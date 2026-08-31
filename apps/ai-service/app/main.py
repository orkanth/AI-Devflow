from pathlib import Path

from dotenv import load_dotenv

_root = Path(__file__).resolve().parents[3]
load_dotenv(_root / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.eval.evaluator import evaluate
from app.graph.supervisor import SupervisorGraph
from app.llm import llm_status
from app.schemas import ChatRequest, ChatResponse, EvalRequest, EvalResponse
from app.tools.mcp_registry import (
    MCPRegistry,
    create_task_spec,
    search_knowledge_spec,
    workspace_analytics_spec,
)
from app.vectorstore import default_store

store = default_store()
graph = SupervisorGraph(store)
mcp = MCPRegistry()
mcp.register(create_task_spec, lambda **kwargs: kwargs)
mcp.register(search_knowledge_spec, lambda **kwargs: store.search(**kwargs))
mcp.register(workspace_analytics_spec, lambda **kwargs: {"ok": True})

app = FastAPI(
    title="DevFlow AI Service",
    description="FastAPI + LangGraph supervisor with RAG, tool calling, MCP, and eval.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "ai-service",
        "chunks": len(store.chunks),
        "mcp_tools": [spec.name for spec in mcp.list_tools()],
        "llm": llm_status(),
    }


@app.post("/v1/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    return graph.invoke(payload)


@app.post("/v1/knowledge/ingest")
def ingest(payload: dict) -> dict:
    chunk = store.ingest(
        project_id=payload["project_id"],
        title=payload["title"],
        content=payload["content"],
        source=payload.get("source", "manual"),
    )
    return {"id": chunk.id, "title": chunk.title, "embedding_dim": len(chunk.embedding)}


@app.post("/v1/knowledge/search")
def search(payload: dict) -> list[dict]:
    return store.search(payload["query"], payload.get("project_id"))


@app.get("/v1/mcp/tools")
def list_mcp_tools() -> list[dict]:
    return [spec.model_dump() for spec in mcp.list_tools()]


@app.post("/v1/eval", response_model=EvalResponse)
def eval_answer(payload: EvalRequest) -> EvalResponse:
    return evaluate(payload)
