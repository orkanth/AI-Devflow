"""LangChain RAG: retrieve → stuff context into a prompt → generate.

This is the standard RAG pattern, written as LCEL (`prompt | llm | parser`).
Retrieval uses the in-memory vector store (hashing-trick embeddings, same
algorithm as NestJS). Generation uses LangChain `ChatOpenAI` when a key is set.
"""

from __future__ import annotations

from typing import Any

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.llm import chat_model, llm_enabled
from app.vectorstore import VectorStore

RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are the DevFlow RAG agent. Answer using only the retrieved context. "
            "If the context is insufficient, say so. Mention the source title when you use a chunk. "
            "Be concise.",
        ),
        (
            "human",
            "Question:\n{question}\n\nRetrieved context:\n{context}",
        ),
    ]
)


def split_for_ingest(title: str, content: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=80)
    pieces = splitter.split_text(content)
    if not pieces:
        return [content]
    if len(pieces) == 1:
        return pieces
    return [f"{title}\n{piece}" if title not in piece else piece for piece in pieces]


def retrieve_documents(
    store: VectorStore,
    query: str,
    project_id: str | None = None,
    k: int = 3,
) -> tuple[list[dict[str, Any]], list[Document]]:
    hits = store.search(query, project_id=project_id, k=k)
    documents = [
        Document(
            page_content=hit["content"],
            metadata={
                "title": hit["title"],
                "source": hit["source"],
                "score": hit["score"],
                "id": hit["id"],
            },
        )
        for hit in hits
    ]
    return hits, documents


def format_documents(documents: list[Document]) -> str:
    if not documents:
        return "(no chunks retrieved)"
    return "\n\n".join(
        f"[{i + 1}] {doc.metadata.get('title')} "
        f"(score {doc.metadata.get('score')}, source {doc.metadata.get('source')})\n"
        f"{doc.page_content}"
        for i, doc in enumerate(documents)
    )


def run_rag_chain(question: str, documents: list[Document]) -> str | None:
    """LCEL generate step. Returns None when GPT is off so the agent can extract."""
    if not llm_enabled() or not documents:
        return None
    try:
        chain = RAG_PROMPT | chat_model() | StrOutputParser()
        return chain.invoke({"question": question, "context": format_documents(documents)})
    except Exception:
        return None
