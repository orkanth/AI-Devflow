# app/tools/tasks_tools.py
from langchain_core.tools import tool
from app.clients.tasks_client import tasks_client

@tool
async def list_project_tasks(project_id: str) -> str:
    """Lists all tasks associated with a given project ID."""
    result = await tasks_client.list_tasks(project_id)

    # 1. Handle client/HTTP failure
    if not isinstance(result, dict) or not result.get("success"):
        error_msg = result.get("error", "Unknown error") if isinstance(result, dict) else str(result)
        return f"Failed to retrieve tasks: {error_msg}"

    # 2. Extract actual task items from the response
    data = result.get("data", [])
    
    # Handle nested response if backend wraps in {"tasks": [...]} or {"items": [...]}
    if isinstance(data, dict):
        tasks = data.get("tasks") or data.get("items") or []
    elif isinstance(data, list):
        tasks = data
    else:
        tasks = []

    if not tasks:
        return f"No tasks found for project `{project_id}`."

    # 3. Format task output safely
    formatted_tasks = []
    for t in tasks:
        if isinstance(t, dict):
            task_title = t.get("title", "Untitled")
            task_id = t.get("id", "N/A")
            status = t.get("status", "N/A")
            formatted_tasks.append(f"- **{task_title}** (ID: `{task_id}`, Status: `{status}`)")

    return "\n".join(formatted_tasks) if formatted_tasks else "No valid task records found."