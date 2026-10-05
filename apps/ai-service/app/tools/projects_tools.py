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
    """Creates a new project in DevFlow AI."""
    clean_name = name.strip()
    clean_desc = description.strip() 
    if not clean_desc:
        return "Error: description is required to create a project."
    # Programmatic Guardrail: Lookup before creating
    existing = await projects_client.lookup_project(clean_name)
    if existing.get("success") and existing.get("data"):
        project_data = existing["data"]
        return (
            f"Cannot create project: A project named '{clean_name}' "
            f"already exists with ID."
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
async def update_project_tool(
    identifier: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[Literal["active", "planning", "on_hold", "completed", "archived"]] = None,
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None,
    owner: Optional[str] = None,
) -> str:
    """Updates an existing project in DevFlow AI.

    Args:
        identifier: Current project name or UUID to locate the project.
        name: New project name if renaming.
        description: New summary/scope of the project.
        status: New lifecycle status ('active', 'planning', 'on_hold', 'completed', 'archived').
        priority: New priority ('low', 'medium', 'high', 'critical').
        owner: New owner's name, email, or UUID.
    """
    clean_identifier = identifier.strip()

    # 1. Verify the project to be updated actually exists
    target_project = await projects_client.lookup_project(clean_identifier)
    if not target_project.get("success") or not target_project.get("data"):
        return f"Error: Project '{clean_identifier}' was not found. Cannot update non-existent project."

    existing_data = target_project["data"]
    target_id = existing_data.get("id", clean_identifier)

    # 2. If renaming, check if the NEW name is already taken by a different project
    if name and name.strip().lower() != existing_data.get("name", "").strip().lower():
        clean_new_name = name.strip()
        collision_check = await projects_client.lookup_project(clean_new_name)
        if collision_check.get("success") and collision_check.get("data"):
            collision_id = collision_check["data"].get("id")
            if collision_id != target_id:
                return f"Error: Project with name '{clean_new_name}' already exists. Choose a different name."

    # 3. Construct update payload with only provided fields
    payload = {}
    if name:
        payload["name"] = name.strip()
    if description:
        payload["description"] = description.strip()
    if status:
        payload["status"] = status.lower()
    if priority:
        payload["priority"] = priority.lower()

    # 4. Resolve owner (Name/Email -> UUID)
    if owner:
        clean_owner = owner.strip()
        if UUID_REGEX.match(clean_owner):
            payload["ownerId"] = clean_owner
        else:
            user_res = await users_client.lookup_user(clean_owner)
            
            # Temporary log to verify what Python actually receives:
            print(f"DEBUG lookup_user response for '{clean_owner}': {user_res}")

            resolved_id = None
            if isinstance(user_res, dict) and user_res.get("success"):
                data = user_res.get("data")
                if isinstance(data, dict) and data.get("id"):
                    resolved_id = data.get("id")
                elif user_res.get("id"):
                    resolved_id = user_res.get("id")

            if resolved_id:
                payload["ownerId"] = resolved_id
            else:
                return f"Error: User '{clean_owner}' was not found. Please verify the user exists."

    # 5. Send update request using the verified project ID
    result = await projects_client.update_project(target_id, payload)
    if not result.get("success"):
        status_code = result.get("status_code")
        error_msg = str(result.get("error", "Unknown error"))
        if status_code == 409 or "already exists" in error_msg.lower():
            return f"Error: Project with name '{name}' already exists."
        return f"Failed to update project: {error_msg}"

    data = result.get("data", {})
    updated_name = data.get("name") or payload.get("name") or clean_identifier
    return f"Project **{updated_name}** updated successfully!"

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