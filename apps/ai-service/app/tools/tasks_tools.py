import os
import re
from typing import Literal, Optional
from langchain_core.tools import tool

from app.clients.projects_client import projects_client
from app.clients.tasks_client import tasks_client
from app.clients.user_client import users_client


from typing import List, Literal, Optional

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

@tool
async def list_tasks_by_user_tool(user_identifier: str) -> str:
  """Lists all tasks currently assigned to a specific user by name, email, or user UUID.

  Args:
      user_identifier: User name, email, or user UUID.
  """
  clean_user = user_identifier.strip().strip('"').strip("'")
  if not clean_user:
    return "Error: User identifier must be provided."

  # 1. Resolve User ID
  user_id = clean_user
  if not UUID_REGEX.match(clean_user):
    user_res = await users_client.find_user(clean_user)
    if not user_res or not user_res.get("success", True):
      return f"Could not find user '{clean_user}'."
    data = user_res.get("data")
    if isinstance(data, dict):
      user_id = data.get("id")
    elif isinstance(data, list) and len(data) > 0:
      user_id = data[0].get("id")
    elif user_res.get("id"):
      user_id = user_res.get("id")

  if not user_id:
    return f"User '{clean_user}' not found."

  # 2. Get all tasks and filter by assigneeId
  res = await tasks_client.list_tasks()
  if not res.get("success"):
    return f"Failed to fetch tasks: {res.get('error')}"

  all_tasks = res.get("data", [])
  user_tasks = [t for t in all_tasks if t.get("assigneeId") == user_id]

  if not user_tasks:
    return f"No tasks are currently assigned to user '{clean_user}'."

  lines = [f"Tasks assigned to **{clean_user}** ({len(user_tasks)} found):"]
  for t in user_tasks:
    lines.append(f"- ID: `{t.get('id')}` | Title: **{t.get('title')}**")

  return "\n".join(lines)

@tool 
async def reassign_user_tasks_tool(
    from_user: str,
    to_user: str,
    project_identifier: Optional[str] = None,
) -> str:
    """Reassigns all tasks from one user to another in DevFlow AI.

    Args:
        from_user: Name, email, or UUID of current assignee (e.g. 'Revathi').
        to_user: Name, email, or UUID of target assignee (e.g. 'Ravi5').
        project_identifier: Optional project name or UUID to restrict reassignment.
    """
    clean_from = from_user.strip().strip('"').strip("'")
    clean_to = to_user.strip().strip('"').strip("'")

    if not clean_from or not clean_to:
        return "Error: Both source user and destination user must be provided."

    # 1. Resolve source user ID
    from_id = clean_from
    if not UUID_REGEX.match(clean_from):
        res_from = await users_client.find_user(clean_from)
        if not res_from or not res_from.get("success", True):
            return f"Error: Source user '{clean_from}' not found."
        data_from = res_from.get("data")
        if isinstance(data_from, dict):
            from_id = data_from.get("id")
        elif isinstance(data_from, list) and len(data_from) > 0:
            from_id = data_from[0].get("id")
        elif res_from.get("id"):
            from_id = res_from.get("id")

    # 2. Resolve destination user ID
    to_id = clean_to
    if not UUID_REGEX.match(clean_to):
        res_to = await users_client.find_user(clean_to)
        if not res_to or not res_to.get("success", True):
            return f"Error: Target user '{clean_to}' not found."
        data_to = res_to.get("data")
        if isinstance(data_to, dict):
            to_id = data_to.get("id")
        elif isinstance(data_to, list) and len(data_to) > 0:
            to_id = data_to[0].get("id")
        elif res_to.get("id"):
            to_id = res_to.get("id")

    if not from_id or not to_id:
        return f"Error: Could not resolve valid IDs for '{clean_from}' or '{clean_to}'."

    # 3. Retrieve tasks
    list_res = await tasks_client.list_tasks(project_id=project_identifier)
    if not list_res.get("success"):
        return f"Error fetching tasks from backend: {list_res.get('error')}"

    tasks = list_res.get("data", [])
    matching_tasks = [t for t in tasks if t.get("assigneeId") == from_id]

    if not matching_tasks:
        return f"No tasks are currently assigned to '{clean_from}'."

    # 4. Patch each task with the new assignee ID
    updated_titles = []
    failed_titles = []

    for task in matching_tasks:
        tid = task.get("id")
        title = task.get("title", tid)
        print("\n========== REASSIGN TASK ==========")
        print("Task ID:", tid)
        print("Task title:", title)
        print("FROM user ID:", from_id)
        print("TO user ID:", to_id)

        patch_res = await tasks_client.update_task(
            tid,
            {"assigneeId": to_id}
        )

        print("PATCH RESULT:", patch_res)
        print("===================================\n")
        if patch_res.get("success"):
            updated_titles.append(title)
        else:
            failed_titles.append(title)

    response_lines = [f"Successfully reassigned {len(updated_titles)} task(s) from **{clean_from}** to **{clean_to}**:"]
    for t in updated_titles:
        response_lines.append(f"- **{t}**")

    if failed_titles:
        response_lines.append(f"\nFailed to update {len(failed_titles)} task(s): {', '.join(failed_titles)}")

    return "\n".join(response_lines)
 
