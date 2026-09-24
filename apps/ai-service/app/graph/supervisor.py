# app/graph/supervisor.py
from typing import Annotated, Literal, Sequence, TypedDict
import operator
from pydantic import BaseModel
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.llm import get_llm
from app.graph.agents.user_agent import user_agent_node
from app.graph.agents.worker_nodes import task_node, rag_node, analytics_node

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next_node: str

MEMBERS = ["UserAgent", "TaskAgent", "RAGAgent", "AnalyticsAgent"]

class RouteResponse(BaseModel):
    next_node: Literal["UserAgent", "TaskAgent", "RAGAgent", "AnalyticsAgent", "FINISH"]

def build_graph():
    llm = get_llm(temperature=0)
    
    system_prompt = (
        "You are the DevFlow AI supervisor managing workers: {members}.\n"
        "- UserAgent: For creating, updating, deleting, or looking up users, roles, or emails.\n"
        "- TaskAgent: For creating, listing, or modifying tasks and projects.\n"
        "- RAGAgent: For knowledge base search or documentation queries.\n"
        "- AnalyticsAgent: For project metrics and completion status.\n\n"
        "IMPORTANT RULES:\n"
        "1. If a worker has already produced an answer or asked the user for clarification/confirmation, choose 'FINISH'.\n"
        "2. Do not re-route to a worker if the request was already addressed.\n"
        "Who should act next?"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("placeholder", "{messages}"),
        ("system", "Select one next worker: {options}")
    ]).partial(options=str(MEMBERS + ["FINISH"]), members=", ".join(MEMBERS))

    supervisor_chain = prompt | llm.with_structured_output(RouteResponse)

    async def supervisor_node(state: AgentState):
        # If the last message is an AI message from one of the agents, conclude the cycle
        messages = state.get("messages", [])
        if messages and isinstance(messages[-1], AIMessage) and not getattr(messages[-1], "tool_calls", None):
            return {"next_node": "FINISH"}

        result = await supervisor_chain.ainvoke(state)
        return {"next_node": result.next_node}

    workflow = StateGraph(AgentState)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("UserAgent", user_agent_node)
    workflow.add_node("TaskAgent", task_node)
    workflow.add_node("RAGAgent", rag_node)
    workflow.add_node("AnalyticsAgent", analytics_node)

    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state["next_node"],
        {
            "UserAgent": "UserAgent",
            "TaskAgent": "TaskAgent",
            "RAGAgent": "RAGAgent",
            "AnalyticsAgent": "AnalyticsAgent",
            "FINISH": END,
        }
    )

    for member in MEMBERS:
        workflow.add_edge(member, "supervisor")

    workflow.set_entry_point("supervisor")
    
    return workflow.compile(checkpointer=MemorySaver())

app_graph = build_graph()