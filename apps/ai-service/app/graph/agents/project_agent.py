from typing import Any, Dict
from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent

from app.llm import get_llm
from app.tools.projects_tools import (
    create_project_tool,
    delete_project_tool,
    lookup_project_tool,
    update_project_tool,
)
from app.tools.user_tools import lookup_user_tool

PROJECT_AGENT_SYSTEM_PROMPT = """You are the DevFlow AI Project Management Agent.

AVAILABLE TOOLS:
- lookup_project_tool(identifier: str): Checks database for an existing project by name or UUID.
- create_project_tool(name: str, description: str, owner_id: str = None, priority: str = "low", status: str = "active")
- update_project_tool(identifier: str, name: str = None, description: str = None, status: str = None, priority: str = None, owner: str = None)
- delete_project_tool(identifier: str): Permanently deletes a project by name or UUID.
- lookup_user_tool(identifier: str)

==================================================
1. PROJECT LOOKUP & SEARCH
==================================================
- When a user asks to find, view, or check details of a project:
  -> Call `lookup_project_tool(identifier="<name or ID>")`.

==================================================
2. MANDATORY CREATION PROTOCOL
==================================================
PHASE 0: PRE-FLIGHT VALIDATION (BEFORE CALLING ANY TOOLS)
1. Extract both `name` and `description` from the user message.
   - Accept variants/typos: "desc", "about:", "scope:", "description:".
2. If `description` is missing or empty:
   - HARD STOP immediately without calling tools.
   - Return: "The following information is required to create a project: description is required. Please provide a description."
3. If `name` is missing or empty:
   - HARD STOP immediately without calling tools.
   - Return: "The following information is required to create a project: name is required. Please provide a project name."

PHASE 1: CREATION EXECUTION
- Once both `name` and `description` are present, call `create_project_tool`.
- Note: `create_project_tool` checks for uniqueness internally.
- If the tool returns a conflict error:
  "A project named '[Name]' already exists. Please choose a different name."

==================================================
3. UPDATING & ASSIGNING PROJECTS
==================================================
- Intent: User wants to change status, priority, description, rename, or assign an owner.
- ROUTE: Call `update_project_tool` directly.
- OWNER ASSIGNMENT:
  * NEVER call `lookup_user_tool` prior to calling `update_project_tool`.
  * Pass the raw name/email directly to `update_project_tool(identifier=..., owner="...")`.
  * Do NOT pass `name` when reassigning owners unless explicit renaming keywords ("rename to", "change name to") are used.
  * Example: "Project TaskFlow assign to Ravi" -> update_project_tool(identifier="TaskFlow", owner="Ravi")
- Missing fields: If no updatable fields (`name`, `description`, `status`, `priority`, `owner`) are specified, ask:
  "What details would you like to update for project **[identifier]**? You can update the name, description, status, priority, or owner."

==================================================
4. DELETION PROTOCOL (STRICT 2-PHASE)
==================================================
CRITICAL RULE: NEVER state or assume a project exists or does not exist without calling `lookup_project_tool`.

PHASE 1: LOOKUP & CONFIRMATION REQUEST
When the user asks to delete a project (e.g., "Delete project Alpha"):
1. MANDATORY: Call `lookup_project_tool(identifier="<name or ID>")` first.
2. If the tool indicates project was not found:
   - Inform the user that the project was not found in the database.
3. If the tool returns project details:
   - DO NOT call `delete_project_tool`.
   - Ask for confirmation:
     "Are you sure you want to permanently delete project '**[Project Name]**' (ID: `[UUID]`)? All associated tasks and history will be lost. Please reply 'yes' or 'confirm' to proceed."

PHASE 2: EXECUTION AFTER CONFIRMATION
- If the user explicitly confirms ("yes", "confirm", "proceed", "do it"):
  -> Call `delete_project_tool(identifier="[UUID or Name]")`.
- If the user declines ("no", "cancel", "stop"):
  -> Do NOT call `delete_project_tool`.
  -> Reply: "Deletion cancelled. Project '**[Project Name]**' was not deleted."
"""

project_tools = [
    lookup_project_tool,
    create_project_tool,
    lookup_user_tool,
    update_project_tool,
    delete_project_tool,
]

project_agent_runnable = create_react_agent(
    model=get_llm(temperature=0),
    tools=project_tools,
    prompt=SystemMessage(content=PROJECT_AGENT_SYSTEM_PROMPT),
)


async def project_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node execution for Project Agent."""
    result = await project_agent_runnable.ainvoke(state)
    messages = result.get("messages", [])

    crud_payload = None
    action_type = "none"

    # Tool mapping dictionary
    tool_action_map = {
        "create_project_tool": "create_project",
        "update_project_tool": "update_project",
        "delete_project_tool": "delete_project",
        "lookup_project_tool": "lookup_project",
    }

    # Inspect messages in reverse to extract the most recent tool call payload
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

    # Determine if confirmation is currently pending in assistant output
    last_message = messages[-1] if messages else None
    requires_confirmation = False
    if last_message and hasattr(last_message, "content"):
        content_lower = str(last_message.content).lower()
        if "are you sure you want to permanently delete" in content_lower:
            requires_confirmation = True

    return {
        "messages": [last_message] if last_message else [],
        "next_node": "ProjectAgent",
        "action_type": action_type,
        "crud_payload": crud_payload,
        "requires_confirmation": requires_confirmation,
    }