@tool
async def list_tasks_tool(
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None,
    user: Optional[str] = None,
    project_identifier: Optional[str] = None,
) -> str:
    """Lists tasks. Can filter by priority, user, or project. 
    If user is omitted, it retrieves tasks across all users.

    Args:
        priority: Optional priority filter ('low', 'medium', 'high', 'critical').
        user: Optional name, email, or UUID. If not specified, returns tasks for all users.
        project_identifier: Optional project name or UUID to filter tasks.
    """
    clean_user = user.strip().strip('"').strip("'") if user else None
    user_id = None

    # Resolve User ID ONLY if a specific user was provided
    if clean_user and clean_user.lower() not in ("all", "everyone", "any", "none", ""):
        user_id = clean_user
        if not UUID_REGEX.match(clean_user):
            user_res = await users_client.find_user(clean_user)
            if not user_res or not user_res.get("success", True):
                return f"Could not find user '{clean_user}'."
            data = user_res.get("data")
            if isinstance(data, dict):
                user_id = data.get("id")
            elif isinstance(data, list) and len(data) > 0:
                user_id = data[0].get("id")
            elif user_res.get("id"):
                user_id = user_res.get("id")

        if not user_id:
            return f"User '{clean_user}' not found."

    # Fetch tasks
    res = await tasks_client.list_tasks(project_id=project_identifier)
    if not res.get("success"):
        return f"Failed to fetch tasks: {res.get('error')}"

    all_tasks = res.get("data", [])

    # Filter tasks: match user_id only if provided, match priority only if provided
    filtered_tasks = [
        t for t in all_tasks
        if (user_id is None or t.get("assigneeId") == user_id)
        and (priority is None or t.get("priority") == priority)
    ]

    scope_label = f"assigned to **{clean_user}**" if user_id else "across all users"
    priority_label = f" with priority `{priority}`" if priority else ""

    if not filtered_tasks:
        return f"No tasks found {scope_label}{priority_label}."

    lines = [f"Found {len(filtered_tasks)} task(s) {scope_label}{priority_label}:"]
    for t in filtered_tasks:
        lines.append(
            f"- ID: `{t.get('id')}` | Title: **{t.get('title')}** | Priority: `{t.get('priority')}` | Status: `{t.get('status')}`"
        )

    return "\n".join(lines)

