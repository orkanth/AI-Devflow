from __future__ import annotations

import re

from app.schemas import AgentTrace, GraphState, ToolCall
from app.tools.nestjs_tools import NestJsTools


def run_task_agent(state: GraphState, tools: NestJsTools) -> GraphState:
    intent = _intent(state.message)
    tool_name, args, result, answer = _execute(intent, state, tools)
    state.answer = answer
    if isinstance(result, dict) and result.get("error"):
        state.answer += f" NestJS error: {result['error']}"
    state.trace.append(
        AgentTrace(
            agent="task",
            reason=f"Workspace write intent: {intent}.",
            tool_calls=[ToolCall(tool=tool_name, args=args, result=result)],
        )
    )
    return state


def _intent(message: str) -> str:
    text = message.lower()
    if re.search(r"assign", text):
        return "assign_task"
    if re.search(r"(delete|remove).*(user)", text):
        return "delete_user"
    if re.search(r"(delete|remove).*(project)", text):
        return "delete_project"
    if re.search(r"(delete|remove).*(task|ticket)", text):
        return "delete_task"
    if re.search(r"(create|add).*(user|member)", text):
        return "create_user"
    if re.search(r"(create|add).*(project)", text):
        return "create_project"
    if re.search(r"(edit|update|rename).*(task)", text):
        return "update_task"
    return "create_task"


def _execute(intent: str, state: GraphState, tools: NestJsTools):
    message = state.message
    if intent == "create_user":
        name = _quoted(message) or _after(message, r"user[:\s]+") or "New teammate"
        email = f"{name.lower().replace(' ', '.')}@devflow.ai"
        result = tools.create_user(name=name, email=email, role="engineer")
        return "create_user", {"name": name, "email": email}, result, f'Created user "{name}".'

    if intent == "create_project":
        name = _quoted(message) or _after(message, r"project[:\s]+") or "New project"
        users = tools.list_users()
        owner_id = users[0]["id"] if users else None
        result = tools.create_project(name=name, description=message, owner_id=owner_id or "")
        return "create_project", {"name": name}, result, f'Created project "{name}".'

    if intent == "assign_task":
        task = _find_task(tools, message)
        user = _find_user(tools, message)
        if not task or not user:
            return "assign_task", {}, {"error": "Need a known task title and user name"}, "Could not assign: missing task or user."
        result = tools.update_task(task["id"], assignee_id=user["id"])
        return (
            "update_task",
            {"task_id": task["id"], "assignee_id": user["id"]},
            result,
            f'Assigned "{task["title"]}" to {user["name"]}.',
        )

    if intent == "delete_task":
        task = _find_task(tools, message)
        if not task:
            return "delete_task", {}, {"error": "task not found"}, "Could not find that task to delete."
        result = tools.delete_task(task["id"])
        return "delete_task", {"task_id": task["id"]}, result, f'Deleted task "{task["title"]}".'

    if intent == "delete_project":
        project = _find_project(tools, message)
        if not project:
            return "delete_project", {}, {"error": "project not found"}, "Could not find that project to delete."
        result = tools.delete_project(project["id"])
        return "delete_project", {"project_id": project["id"]}, result, f'Deleted project "{project["name"]}".'

    if intent == "delete_user":
        user = _find_user(tools, message)
        if not user:
            return "delete_user", {}, {"error": "user not found"}, "Could not find that user to delete."
        result = tools.delete_user(user["id"])
        return "delete_user", {"user_id": user["id"]}, result, f'Deleted user "{user["name"]}".'

    if intent == "update_task":
        task = _find_task(tools, message)
        title = _quoted(message)
        if not task:
            return "update_task", {}, {"error": "task not found"}, "Could not find that task to update."
        fields = {"title": title} if title else {"description": message}
        result = tools.update_task(task["id"], **fields)
        return "update_task", {"task_id": task["id"], **fields}, result, f'Updated task "{task["title"]}".'

    project_id = state.project_id
    if not project_id:
        projects = tools.list_projects()
        project_id = projects[0]["id"] if projects else None
    title = _extract_title(message)
    assignee = _find_user(tools, message)
    result = tools.create_task(
        project_id=project_id or "",
        title=title,
        description=f"Created by LangGraph task agent from: {message}",
        assignee_id=assignee["id"] if assignee else None,
    )
    answer = f'Task agent created "{title}" via NestJS tool calling.'
    if assignee:
        answer += f" Assigned to {assignee['name']}."
    return "create_task", {"project_id": project_id, "title": title}, result, answer


def _quoted(message: str) -> str | None:
    match = re.search(r"['\"]([^'\"]+)['\"]", message)
    return match.group(1).strip() if match else None


def _after(message: str, pattern: str) -> str | None:
    match = re.search(pattern + r"['\"]?([^'\"\n.]+)", message, flags=re.I)
    return match.group(1).strip() if match else None


def _extract_title(message: str) -> str:
    return _quoted(message) or _after(message, r"task[:\s]+") or message.strip()[:80]


def _find_task(tools: NestJsTools, message: str) -> dict | None:
    quoted = _quoted(message)
    tasks = tools.list_tasks()
    if quoted:
        for task in tasks:
            if quoted.lower() in task.get("title", "").lower():
                return task
    text = message.lower()
    for task in tasks:
        title = task.get("title", "").lower()
        if title and title in text:
            return task
    return tasks[0] if tasks else None


def _find_user(tools: NestJsTools, message: str) -> dict | None:
    users = tools.list_users()
    text = message.lower()
    for user in users:
        if user.get("name", "").lower() in text:
            return user
    return None


def _find_project(tools: NestJsTools, message: str) -> dict | None:
    quoted = _quoted(message)
    projects = tools.list_projects()
    if quoted:
        for project in projects:
            if quoted.lower() in project.get("name", "").lower():
                return project
    text = message.lower()
    for project in projects:
        name = project.get("name", "").lower()
        if name and name in text:
            return project
    return None
