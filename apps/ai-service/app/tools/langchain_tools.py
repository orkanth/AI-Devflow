from typing import Optional
from langchain_core.tools import tool
from app.tools.nestjs_tools import nest_client
from app.vectorstore import get_vector_store

# ==========================================
# 1. USER MANAGEMENT TOOLS
# ==========================================

@tool
async def lookup_user_tool(identifier: str) -> str:
    """Finds user by name or email. Returns user details or an error message."""
    user = await nest_client.find_user(identifier)
    if not user:
        return f"No user found matching '{identifier}'."
    return f"User ID: {user.get('id')} | Name: {user.get('name')} | Email: {user.get('email')} | Role: {user.get('role')}"

@tool
async def create_user_tool(name: str, email: str, role: str) -> str:
    """Creates a user. Returns confirmation message or duplicate validation error."""
    result = await nest_client.create_user(name=name, email=email, role=role)
    if not result.get("success"):
        return result.get("error", "Failed to create user.")
    return f"User {name} with role {role} was created successfully."

@tool
async def update_user_tool(
    user_id: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    role: Optional[str] = None
) -> str:
    """Updates user fields. Returns update confirmation or duplicate conflict error."""
    payload = {k: v for k, v in {"name": name, "email": email, "role": role}.items() if v is not None}
    if not payload:
        return "No fields provided to update."
    result = await nest_client.update_user(user_id, payload)
    if not result.get("success"):
        return result.get("error", "Failed to update user.")
    return f"User {user_id} updated successfully."

@tool
async def delete_user_tool(user_id: str, user_name: str) -> str:
    """Deletes the user permanently. Only invoke after explicit confirmation."""
    result = await nest_client.delete_user(user_id)
    if not result.get("success"):
        return result.get("error", "Failed to delete user.")
    return f"User {user_name} has been deleted successfully."

# ==========================================
# 2. TASK & PROJECT TOOLS
# ==========================================

@tool
async def create_project_task(title: str, description: str, project_id: str) -> str:
    """Creates a new task in NestJS."""
    result = await nest_client.create_task(title, description, project_id)
    return f"Task created successfully with ID: {result.get('id')}"

@tool
async def list_project_tasks(project_id: Optional[str] = None) -> str:
    """Fetches all tasks belonging to a given project or all tasks."""
    tasks = await nest_client.get_tasks(project_id)
    return str(tasks)

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
    metrics = await nest_client.get_project_metrics(project_id)
    return str(metrics)