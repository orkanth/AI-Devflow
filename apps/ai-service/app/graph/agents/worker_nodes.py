# app/graph/agents/worker_nodes.py
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.prebuilt import create_react_agent
from app.llm import get_llm
from app.tools.langchain_tools import (
    create_project_task,
    list_project_tasks,
    search_knowledge_base,
    fetch_project_analytics
)

llm = get_llm()

# Task Agent
task_agent = create_react_agent(
    model=llm,
    tools=[create_project_task, list_project_tasks],
    prompt="You are a Task Management specialist. Execute task and project CRUD operations."
)

# RAG Agent
rag_agent = create_react_agent(
    model=llm,
    tools=[search_knowledge_base],
    prompt="You are an Information Retrieval specialist. Query the pgvector store to answer context questions."
)

# Analytics Agent
analytics_agent = create_react_agent(
    model=llm,
    tools=[fetch_project_analytics],
    prompt="You are an Analytics specialist. Analyze metrics, task completion rates, and bottlenecks."
)

async def task_node(state):
    result = await task_agent.ainvoke(state)
    return {"messages": [result["messages"][-1]]}

async def rag_node(state):
    result = await rag_agent.ainvoke(state)
    return {"messages": [result["messages"][-1]]}

async def analytics_node(state):
    result = await analytics_agent.ainvoke(state)
    return {"messages": [result["messages"][-1]]}