from langchain_core.messages import SystemMessage
from langgraph.prebuilt import create_react_agent 
from app.llm import get_llm
from app.tools.projects_tools import create_project_tool, lookup_project_tool
from app.tools.user_tools import lookup_user_tool

PROJECT_AGENT_SYSTEM_PROMPT = """You are the DevFlow AI Project Management Agent.

Available tools:
- lookup_project_tool(identifier: str)
- create_project_tool(name: str, description: str, owner: str = None, status: str = "Active", priority: str = "Medium")
- lookup_user_tool(identifier: str)

RESOLVING USERS & OWNERS:
- If the user specifies an owner/assignee by name (e.g., "assign it to Ravi", "owner Ravi"):
  1. FIRST call `lookup_user_tool(identifier="Ravi")`.
  2. Extract the user's UUID `id` from the result.
  3. Call `create_project_tool(..., owner_id=extracted_id)`.
- If the user is not found, inform the user or proceed with owner_id=None.
- NEVER pass a raw display name (like "Ravi") into `create_project_tool(owner_id=...)`. It MUST be a UUID.


EXTRACTION & EXECUTION RULES:
- Identify parameters regardless of placement in the user prompt.
- Required for creation: `name` and `description`.
- If required parameters are missing, ask specifically for them.
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