# app/tools/task_tools.py
from typing import Optional
from langchain_core.tools import tool
from app.clients.ttd_client import ttd_client
from app.vectorstore import get_vector_store
 
# ==========================================
# 3. RAG / KNOWLEDGE BASE TOOLS
# ==========================================

@tool
async def search_knowledge_base(query: str, limit: int = 4) -> str:
    """Performs semantic similarity search over documents stored in pgvector."""
    store = get_vector_store()
    docs = await store.asimilarity_search(query, k=limit)
    if not docs:
        return "No relevant context found."
    return "\n\n".join([f"Document: {d.page_content}" for d in docs])

# ==========================================
# 4. ANALYTICS TOOLS
# ==========================================

@tool
async def fetch_project_analytics(project_id: str) -> str:
    """Retrieves sprint progress, velocity, and task completion metrics."""
    metrics = await ttd_client.get_project_metrics(project_id)
    return str(metrics)