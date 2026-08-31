from __future__ import annotations

from app.rag.pipeline import retrieve_documents, run_rag_chain
from app.schemas import AgentTrace, ContextChunk, GraphState, ToolCall
from app.vectorstore import VectorStore


def run_rag_agent(state: GraphState, store: VectorStore) -> GraphState:
    hits, documents = retrieve_documents(
        store, state.message, project_id=state.project_id, k=3
    )
    state.contexts = [
        ContextChunk(title=hit["title"], score=hit["score"], content=hit["content"])
        for hit in hits
    ]
    generated = run_rag_chain(state.message, documents)
    if generated:
        state.answer = generated
        reason = "LangChain RAG: retrieve → ChatPromptTemplate | ChatOpenAI | StrOutputParser."
    elif not state.contexts:
        state.answer = "RAG agent found no matching chunks in the vector store."
        reason = "Retrieve step returned no chunks above score 0."
    else:
        top = state.contexts[0]
        state.answer = (
            f"RAG retrieved {len(state.contexts)} chunks (extractive fallback, no GPT). "
            f"Top match: {top.title} (cosine {top.score}). {top.content}"
        )
        reason = "Retrieved with LangChain Documents; generation skipped (no OPENAI_API_KEY)."
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
