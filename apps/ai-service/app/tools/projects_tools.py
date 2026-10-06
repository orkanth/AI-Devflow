import os
import re
from typing import Literal, Optional
from langchain_core.tools import tool

from app.clients.projects_client import projects_client
from app.clients.user_client import users_client

UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


@tool
async def lookup_project_tool(identifier: str) -> str:
    """Looks up an existing project by its name or UUID in DevFlow AI.

    Args:
        identifier: The project name or project UUID to search for.
    """
    clean_id = identifier.strip().strip('"').strip("'") if identifier else ""
    if not clean_id:
        return "Error: An identifier (project name or UUID) must be provided."

    # 1. First attempt: Search via project lookup (name or query)
    result = await projects_client.lookup_project(clean_id)

    # 2. Second attempt: Fallback to get_project by ID if lookup failed and UUID is provided
    if not result.get("success") or not result.get("data"):
        if hasattr(projects_client, "get_project"):
            fallback_res = await projects_client.get_project(clean_id)
            if fallback_res.get("success") and fallback_res.get("data"):
                result = fallback_res

    if not result.get("success") or not result.get("data"):
        return f"Project '{clean_id}' was not found in the database."

    data = result.get("data", {})
    owner_info = data.get("owner", {})
    owner_name = (
        owner_info.get("name")
        if isinstance(owner_info, dict)
        else data.get("ownerId", "None")
    )

    return (
        f"Found Project **{data.get('name', 'N/A')}**:\n"
        f"- **ID**: `{data.get('id', 'N/A')}`\n"
        f"- **Description**: {data.get('description', 'No description provided')}\n"
        f"- **Status**: `{data.get('status', 'N/A')}`\n"
        f"- **Priority**: `{data.get('priority', 'N/A')}`\n"
        f"- **Owner**: `{owner_name}`"
    )


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
        name: Name of the project.
        description: Project scope or summary.
        owner_id: UUID of the project owner.
        priority: Priority level.
        status: Lifecycle status.
    """
    clean_name = name.strip()
    clean_desc = description.strip()

    if not clean_name:
        return "Error: name is required to create a project."
    if not clean_desc:
        return "Error: description is required to create a project."

    # Guardrail: Check duplicate name before creating
    existing = await projects_client.lookup_project(clean_name)
    if existing.get("success") and existing.get("data"):
        return f"Cannot create project: A project named '{clean_name}' already exists."

    payload = {
        "name": clean_name,
        "description": clean_desc,
        "status": status.lower(),
        "priority": priority.lower(),
    }
    if owner_id:
        payload["ownerId"] = owner_id.strip()

    result = await projects_client.create_project(payload)
    if not result.get("success"):
        return f"Failed to create project: {result.get('error', 'Unknown backend error')}"

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
    clean_identifier = identifier.strip().strip('"').strip("'")
    if not clean_identifier:
        return "Error: Project identifier must be provided."

    # 1. Verify project exists
    target_project = await projects_client.lookup_project(clean_identifier)
    if not target_project.get("success") or not target_project.get("data"):
        return f"Error: Project '{clean_identifier}' was not found. Cannot update non-existent project."

    existing_data = target_project["data"]
    target_id = existing_data.get("id", clean_identifier)

    # 2. Collision check if renaming
    if name and name.strip().lower() != existing_data.get("name", "").strip().lower():
        clean_new_name = name.strip()
        collision_check = await projects_client.lookup_project(clean_new_name)
        if collision_check.get("success") and collision_check.get("data"):
            collision_id = collision_check["data"].get("id")
            if collision_id != target_id:
                return f"Error: Project with name '{clean_new_name}' already exists. Choose a different name."

    # 3. Build update payload
    payload = {}
    if name:
        payload["name"] = name.strip()
    if description:
        payload["description"] = description.strip()
    if status:
        payload["status"] = status.lower()
    if priority:
        payload["priority"] = priority.lower()

    # 4. Resolve owner (UUID direct or lookup via user_client)
    if owner:
        clean_owner = owner.strip()
        if UUID_REGEX.match(clean_owner):
            payload["ownerId"] = clean_owner
        else:
            try:
                user_res = await users_client.find_user(clean_owner)
            except Exception as e:
                return f"Error contacting user service: {str(e)}"

            if not user_res:
                return f"System Error: User service returned empty response for '{clean_owner}'."

            if isinstance(user_res, dict) and not user_res.get("success", True):
                return f"Backend User Lookup Failed: {user_res.get('error')} (Status: {user_res.get('status_code')})"

            # Extract resolved user UUID
            resolved_id = None
            if isinstance(user_res, dict):
                data = user_res.get("data")
                if isinstance(data, dict):
                    resolved_id = data.get("id")
                elif isinstance(data, list) and len(data) > 0:
                    resolved_id = data[0].get("id")
                elif user_res.get("id"):
                    resolved_id = user_res.get("id")

            if resolved_id:
                payload["ownerId"] = resolved_id
            else:
                return f"Could not find ID for user '{clean_owner}'."

    if not payload:
        return f"Error: No update fields provided for project '{clean_identifier}'."

    # 5. Execute project update
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
async def delete_project_tool(identifier: str) -> str:
    """Deletes an existing project in DevFlow AI by its name or UUID.

    Args:
        identifier: The project name or UUID to delete.
    """
    clean_identifier = identifier.strip().strip('"').strip("'")
    if not clean_identifier:
        return "Error: An identifier (project name or UUID) must be provided to delete a project."

    # 1. Resolve project by name or UUID to get target database ID
    target = await projects_client.lookup_project(clean_identifier)
    if not target.get("success") or not target.get("data"):
        return f"Error: Project '{clean_identifier}' was not found. Cannot delete non-existent project."

    project_data = target["data"]
    project_id = project_data.get("id")
    project_name = project_data.get("name", clean_identifier)

    if not project_id:
        return f"Error: Found project record for '{project_name}', but could not extract a valid ID."

    # 2. Call DELETE /projects/:id
    result = await projects_client.delete_project(project_id)
    if not result.get("success"):
        return f"Failed to delete project '{project_name}': {result.get('error', 'Unknown backend error')}"

    return f"Project **{project_name}** (ID: `{project_id}`) has been successfully deleted."