@tool
async def reassign_tasks_by_priority_tool(
    priority: Literal["low", "medium", "high", "critical"],
    to_user: str,
    project_identifier: Optional[str] = None,
) -> str:
    """Reassign all tasks matching a priority to a target user."""

    clean_priority = priority.strip().lower()
    clean_to = to_user.strip().strip('"').strip("'")

    # Resolve target user
    to_id = clean_to

    if not UUID_REGEX.match(clean_to):
        res_to = await users_client.find_user(clean_to)

        if not res_to or not res_to.get("success", True):
            return f"Error: Target user '{clean_to}' not found."

        data_to = res_to.get("data")

        if isinstance(data_to, dict):
            to_id = data_to.get("id")
        elif isinstance(data_to, list) and data_to:
            to_id = data_to[0].get("id")
        elif res_to.get("id"):
            to_id = res_to.get("id")

    if not to_id:
        return f"Error: Could not resolve target user '{clean_to}'."

    # Get tasks
    list_res = await tasks_client.list_tasks(
        project_id=project_identifier
    )

    if not list_res.get("success"):
        return f"Error fetching tasks: {list_res.get('error')}"

    tasks = list_res.get("data", [])

    # Filter by priority
    matching_tasks = [
        task
        for task in tasks
        if str(task.get("priority", "")).lower() == clean_priority
        and task.get("assigneeId") != to_id
    ]

    if not matching_tasks:
        return (
            f"No {clean_priority} priority tasks need to be "
            f"reassigned to **{clean_to}**."
        )

    updated_titles = []
    failed_titles = []

    for task in matching_tasks:
        task_id = task.get("id")
        title = task.get("title", task_id)

        patch_res = await tasks_client.update_task(
            task_id,
            {"assigneeId": to_id},
        )

        if not patch_res.get("success"):
            failed_titles.append(
                f"{title} ({patch_res.get('error', 'Unknown error')})"
            )
            continue

        # Verify persistence
        verify_res = await tasks_client.get_task(task_id)

        actual_assignee = (
            verify_res.get("data", {}).get("assigneeId")
            if verify_res.get("success")
            else None
        )

        if actual_assignee == to_id:
            updated_titles.append(title)
        else:
            failed_titles.append(
                f"{title} (database verification failed)"
            )

    response_lines = [
        f"Successfully reassigned {len(updated_titles)} "
        f"{clean_priority} priority task(s) to **{clean_to}**:"
    ]

    for title in updated_titles:
        response_lines.append(f"- **{title}**")

    if failed_titles:
        response_lines.append(
            f"\nFailed to update {len(failed_titles)} task(s):"
        )

        for title in failed_titles:
            response_lines.append(f"- **{title}**")

    return "\n".join(response_lines)

@tool
async def resolve_project_id(project_identifier: str) -> tuple[str | None, str | None]:
    """Return (project UUID, error message) for a project name or UUID."""
    clean_project = project_identifier.strip().strip('"').strip("'")

    if not clean_project:
        return None, "Project identifier is required."

    if UUID_REGEX.match(clean_project):
        return clean_project, None

    result = await projects_client.lookup_project(clean_project)

    if not result.get("success") or not result.get("data"):
        return None, f"Project '{clean_project}' was not found."

    project_id = result["data"].get("id")

    if not project_id or not UUID_REGEX.match(project_id):
        return None, f"Could not resolve a valid UUID for '{clean_project}'."

    return project_id, None


