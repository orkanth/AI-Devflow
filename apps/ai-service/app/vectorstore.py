from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from .embeddings import cosine_similarity, embed


@dataclass
class KnowledgeChunk:
    id: str
    project_id: str
    title: str
    content: str
    source: str
    embedding: list[float]


@dataclass
class VectorStore:
    """In-memory stand-in for PostgreSQL + pgvector.

    Production mapping:
      CREATE EXTENSION vector;
      CREATE TABLE knowledge_chunks (
        id uuid PRIMARY KEY,
        project_id uuid,
        title text,
        content text,
        source text,
        embedding vector(64)
      );
      CREATE INDEX ON knowledge_chunks
        USING ivfflat (embedding vector_cosine_ops);
    """

    chunks: list[KnowledgeChunk] = field(default_factory=list)

    def ingest(self, project_id: str, title: str, content: str, source: str = "manual") -> KnowledgeChunk:
        chunk = KnowledgeChunk(
            id=str(uuid4()),
            project_id=project_id,
            title=title,
            content=content,
            source=source,
            embedding=embed(f"{title} {content}"),
        )
        self.chunks.append(chunk)
        return chunk

    def search(self, query: str, project_id: str | None = None, k: int = 4) -> list[dict[str, Any]]:
        query_vector = embed(query)
        corpus = [
            chunk
            for chunk in self.chunks
            if project_id is None or chunk.project_id == project_id
        ]
        if project_id and not corpus:
            corpus = list(self.chunks)
        ranked = sorted(
            (
                {
                    "id": chunk.id,
                    "project_id": chunk.project_id,
                    "title": chunk.title,
                    "content": chunk.content,
                    "source": chunk.source,
                    "score": round(cosine_similarity(query_vector, chunk.embedding), 4),
                }
                for chunk in corpus
            ),
            key=lambda item: item["score"],
            reverse=True,
        )
        return ranked[:k]


def default_store() -> VectorStore:
    store = VectorStore()
    store.ingest(
        "platform",
        "Why NestJS owns Users, Projects, Tasks",
        "NestJS is the business API layer. CRUD for users, projects, and tasks lives here so authorization, validation, and transactional writes stay in one place. The Python AI service must never become the system of record.",
        "architecture.md",
    )
    store.ingest(
        "platform",
        "LangGraph supervisor pattern",
        "A supervisor graph routes each user request to a specialist agent. The task agent uses tool calling against NestJS. The RAG agent searches pgvector embeddings. The analytics agent aggregates PostgreSQL-style metrics.",
        "agents.md",
    )
    store.ingest(
        "rag-lab",
        "pgvector cosine search",
        "pgvector stores embedding columns as vector types and supports cosine, L2, and inner-product distance. RAG retrieves the top-k chunks, then the language model answers using only that context. Evaluation checks faithfulness to retrieved chunks.",
        "rag.md",
    )
    store.ingest(
        "rag-lab",
        "MCP tool calling",
        "Model Context Protocol exposes tools with JSON schemas. Agents call tools instead of inventing side effects. In DevFlow the create_task and search_knowledge tools are registered in an MCP-style registry and executed against NestJS.",
        "mcp.md",
    )
    return store
