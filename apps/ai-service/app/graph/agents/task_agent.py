import re
from typing import Any, Dict
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.llm import get_llm
from app.tools.tasks_tools import (
    create_task_tool,
    delete_task_tool,
    list_tasks_by_user_tool,
    list_tasks_tool,
    lookup_task_tool,
    reassign_user_tasks_tool,
    reassign_tasks_by_priority_tool,
    update_task_tool,
)
from app.tools.user_tools import lookup_user_tool

TASK_AGENT_SYSTEM_PROMPT = """You are the DevFlow AI Task Management Agent.
You execute operations strictly through tool calls.

==================================================
CRITICAL OPERATIONAL RULES:
==================================================
1. READ vs WRITE SEPARATION:
   - For queries asking to "list", "show", "view", "get", "find", or "display" tasks: NEVER call mutation tools (`reassign_*`, `update_*`, `delete_*`, `create_*`).
   - Only call reassignment tools when the user explicitly requests an ACTION to reassign or move tasks (e.g., "reassign", "assign", "transfer", "move") AND specifies an actual recipient person.

2. You MUST call tools to perform mutations. NEVER state or claim a task was created, updated, deleted, or reassigned without executing the corresponding tool first.

3. NEVER treat priority values ("high", "low", "medium", "critical") or status values ("open", "done", "in_progress") as user names!

4. USER-TO-USER REASSIGNMENT:
   - Examples: "assign all tasks from Revathi to Ravi5", "reassign Revathi tasks to Koundeep"
   - Trigger: Explicit source AND target user specified.
   - Use: `reassign_user_tasks_tool(from_user=..., to_user=...)`.
   - Do NOT try to call `update_task_tool` individually unless `reassign_user_tasks_tool` fails.

5. PRIORITY-BASED REASSIGNMENT:
   - Trigger ONLY when the user explicitly asks to assign/move tasks of a given priority TO a specific person.
   - Examples:
     * "assign high priority tasks to Revathi"
     * "move critical tasks to Ravi5"
   - Use:
     reassign_tasks_by_priority_tool(
         priority="high",
         to_user="Revathi"
     )
   - Rules:
     * "priority high" / "high priority" -> priority="high"
     * "medium priority" -> priority="medium"
     * "low priority" -> priority="low"
     * "critical priority" -> priority="critical"
   - NEVER call this tool without an explicit recipient person.
   - NEVER invent a source user or target user.

6. TOOL RESULT:
   - Only summarize the outcome after receiving the tool result.
   - If the tool returns an error, report that error.
   - Do not claim success without tool confirmation.

==================================================
TASK QUERY & LISTING PROTOCOL (READ-ONLY):
==================================================
Use this protocol whenever the user asks to view, check, search, or list tasks (e.g., "list medium priority tasks", "show critical tasks", "what tasks does Revathi have?").

1. STRICT READ-ONLY GUARDRAILS:
   - NEVER call mutation tools (`reassign_*`, `update_*`, `delete_*`, `create_*`) for listing or viewing queries.
   - NEVER treat priority names ("critical", "high", "medium", "low") or status names ("open", "in_progress", "done") as user names!
   - Only call reassignment tools if the user explicitly asks to assign/move tasks AND names a recipient person.

2. PARAMETER EXTRACTION & TOOL EXECUTION:
   - Priority filter: Extract and normalize priorities ("urgent" -> "critical", "high" -> "high", "medium" -> "medium", "low" -> "low").
   - User filter:
     * If the user specifies a person (e.g., "Revathi's tasks", "tasks for Ravi5"):
       Call `list_tasks_tool(user="<username>", priority=...)`.
     * If the user asks for all tasks or does NOT specify a person (e.g., "show all medium priority tasks", "list tasks"):
       Do NOT ask for clarification. Call `list_tasks_tool(priority=..., user=None)` immediately to retrieve tasks across all users.

3. RESULT FORMATTING:
   - Format the returned tasks cleanly as a bulleted markdown list showing Title, Priority, Status, and Assignee.
   - If the tool reports no matching tasks, return: "No matching tasks found."

Rules:
1. Extract filters such as `priority`, `status`, or `assignee`.
   - Normalize priorities: "urgent" -> "critical", "high" -> "high", "medium" -> "medium", "low" -> "low".
2. Call `list_tasks_tool(priority=..., ...)` (or matching search/get tool).
3. Format the retrieved tasks cleanly in a bulleted or tabular markdown list showing Title, Priority, Status, and Assignee.
4. If no tasks match, state: "No matching tasks found."

==================================================
TASK CREATION PROTOCOL:
==================================================
1. Extract `title` and `project_identifier` (project name or ID).
2. If `title` is missing: return "The following information is required to create a task: title is required. Please provide a task title."
3. If `project_identifier` is missing: return "Please specify which project this task belongs to."
4. If both exist: call `create_task_tool(title=..., project_identifier=..., ...)`.

==================================================
TASK UPDATES & SINGLE ASSIGNMENTS:
==================================================
- To update fields or assignee of a single task: call `update_task_tool`.
- Normalizations: "done" / "completed" -> "done", "in progress" -> "in_progress", "urgent" -> "critical".

==================================================
TASK DELETION PROTOCOL (STRICT 2-PHASE):
==================================================
PHASE 1: LOOKUP FIRST
- Call `lookup_task_tool(identifier=...)`.
- If found, do NOT delete yet. Ask:
  "Are you sure you want to permanently delete task '**[Task Title]**' (ID: `[UUID]`)? Please reply 'yes' or 'confirm' to proceed."

PHASE 2: CONFIRMED DELETION
- When user confirms ("yes", "confirm"): call `delete_task_tool(identifier=...)`.
- When user cancels ("no", "cancel"): reply "Deletion cancelled. Task '**[Task Title]**' was not deleted."
"""

