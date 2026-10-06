import os
import re
from typing import Literal, Optional
from langchain_core.tools import tool

from app.clients.projects_client import projects_client
from app.clients.tasks_client import tasks_client
from app.clients.user_client import users_client

UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


@tool
async def lookup_task_tool(identifier: str) -> str:
    """Looks up an existing task by its title or UUID in DevFlow AI.

    Args:
        identifier: The task title or task UUID to search for.
    """
    clean_id = identifier.strip().strip('"').strip("'") if identifier else ""
    if not clean_id:
        return "Error: A task identifier (title or UUID) must be provided."

    # 1. Lookup by query/title
    result = await tasks_client.lookup_task(clean_id)

    # 2. Fallback to get_task by ID if UUID
    if not result.get("success") or not result.get("data"):
        if hasattr(tasks_client, "get_task"):
            fallback_res = await tasks_client.get_task(clean_id)
            if fallback_res.get("success") and fallback_res.get("data"):
                result = fallback_res

    if not result.get("success") or not result.get("data"):
        return f"Task '{clean_id}' was not found in the database."

    data = result.get("data", {})
    assignee_info = data.get("assignee") or data.get("user") or {}
    assignee_name = (
        assignee_info.get("name")
        if isinstance(assignee_info, dict)
        else data.get("assigneeId", "Unassigned")
    )
    project_info = data.get("project") or {}
    project_name = (
        project_info.get("name")
        if isinstance(project_info, dict)
        else data.get("projectId", "N/A")
    )

    return (
        f"Found Task **{data.get('title', 'N/A')}**:\n"
        f"- **ID**: `{data.get('id', 'N/A')}`\n"
        f"- **Description**: {data.get('description', 'No description provided')}\n"
        f"- **Status**: `{data.get('status', 'todo')}`\n"
        f"- **Priority**: `{data.get('priority', 'medium')}`\n"
        f"- **Project**: {project_name}\n"
        f"- **Assignee**: {assignee_name}"
    )


@tool
async def create_task_tool(
    title: str,
    project_identifier: str,
    description: Optional[str] = None,
    assignee: Optional[str] = None,
    priority: Literal["low", "medium", "high", "critical"] = "medium",
    status: Literal["todo", "in_progress", "in_review", "done", "blocked"] = "todo",
) -> str:
    """Creates a new task within a project in DevFlow AI.

    Args:
        title: Title of the task.
        project_identifier: Project name or project UUID where the task belongs.
        description: Details or scope of the task.
        assignee: Name, email, or UUID of the assignee.
        priority: Priority level.
        status: Initial lifecycle status.
    """
    clean_title = title.strip().strip('"').strip("'")
    clean_project = project_identifier.strip().strip('"').strip("'")

    if not clean_title:
        return "Error: title is required to create a task."
    if not clean_project:
        return "Error: project_identifier is required to specify where to create the task."

    # 1. Resolve Project ID (UUID check first, otherwise lookup by name)
    project_id = None
    project_name = clean_project

    if UUID_REGEX.match(clean_project):
        project_id = clean_project
    else:
        proj_res = await projects_client.lookup_project(clean_project)
        if not proj_res.get("success") or not proj_res.get("data"):
            return f"Error: Project '{clean_project}' was not found. Tasks must belong to an existing project."
        
        proj_data = proj_res["data"]
        project_id = proj_data.get("id")
        project_name = proj_data.get("name", clean_project)

    if not project_id:
        return f"Error: Could not resolve a valid UUID for project '{clean_project}'."

    # 2. Build the exact NestJS DTO payload
    payload = {
        "projectId": project_id,
        "title": clean_title,
        "description": description.strip() if description else "",
        "status": status.lower(),
        "priority": priority.lower(),
    }

    # 3. Resolve Assignee UUID (pass UUID directly or lookup via user_client)
    if assignee:
        clean_assignee = assignee.strip().strip('"').strip("'")
        if UUID_REGEX.match(clean_assignee):
            payload["assigneeId"] = clean_assignee
        else:
            try:
                user_res = await users_client.find_user(clean_assignee)
                resolved_user_id = None
                if user_res and isinstance(user_res, dict):
                    data = user_res.get("data")
                    if isinstance(data, dict):
                        resolved_user_id = data.get("id")
                    elif isinstance(data, list) and len(data) > 0:
                        resolved_user_id = data[0].get("id")
                    elif user_res.get("id"):
                        resolved_user_id = user_res.get("id")

                if resolved_user_id:
                    payload["assigneeId"] = resolved_user_id
                else:
                    return f"Warning: Could not resolve user '{clean_assignee}'. Task was not created."
            except Exception as e:
                return f"Error resolving assignee '{clean_assignee}': {str(e)}"

    # 4. Dispatch payload to NestJS backend POST /tasks
    result = await tasks_client.create_task(payload)
    if not result.get("success"):
        return f"Failed to create task: {result.get('error', 'Unknown backend error')}"

    task_data = result.get("data", {})
    created_id = task_data.get("id", "N/A")
    return f"Task **{clean_title}** (ID: `{created_id}`) created successfully under project **{project_name}**!"