@tool 
async def delete_tasks_tool(
    scope: Literal["all", "unassigned", "project", "assignee"],
    project_identifier: Optional[str] = None,
    assignee_identifier: Optional[str] = None,
    confirm: bool = False,
    confirmed_task_ids: Optional[List[str]] = None,
) -> str:
    """Preview or safely delete multiple DevFlow AI tasks.

    Args:
        scope: 'all', 'unassigned', 'project', or 'assignee'.
        project_identifier: Required for project scope.
        assignee_identifier: Required for assignee scope; accepts
            a user name, email, or UUID.
        confirm: True only after explicit user confirmation.
        confirmed_task_ids: Exact task IDs shown in the preview
            and explicitly approved by the user.
    """
    project_id = None
    project_name = None
    assignee_id = None
    assignee_name = None

    # Resolve project scope.
    if scope == "project":
        if not project_identifier:
            return "Error: Specify a project name or UUID." 
            clean_project = project_identifier.strip().strip('"').strip("'")

            if not clean_project:
                return "Error: Specify a project name or UUID."

            if UUID_REGEX.match(clean_project):
                project_id = clean_project
            else:
                proj_res = await projects_client.lookup_project(clean_project)

                if not proj_res.get("success") or not proj_res.get("data"):
                    return f"Error: Project '{clean_project}' was not found."

                project_id = proj_res["data"].get("id")

                if not project_id or not UUID_REGEX.match(project_id):
                    return f"Error: Could not resolve a valid UUID for '{clean_project}'."

            project_name = clean_project


        project_name = project_identifier.strip()

    # Resolve assignee scope.
    elif scope == "assignee":
        if not assignee_identifier:
            return "Error: Specify the assignee name, email, or UUID."

        # Use your existing user-resolution helper here.
        # It should return (user_id, error), like resolve_project_id.
        assignee_id, error = await resolve_user_id(
            assignee_identifier
        )
        if error:
            return error
        if not assignee_id:
            return "Error: Could not resolve the assignee."

        assignee_name = assignee_identifier.strip()

    elif scope not in ("all", "unassigned"):
        return "Error: Unsupported deletion scope."

    # Fetch tasks.
    result = await tasks_client.list_tasks(project_id=project_id)

    if not result.get("success"):
        return f"Error fetching tasks: {result.get('error')}"

    tasks = result.get("data") or []

    # Apply the requested scope.
    if scope == "unassigned":
        tasks = [
            task for task in tasks
            if not task.get("assigneeId")
        ]

    elif scope == "assignee":
        tasks = [
            task for task in tasks
            if str(task.get("assigneeId") or "") == str(assignee_id)
        ]

    # Normalize task IDs and fail closed if IDs are missing
    # or duplicated; deletion must be unambiguous.
    task_ids = [str(task.get("id") or "") for task in tasks]

    if any(not task_id for task_id in task_ids):
        return "Error: A matching task has no ID. Nothing was deleted."

    if len(task_ids) != len(set(task_ids)):
        return "Error: Duplicate task IDs found. Nothing was deleted."

    if not tasks:
        return "No matching tasks found. Nothing was deleted."

    current_ids = set(task_ids)

    # Phase 1: Preview only.
    if not confirm:
        lines = [
            f"Deletion preview: {len(tasks)} task(s) match scope '{scope}'."
        ]

        if project_name:
            lines.append(f"Project: {project_name}")

        if assignee_name:
            lines.append(f"Assignee: {assignee_name} (ID: {assignee_id})")

        # Include every ID so the exact preview can be confirmed.
        for task in tasks:
            lines.append(
                f"- {task.get('title', 'Untitled')} "
                f"(ID: {task.get('id')})"
            )

        lines.append(
            "Nothing has been deleted. After the user explicitly "
            "confirms this preview, call again with confirm=True "
            "and confirmed_task_ids containing exactly these IDs."
        )
        return "\n".join(lines)

    # Phase 2: Require the exact approved ID set.
    if not confirmed_task_ids:
        return (
            "Deletion blocked: confirmed_task_ids is required. "
            "Preview the tasks and obtain explicit confirmation first."
        )

    approved_ids = [str(task_id) for task_id in confirmed_task_ids]

    if len(approved_ids) != len(set(approved_ids)):
        return "Deletion blocked: duplicate confirmed IDs. Nothing was deleted."

    if set(approved_ids) != current_ids:
        return (
            "Deletion blocked: the current matching task set differs "
            "from the confirmed preview. Nothing was deleted. "
            "Generate a new preview and request confirmation again."
        )

    # Delete only the exact approved tasks.
    task_by_id = {str(task["id"]): task for task in tasks}
    deleted = []
    failed = []

    for task_id in approved_ids:
        task = task_by_id[task_id]
        title = task.get("title", task_id)

        try:
            response = await tasks_client.delete_task(task_id)

            if response.get("success"):
                deleted.append(str(title))
            else:
                failed.append(str(title))
        except Exception:
            failed.append(str(title))

    return (
        f"Deletion result for scope '{scope}': "
        f"{len(deleted)} deleted, {len(failed)} failed.\n"
        + (
            "Failed tasks: " + ", ".join(failed)
            if failed else "All approved matching tasks were deleted."
        )
    )
 

async def resolve_user_id(identifier: str):
    """Resolve a user name, email, or UUID to a user ID."""
    clean_identifier = identifier.strip().strip('"').strip("'")

    if not clean_identifier:
        return None, "Error: Specify a user name, email, or UUID."

    if UUID_REGEX.match(clean_identifier):
        return clean_identifier, None

    try:
        user_res = await users_client.find_user(clean_identifier)
    except Exception as exc:
        return None, f"Error looking up user: {type(exc).__name__}"

    if not user_res or not user_res.get("success", True):
        return None, f"Error: User '{clean_identifier}' was not found."

    data = user_res.get("data")

    if isinstance(data, dict):
        user_id = data.get("id")
    elif isinstance(data, list) and len(data) == 1:
        user_id = data[0].get("id")
    elif isinstance(data, list) and len(data) > 1:
        return None, (
            f"Error: Multiple users matched '{clean_identifier}'. "
            "Use an email address or UUID."
        )
    else:
        user_id = user_res.get("id")

    if not user_id:
        return None, f"Error: Could not resolve user '{clean_identifier}'."

    return str(user_id), None
