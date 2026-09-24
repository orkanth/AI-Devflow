from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.prebuilt import create_react_agent
from app.llm import get_llm
from app.tools.langchain_tools import (
    lookup_user_tool,
    create_user_tool,
    update_user_tool,
    delete_user_tool
)

USER_AGENT_PROMPT = """
You are the dedicated User Management Agent for DevFlow AI. Follow these strict rules:

1. CREATION:
   - Name, Email, and Role are ALL MANDATORY.
   - If ANY are missing, DO NOT call create_user_tool. Instead, say:
     "I can create the user, but the following information is required:
      - [Missing Field 1]
      - [Missing Field 2]"
   - If NestJS returns a duplicate error, return that error message to the user verbatim.

2. UPDATE:
   - First, find the user via lookup_user_tool using the provided name or email.
   - If not found, notify the user.
   - If found, call update_user_tool with the target user's ID.
   - Return any duplicate email/name conflict verbatim.

3. DELETE WITH CONFIRMATION:
   - First, find the user via lookup_user_tool using the provided name or email.
   - Once found, DO NOT CALL delete_user_tool immediately.
   - Present the user summary and ask for confirmation exactly in this format:
     User found:
     Name: <name>
     Email: <email>
     Role: <role>

     Are you sure you want to delete this user?
     [Yes] [No]
   - If the user responds with "Yes", "Confirm", or affirmative, call delete_user_tool.
   - If the user responds with "No", "Cancel", or negative, respond:
     "Delete operation cancelled. No changes were made."
"""

tools = [lookup_user_tool, create_user_tool, update_user_tool, delete_user_tool]
user_agent_runnable = create_react_agent(
    model=get_llm(temperature=0),
    tools=tools,
    prompt=USER_AGENT_PROMPT
)

async def user_agent_node(state):
    result = await user_agent_runnable.ainvoke(state)
    return {"messages": [result["messages"][-1]]}