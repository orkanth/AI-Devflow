from __future__ import annotations

from app.llm import answer_with_context
from app.schemas import AgentTrace, ContextChunk, GraphState, ToolCall
from app.vectorstore import VectorStore


def run_rag_agent(state: GraphState, store: VectorStore) -> GraphState:
    hits = store.search(state.message, project_id=state.project_id, k=3)
    state.contexts = [
        ContextChunk(title=hit["title"], score=hit["score"], content=hit["content"])
        for hit in hits
    ]
    generated = answer_with_context(
        state.message,
        [chunk.model_dump() for chunk in state.contexts],
    )
    if generated:
        state.answer = generated
        reason = "GPT answered from retrieved chunks."
    elif not state.contexts:
        state.answer = "RAG agent found no matching chunks in the vector store."
        reason = "Question answering over embeddings / pgvector."
    else:
        top = state.contexts[0]
        state.answer = (
            f"RAG agent retrieved {len(state.contexts)} chunks. "
            f"Top match: {top.title} (cosine {top.score}). {top.content}"
        )
        reason = "Extractive fallback (no OPENAI_API_KEY or GPT call failed)."
    state.trace.append(
        AgentTrace(
            agent="rag",
            reason=reason,
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
