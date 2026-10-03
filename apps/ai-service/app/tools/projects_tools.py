from typing import Optional
from langchain_core.tools import tool
from app.clients.projects_client import projects_client


@tool
async def create_project_tool(name: str, description: Optional[str] = None) -> str:
    """Creates a new project in the system.

    Args:
        name: The title or name of the project.
        description: Optional details or description of the project scope.
    """
    result = await projects_client.create_project(name=name, description=description)
    if not result.get("success"):
        return result.get("error", "Failed to create project.")

    project_data = result.get("data", {})
    project_id = project_data.get("id", "N/A")
    return f"Project '<b>{name}</b>' created successfully with ID: <code>{project_id}</code>."


# If other modules expect `create_project_task`, alias or implement it:
create_project_task = create_project_tool