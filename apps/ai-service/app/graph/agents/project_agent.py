from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent 
from app.llm import get_llm
from app.tools.projects_tools import create_project_tool, lookup_project_tool
from app.tools.user_tools import lookup_user_tool

PROJECT_AGENT_SYSTEM_PROMPT = """You are the DevFlow AI Project Management Agent.
Available tools:
- lookup_project_tool(identifier: str)
- create_project_tool(name: str, description: str, owner_id: str = None, priority: str = "low", status: str = "active")
- lookup_user_tool(identifier: str)

==================================================
MANDATORY TWO-PHASE CREATION PROTOCOL
==================================================
You are strictly FORBIDDEN from calling `create_project_tool` in your first turn if a project name is provided.
Every project creation MUST execute as a sequential two-phase transaction:

PHASE 1: DUPLICATE VERIFICATION (MANDATORY FIRST STEP)
1. Extract the intended project `name` from the user message.
2. Call ONLY `lookup_project_tool(identifier=name)`. 
   - DO NOT call `create_project_tool` in parallel.
   - DO NOT guess whether the project exists.
3. Wait for the tool output before taking ANY further action.

PHASE 2: BRANCHING EXECUTION (AFTER LOOKUP RETURNS)
- CASE A: Project is FOUND (tool returns project details, ID, or "Project Found"):
  * HARD STOP.
  * DO NOT CALL `create_project_tool`.
  * Respond immediately to the user:
    "A project with the name '[Name]' already exists (ID: `[ID]`). Please choose a unique project name."

- CASE B: Project is NOT FOUND (tool returns "not found" or 404):
  * You may now safely proceed to call `create_project_tool(name=..., description=...)`.
  * If the user also requested an owner by name, call `lookup_user_tool` before calling `create_project_tool`.

VIOLATION RULE:
If you call `create_project_tool` without having first called `lookup_project_tool` in the current conversation turn, the transaction is considered invalid

CRITICAL ERROR HANDLING:
- If a tool returns an error containing "already exists", state:
  "A project named '[Name]' already exists. Please choose a different name."
- NEVER apologize or say "I cannot check if it exists due to an internal error." 
- Output the exact error returned by the tool.

"""

project_tools = [lookup_project_tool, create_project_tool, lookup_user_tool]

project_agent_runnable = create_react_agent(
    model=get_llm(temperature=0),
    tools=project_tools,
    prompt=SystemMessage(content=PROJECT_AGENT_SYSTEM_PROMPT),
)

async def project_agent_node(state):
    result = await project_agent_runnable.ainvoke(state)
    messages = result.get("messages", [])
    
    crud_payload = None
    action_type = "none"

    # Find the tool call that was executed during this turn
    for msg in reversed(messages):
        # In LangChain, tool calls reside on AIMessage
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.get("name") == "create_project_tool":
                    action_type = "create_project"
                    crud_payload = tc.get("args", {})
                    break
        if crud_payload:
            break

    return {
        "messages": [messages[-1]],
        "next_node": "ProjectAgent",
        "action_type": action_type,
        "crud_payload": crud_payload,
    }