# app/graph/agents/worker_nodes.py
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.prebuilt import create_react_agent
from app.llm import get_llm
  
from app.tools.ttd_tools import search_knowledge_base, fetch_project_analytics 

 

llm = get_llm()

 

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

 

async def rag_node(state):
    result = await rag_agent.ainvoke(state)
    return {"messages": [result["messages"][-1]]}

async def analytics_node(state):
    result = await analytics_agent.ainvoke(state)
    return {"messages": [result["messages"][-1]]}