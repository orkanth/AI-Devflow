# apps/ai-service/app/graph/supervisor.py
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
        "You are the DevFlow AI supervisor managing these specialized workers: {members}.\n\n"
        "ROUTING RULES:\n"
        "1. ANY query regarding users, creating users, updating users, deleting users, roles, or user emails "
        "MUST be routed to 'UserAgent'. NEVER finish directly on user operations without routing to UserAgent first.\n"
        "2. Queries regarding tasks or projects go to 'TaskAgent'.\n"
        "3. Queries searching documentation/knowledge base go to 'RAGAgent'.\n"
        "4. Queries about project analytics or sprint velocity go to 'AnalyticsAgent'.\n"
        "5. ONLY return 'FINISH' if one of the workers has ALREADY responded to the user in the latest messages.\n\n"
        "Given the conversation above, who should act next?"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("placeholder", "{messages}"),
        ("system", "Choose one worker or FINISH: {options}")
    ]).partial(options=str(MEMBERS + ["FINISH"]), members=", ".join(MEMBERS))

    supervisor_chain = prompt | llm.with_structured_output(RouteResponse)

    async def supervisor_node(state: AgentState):
        messages = state.get("messages", [])
        
        # If the last message is from an assistant (and not calling a tool), the agent finished its turn
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