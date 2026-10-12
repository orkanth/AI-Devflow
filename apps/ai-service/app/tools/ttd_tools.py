import os
import re
from typing import Optional

import psycopg
from langchain_core.tools import tool

from app.clients.ttd_client import ttd_client
from app.embeddings import embeddings

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/devflow",
)


def _normalise_name(value: str) -> str:
    value = os.path.splitext(value.strip())[0].lower()
    return re.sub(r"[^a-z0-9]", "", value)


def _connection_string() -> str:
    return DATABASE_URL.replace(
        "postgresql+psycopg://",
        "postgresql://",
        1,
    )

def _resolve_document(conn, document_name: str):
    """Resolve a document using its title or original filename."""

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                id::text,
                title,
                "originalName",
                "projectId"::text
            FROM public.documents
        """)
        rows = cur.fetchall()

    wanted = _normalise_name(document_name)

    if not wanted:
        return {"error": "A document name is required."}

    documents = []

    for doc_id, title, original_name, project_id in rows:
        names = {
            _normalise_name(str(name))
            for name in (title, original_name)
            if name
        }

        documents.append({
            "id": doc_id,
            "title": title or original_name or "Untitled",
            "project_id": project_id,
            "names": names,
        })

    # First, try an exact match.
    matches = [
        doc for doc in documents
        if wanted in doc["names"]
    ]

    # If there is no exact match, allow a matching alias.
    if not matches:
        matches = [
            doc for doc in documents
            if any(
                len(wanted) >= 6
                and len(name) >= 6
                and (
                    wanted.startswith(name)
                    or name.startswith(wanted)
                )
                for name in doc["names"]
            )
        ]

    # Remove duplicate matches for the same document.
    matches = list({
        doc["id"]: doc for doc in matches
    }.values())

    if not matches:
        return {
            "error": (
                f"No document matched '{document_name}'."
            )
        }

    if len(matches) > 1:
        choices = "\n".join(
            f"- {doc['title']} (ID: {doc['id']})"
            for doc in matches
        )

        return {
            "error": (
                "Multiple documents match that name. "
                "Please select one:\n" + choices
            )
        }

    return matches[0]
@tool
async def search_knowledge_base(
    query: str = "",
    limit: int = 8,
    document_name: Optional[str] = None,
) -> str:
    """
    Retrieve uploaded DevFlow TTD content.

    When document_name is supplied, resolve that document and
    retrieve its chunks in their original order. Use this mode
    to extract a complete work breakdown from a named TTD.

    Otherwise, combine pgvector semantic search and PostgreSQL
    full-text keyword search using Reciprocal Rank Fusion.
    """

    query = (query or "").strip()
    limit = max(1, min(limit, 100))

    if not query and not document_name:
        return "Provide a query or a document name."

    try:
        with psycopg.connect(_connection_string()) as conn: 

            # MODE 1: Retrieve a specific document.
            if document_name:
                doc = _resolve_document(conn, document_name)

                if "error" in doc:
                    return doc["error"]

                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT COUNT(*)
                        FROM public.knowledge_chunks
                        WHERE document_id = %s::uuid
                    """, (doc["id"],))

                    total = (cur.fetchone())[0]

                    if total == 0:
                        return (
                            f"Document '{doc['title']}' exists, "
                            "but has no stored chunks. "
                            "Run document ingestion first."
                        )

                    cur.execute("""
                        SELECT chunk_index, content
                        FROM public.knowledge_chunks
                        WHERE document_id = %s::uuid
                        ORDER BY chunk_index
                        LIMIT %s
                    """, (doc["id"], limit))

                    chunks = cur.fetchall()

                output = [
                    f"Document: {doc['title']}",
                    f"Document ID: {doc['id']}",
                    f"Project ID: {doc['project_id']}",
                    f"Total chunks: {total}",
                    "",
                ]

                for index, content in chunks:
                    output.extend([
                        f"--- Chunk {index} ---",
                        content,
                        "",
                    ])

                if total > limit:
                    output.append(
                        f"Only {limit} of {total} chunks returned. "
                        "Increase limit to retrieve more."
                    )

                return "\n".join(output)

            # MODE 2: Hybrid search across documents.
            vector = await embeddings.aembed_query(query)

            if len(vector) != 1536:
                return (
                    "Embedding dimension mismatch: expected 1536, "
                    f"received {len(vector)}."
                )

            vector_literal = (
                "["
                + ",".join(str(float(v)) for v in vector)
                + "]"
            )
            candidate_limit = min(max(limit * 4, 20), 100)

            sql = """
                WITH vector_ranked AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            ORDER BY embedding <=> %(embedding)s::vector
                        ) AS rank_no
                    FROM public.knowledge_chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %(embedding)s::vector
                    LIMIT %(candidate_limit)s
                ),
                keyword_ranked AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            ORDER BY ts_rank_cd(
                                to_tsvector('simple', content),
                                websearch_to_tsquery('simple', %(query)s)
                            ) DESC
                        ) AS rank_no
                    FROM public.knowledge_chunks
                    WHERE to_tsvector('simple', content)
                        @@ websearch_to_tsquery('simple', %(query)s)
                    ORDER BY ts_rank_cd(
                        to_tsvector('simple', content),
                        websearch_to_tsquery('simple', %(query)s)
                    ) DESC
                    LIMIT %(candidate_limit)s
                ),
                combined AS (
                    SELECT id, 1.0 / (60 + rank_no) AS score
                    FROM vector_ranked
                    UNION ALL
                    SELECT id, 1.0 / (60 + rank_no) AS score
                    FROM keyword_ranked
                ),
                fused AS (
                    SELECT id, SUM(score) AS rrf_score
                    FROM combined
                    GROUP BY id
                )
                SELECT
                    kc.document_id::text,
                    kc.project_id::text,
                    kc.chunk_index,
                    kc.content,
                    COALESCE(
                        d.title,
                        d."originalName",
                        'Untitled'
                    ) AS document_title
                FROM fused f
                JOIN public.knowledge_chunks kc ON kc.id = f.id
                LEFT JOIN public.documents d ON d.id = kc.document_id
                ORDER BY f.rrf_score DESC, kc.chunk_index
                LIMIT %(limit)s
            """

            with conn.cursor() as cur:
                cur.execute(sql, {
                    "embedding": vector_literal,
                    "query": query,
                    "candidate_limit": candidate_limit,
                    "limit": limit,
                })
                rows = cur.fetchall()

            if not rows:
                return "No relevant knowledge chunks found."

            return "\n\n".join(
                f"Document: {title}\n"
                f"Document ID: {doc_id}\n"
                f"Project ID: {project_id}\n"
                f"Chunk: {chunk_index}\n"
                f"Content:\n{content}"
                for (
                    doc_id,
                    project_id,
                    chunk_index,
                    content,
                    title,
                ) in rows
            )

    except Exception as exc:
        print(
            "Knowledge retrieval failed:",
            type(exc).__name__,
            str(exc),
        )
        return (
            "Knowledge retrieval failed. Check the database "
            "connection, table schema, and embedding configuration."
        )


@tool
async def fetch_project_analytics(project_id: str) -> str:
    """Retrieves sprint progress, velocity, and task completion metrics."""
    metrics = await ttd_client.get_project_metrics(project_id)
    return str(metrics)