@tool
async def update_task_tool(
    identifier: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[Literal["todo", "in_progress", "in_review", "done", "blocked"]] = None,
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None,
    assignee: Optional[str] = None,
) -> str:
    """Updates an existing task in DevFlow AI.

    Args:
        identifier: Current task title or UUID to locate the task.
        title: New title if renaming.
        description: New task description.
        status: New status ('todo', 'in_progress', 'in_review', 'done', 'blocked').
        priority: New priority ('low', 'medium', 'high', 'critical').
        assignee: New assignee's name, email, or UUID.
    """
    clean_identifier = identifier.strip().strip('"').strip("'")
    if not clean_identifier:
        return "Error: Task identifier must be provided."

    # 1. Verify task exists
    target = await tasks_client.lookup_task(clean_identifier)
    if not target.get("success") or not target.get("data"):
        return f"Error: Task '{clean_identifier}' was not found. Cannot update non-existent task."

    task_data = target["data"]
    target_id = task_data.get("id", clean_identifier)

    payload = {}
    if title:
        payload["title"] = title.strip()
    if description:
        payload["description"] = description.strip()
    if status:
        payload["status"] = status.lower()
    if priority:
        payload["priority"] = priority.lower()

    # 2. Resolve assignee if supplied
    if assignee:
        clean_assignee = assignee.strip()
        if UUID_REGEX.match(clean_assignee):
            payload["assigneeId"] = clean_assignee
        else:
            try:
                user_res = await users_client.find_user(clean_assignee)
                if user_res and isinstance(user_res, dict):
                    data = user_res.get("data")
                    if isinstance(data, dict):
                        payload["assigneeId"] = data.get("id")
                    elif isinstance(data, list) and len(data) > 0:
                        payload["assigneeId"] = data[0].get("id")
                    elif user_res.get("id"):
                        payload["assigneeId"] = user_res.get("id")
            except Exception as e:
                return f"Error contacting user service: {str(e)}"

            if "assigneeId" not in payload:
                return f"Could not find user '{clean_assignee}' to assign task."

    if not payload:
        return f"Error: No update fields provided for task '{clean_identifier}'."

    result = await tasks_client.update_task(target_id, payload)
    if not result.get("success"):
        return f"Failed to update task: {result.get('error', 'Unknown backend error')}"

    updated_name = result.get("data", {}).get("title") or payload.get("title") or clean_identifier
    return f"Task **{updated_name}** updated successfully!"


@tool
async def delete_task_tool(identifier: str) -> str:
    """Deletes an existing task in DevFlow AI by its title or UUID.

    Args:
        identifier: The task title or UUID to delete.
    """
    clean_identifier = identifier.strip().strip('"').strip("'")
    if not clean_identifier:
        return "Error: An identifier (task title or UUID) must be provided to delete a task."

    # 1. Resolve task
    target = await tasks_client.lookup_task(clean_identifier)
    if not target.get("success") or not target.get("data"):
        return f"Error: Task '{clean_identifier}' was not found. Cannot delete non-existent task."

    task_data = target["data"]
    task_id = task_data.get("id")
    task_title = task_data.get("title", clean_identifier)

    if not task_id:
        return f"Error: Task record found for '{task_title}', but ID could not be extracted."

    # 2. Execute deletion
    result = await tasks_client.delete_task(task_id)
    if not result.get("success"):
        return f"Failed to delete task '{task_title}': {result.get('error', 'Unknown backend error')}"

    return f"Task **{task_title}** (ID: `{task_id}`) has been successfully deleted."