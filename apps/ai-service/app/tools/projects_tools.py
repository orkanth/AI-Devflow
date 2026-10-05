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
    priority: Literal["low", "medium", "high", "critical"] = "low",
    status: Literal["active", "planning", "on_hold", "completed", "archived"] = "active",
) -> str:
    """Creates a new project in DevFlow AI.

    Args:
        name: Name of the project (e.g. 'TestPrject1').
        description: A brief summary or scope of the project.
        owner_id: UUID of the owner. Defaults to system owner if omitted.
        priority: Priority of the project ('low', 'medium', 'high', 'critical'). Defaults to 'low'.
        status: Lifecycle status ('active', 'planning', etc.). Defaults to 'active'.
        
        
        EXTRACTION INSTRUCTIONS FOR CREATING PROJECTS:
            Users may provide input with typos, varying order, or key-value pairs (e.g., "Careate project TestPro and Desciption: Test desc").

            - Name: Look for words following "project", "create project", or labeled as "name:".
            - Description: Look for text following "description:", "desc:", "about", or "scope".
            - If `name` and `description` are both present, invoke `create_project_tool(name=..., description=...)` immediately.
            - Leave `owner_id`, `priority`, and `status` to their defaults unless explicitly specified.
            - Only prompt for missing info if `name` or `description` cannot be found.
    """
    resolved_owner_id = None

    if owner_id:
        clean_owner = owner_id.strip()
        # If it's already a valid UUID, use it directly
        if UUID_REGEX.match(clean_owner):
            resolved_owner_id = clean_owner
        else:
            # Look up the user by name or email automatically
            user_res = await users_client.lookup_user(clean_owner)
            if user_res.get("success") and user_res.get("data"):
                resolved_owner_id = user_res["data"].get("id")

    payload = {
        "name": name.strip(),
        "description": description.strip(),
        "status": status.lower(),
        "priority": priority.lower(),
    }
    if owner_id:
        payload["ownerId"] = owner_id.strip()
        
    result = await projects_client.create_project(payload)
    if not result.get("success"):
        return f"CRITICAL_BACKEND_ERROR: Status {result.get('status_code')}: {result.get('error')}"

    data = result.get("data", {})
    return f"Project created successfully: {data}"

@tool
async def lookup_project_tool(identifier: str) -> str:
    

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