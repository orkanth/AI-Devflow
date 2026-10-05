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
from app.graph.agents.project_agent import project_agent_node
from app.graph.agents.worker_nodes import task_node, rag_node, analytics_node

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next_node: str

MEMBERS = ["UserAgent",  "TaskAgent", "ProjectAgent", "RAGAgent", "AnalyticsAgent"]

class RouteResponse(BaseModel):
    next_node: Literal["UserAgent", "TaskAgent",  "ProjectAgent", "RAGAgent", "AnalyticsAgent", "FINISH"]

def build_graph():
    llm = get_llm(temperature=0)
    
    system_prompt = (
    "You are the DevFlow AI supervisor managing these specialized workers: {members}.\n\n"
    "ROUTING PRECEDENCE & RULES:\n"
    "1. PROJECT OPERATIONS (HIGHEST PRIORITY FOR PROJECTS):\n"
    "   - ANY request to create, update, rename, delete, view, or change a PROJECT must route to 'ProjectAgent'.\n"
    "   - This INCLUDES assigning or changing the project owner (e.g., 'Update Project X assign owner to Y', 'Change project owner to Ravi'). "
    "Even though an owner/user is mentioned, the target entity being modified is a PROJECT, so route to 'ProjectAgent'.\n\n"
    "2. USER OPERATIONS:\n"
    "   - Requests to create, view, update, or delete USER accounts directly (e.g., 'Create user Ravi', 'Update user email') route to 'UserAgent'.\n\n"
    "3. TASK OPERATIONS:\n"
    "   - Requests to manage tasks within projects route to 'TaskAgent'.\n\n"
    "4. STRICT SUPERVISOR CONSTRAINTS:\n"
    "   - You are ONLY a router. You are strictly FORBIDDEN from asking clarification questions or generating conversational answers.\n"
    "   - If a request mentions updating a project, ALWAYS route to 'ProjectAgent' immediately. Let ProjectAgent determine if parameters are missing.\n"
    "   - NEVER return 'FINISH' on a new user request.\n\n"
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
    workflow.add_node("ProjectAgent", project_agent_node)
    workflow.add_node("RAGAgent", rag_node)
    workflow.add_node("AnalyticsAgent", analytics_node)

    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state["next_node"],
        {
            "UserAgent": "UserAgent",
            "TaskAgent": "TaskAgent",
            "ProjectAgent": "ProjectAgent",
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