from __future__ import annotations

from app.schemas import AgentTrace, ContextChunk, GraphState, ToolCall
from app.vectorstore import VectorStore


def run_rag_agent(state: GraphState, store: VectorStore) -> GraphState:
    hits = store.search(state.message, project_id=state.project_id, k=3)
    state.contexts = [
        ContextChunk(title=hit["title"], score=hit["score"], content=hit["content"])
        for hit in hits
    ]
    if not state.contexts:
        state.answer = "RAG agent found no matching chunks in the vector store."
    else:
        top = state.contexts[0]
        state.answer = (
            f"RAG agent retrieved {len(state.contexts)} chunks. "
            f"Top match: {top.title} (cosine {top.score}). {top.content}"
        )
    state.trace.append(
        AgentTrace(
            agent="rag",
            reason="Question answering over embeddings / pgvector.",
            tool_calls=[
                ToolCall(
                    tool="search_knowledge",
                    args={"query": state.message, "project_id": state.project_id},
                    result=hits,
                )
            ],
        )
    )
    return state
