from typing import Any, Dict
from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent

from app.llm import get_llm
from app.tools.tasks_tools import (
    create_task_tool,
    delete_task_tool,
    lookup_task_tool,
    update_task_tool,
)
from app.tools.user_tools import lookup_user_tool

TASK_AGENT_SYSTEM_PROMPT = """You are the DevFlow AI Task Management Agent.

AVAILABLE TOOLS:
- lookup_task_tool(identifier: str): Checks database for an existing task by title or UUID.
- create_task_tool(title: str, project_identifier: str, description: str = None, assignee: str = None, priority: str = "medium", status: str = "todo")
- update_task_tool(identifier: str, title: str = None, description: str = None, status: str = None, priority: str = None, assignee: str = None)
- delete_task_tool(identifier: str): Permanently removes a task by title or UUID.
- lookup_user_tool(identifier: str)

==================================================
1. TASK LOOKUP & SEARCH
==================================================
- When a user asks to view, check, or find a task:
  -> Call `lookup_task_tool(identifier="<title or UUID>")`.

==================================================
2. TASK CREATION PROTOCOL
==================================================
PRE-FLIGHT VALIDATION:
1. Extract `title` and `project_identifier` (project name or ID) from the prompt.
2. If `title` is missing:
   - HARD STOP. Return: "The following information is required to create a task: title is required. Please provide a task title."
3. If `project_identifier` is missing:
   - HARD STOP. Return: "Please specify which project this task belongs to."
4. When both `title` and `project_identifier` are present:
   - Call `create_task_tool(title=..., project_identifier=..., ...)`.

==================================================
3. TASK UPDATES & ASSIGNMENTS
==================================================
- Intent: User wants to change status, priority, description, title, or assign a task.
- ROUTE: Call `update_task_tool`.
- ASSIGNEE RULES:
  * Pass raw user name/email directly to `assignee` in `update_task_tool`. Do not call `lookup_user_tool` first.
  * Status normalizations: "done" / "completed" -> "done", "in progress" -> "in_progress", "review" -> "in_review", "block" -> "blocked".
  * Priority normalizations: "urgent" -> "critical".
- Missing fields: If no target fields are specified, ask what they would like to update.

==================================================
4. TASK DELETION PROTOCOL (STRICT 2-PHASE)
==================================================
CRITICAL RULE: NEVER claim a task exists or does not exist without calling `lookup_task_tool`.

PHASE 1: LOOKUP & CONFIRMATION
When the user asks to delete a task (e.g., "Delete task BugFix"):
1. MANDATORY: Call `lookup_task_tool(identifier="<title or ID>")` first.
2. If not found by tool:
   - Inform the user that the task was not found in the database.
3. If found by tool:
   - DO NOT call `delete_task_tool`.
   - Ask for confirmation:
     "Are you sure you want to permanently delete task '**[Task Title]**' (ID: `[UUID]`)? Please reply 'yes' or 'confirm' to proceed."

PHASE 2: CONFIRMED DELETION
- When user confirms ("yes", "confirm", "proceed", "do it"):
  -> Call `delete_task_tool(identifier="[UUID or Title]")`.
- If user cancels ("no", "cancel", "stop"):
  -> Do NOT call `delete_task_tool`.
  -> Reply: "Deletion cancelled. Task '**[Task Title]**' was not deleted."
"""

task_tools = [
    lookup_task_tool,
    create_task_tool,
    update_task_tool,
    delete_task_tool,
    lookup_user_tool,
]

task_agent_runnable = create_react_agent(
    model=get_llm(temperature=0),
    tools=task_tools,
    prompt=SystemMessage(content=TASK_AGENT_SYSTEM_PROMPT),
)


async def task_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node execution for Task Agent."""
    result = await task_agent_runnable.ainvoke(state)
    messages = result.get("messages", [])

    crud_payload = None
    action_type = "none"

    tool_action_map = {
        "create_task_tool": "create_task",
        "update_task_tool": "update_task",
        "delete_task_tool": "delete_task",
        "lookup_task_tool": "lookup_task",
    }

    # Extract the executed tool arguments
    for msg in reversed(messages):
        tool_calls = getattr(msg, "tool_calls", None)
        if tool_calls:
            for tc in tool_calls:
                name = tc.get("name")
                if name in tool_action_map:
                    action_type = tool_action_map[name]
                    crud_payload = tc.get("args", {})
                    break
        if crud_payload:
            break

    # Check for pending confirmation in assistant response
    last_message = messages[-1] if messages else None
    requires_confirmation = False
    if last_message and hasattr(last_message, "content"):
        content_lower = str(last_message.content).lower()
        if "are you sure you want to permanently delete task" in content_lower:
            requires_confirmation = True

    return {
        "messages": [last_message] if last_message else [],
        "next_node": "TaskAgent",
        "action_type": action_type,
        "crud_payload": crud_payload,
        "requires_confirmation": requires_confirmation,
    }