# apps/ai-service/app/tools/projects_tools.py
import os
import re
from typing import Optional, Literal
from langchain_core.tools import tool
from app.clients.projects_client import projects_client
from app.clients.user_client import users_client  
UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
 
@tool
async def create_project_tool(
    name: str,
    description: str,
    owner_id: Optional[str] = None,
    priority: str = "low",
    status: str = "active",
) -> str:
    """Creates a new project in DevFlow AI."""
    clean_name = name.strip()

    # Programmatic Guardrail: Lookup before creating
    existing = await projects_client.lookup_project(clean_name)
    if existing.get("success") and existing.get("data"):
        project_data = existing["data"]
        return (
            f"Cannot create project: A project named '{clean_name}' "
            f"already exists with ID `{project_data.get('id')}`."
        )

    # Proceed with creation if lookup did not find it
    payload = {
        "name": clean_name,
        "description": description.strip(),
        "status": status.lower(),
        "priority": priority.lower(),
    }
    if owner_id:
        payload["ownerId"] = owner_id.strip()

    result = await projects_client.create_project(payload)
    if not result.get("success"):
        return f"Failed to create project: {result.get('error')}"

    return f"Project **{clean_name}** created successfully!"

@tool
async def lookup_project_tool(identifier: str) -> str:
    """Looks up an existing project by its name.

    Args:
        identifier: The project name to search for.
    """
    clean_id = identifier.strip() if identifier else ""
    if not clean_id:
        return "Error: An identifier (project name) must be provided."

    result = await projects_client.lookup_project(clean_id)

    if not result.get("success"):
        status_code = result.get("status_code")
        if status_code == 404:
            return f"Project '{clean_id}' was not found."
        return f"Failed to look up project: {result.get('error', 'Unknown backend error')}"

    data = result.get("data", {})
    project_id = data.get("id", "N/A")
    name = data.get("name", "N/A")
    description = data.get("description", "No description provided")
    status = data.get("status", "N/A")
    priority = data.get("priority", "N/A")

    owner_info = data.get("owner", {})
    owner_name = owner_info.get("name") if isinstance(owner_info, dict) else data.get("ownerId", "None")

    return (
        f"Project Found:\n"
        f"- **Name**: {name}\n"
        f"- **ID**: `{project_id}`\n"
        f"- **Status**: `{status}`\n"
        f"- **Priority**: `{priority}`\n"
        f"- **Owner**: {owner_name}\n"
        f"- **Description**: {description}"
    )

    """Looks up an existing project by its name or ID.

    Args:
        identifier: The project name or project UUID to search for.
    """
    result = await projects_client.get_project(identifier.strip())
    if not result.get("success"):
        return f"Project '{identifier}' not found or error occurred: {result.get('error', 'Not found')}"

    data = result.get("data", {})
    if not data:
        return f"No project found matching '{identifier}'."

    return (
        f"Found Project **{data.get('name', 'N/A')}**:\n"
        f"- **ID**: `{data.get('id', 'N/A')}`\n"
        f"- **Description**: {data.get('description', 'N/A')}\n"
        f"- **Status**: `{data.get('status', 'N/A')}`\n"
        f"- **Priority**: `{data.get('priority', 'N/A')}`\n"
        f"- **Owner ID**: `{data.get('ownerId', 'N/A')}`"
    )