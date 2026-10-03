from typing import Optional
from langchain_core.tools import tool
from app.clients.tasks_client import tasks_client


# ==========================================
# 2. TASK & PROJECT TOOLS
# ==========================================

@tool
async def list_project_tasks(project_id: Optional[str] = None) -> str:
    """Fetches all tasks belonging to a given project or all tasks."""
    tasks = await tasks_client.get_tasks(project_id)
    return str(tasks)