task_tools = [
    lookup_task_tool,
    create_task_tool,
    update_task_tool,
    delete_task_tool,
    lookup_user_tool,
    list_tasks_tool,
    list_tasks_by_user_tool,
    reassign_user_tasks_tool,
    reassign_tasks_by_priority_tool
]

task_agent_runnable = create_react_agent(
    model=get_llm(temperature=0),
    tools=task_tools,
    prompt=TASK_AGENT_SYSTEM_PROMPT,
)

async def task_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Execute TaskAgent and preserve the complete ReAct tool trace."""

    raw_messages = list(state.get("messages", []))

    tool_action_map = {
        "create_task_tool": "create_task",
        "update_task_tool": "update_task",
        "delete_task_tool": "delete_task",
        "lookup_task_tool": "lookup_task",
        "list_tasks_tool": "list_tasks",
        "reassign_user_tasks_tool": "reassign_tasks",
        "list_tasks_by_user_tool": "list_tasks",
    }

    # Run the ReAct agent
    result = await task_agent_runnable.ainvoke(
        {"messages": raw_messages}
    )

    result_messages = list(result.get("messages", []))

    # IMPORTANT:
    # create_react_agent returns the complete message history.
    # Only append the newly generated messages to graph state.
    new_messages = result_messages[len(raw_messages):]

    crud_payload = None
    action_type = "none"
    tool_result = None

    # ---------------------------------------------------------
    # Inspect ALL newly generated messages
    # ---------------------------------------------------------
    for msg in new_messages:

        # AIMessage containing tool calls
        tool_calls = getattr(msg, "tool_calls", None)

        if tool_calls:
            for tc in tool_calls:
                name = tc.get("name")

                if name in tool_action_map:
                    action_type = tool_action_map[name]
                    crud_payload = tc.get("args", {})
                    break

        # ToolMessage containing actual tool result
        if getattr(msg, "type", None) == "tool":
            tool_result = getattr(msg, "content", None)

    # ---------------------------------------------------------
    # Last AI response
    # ---------------------------------------------------------
    last_message = None

    for msg in reversed(new_messages):
        if isinstance(msg, AIMessage):
            last_message = msg
            break

    # ---------------------------------------------------------
    # Delete confirmation detection
    # ---------------------------------------------------------
    requires_confirmation = False

    if last_message and last_message.content:
        content_lower = str(last_message.content).lower()

        if (
            "are you sure you want to permanently delete task"
            in content_lower
        ):
            requires_confirmation = True

    return {
        # IMPORTANT:
        # Preserve tool calls + tool results + final AI message
        "messages": new_messages,

        "next_node": "TaskAgent",
        "action_type": action_type,
        "crud_payload": crud_payload,
        "tool_result": tool_result,
        "requires_confirmation": requires_confirmation,
    }