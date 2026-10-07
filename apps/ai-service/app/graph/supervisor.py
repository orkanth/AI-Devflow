import operator
import re
from typing import Any, Dict, Annotated, Literal, Sequence, TypedDict
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from pydantic import BaseModel

from app.graph.agents.project_agent import project_agent_node
from app.graph.agents.task_agent import task_agent_node
from app.graph.agents.user_agent import user_agent_node
from app.graph.agents.worker_nodes import analytics_node, rag_node
from app.llm import get_llm


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    next_node: str
    action_type: str
    crud_payload: Dict[str, Any]
    requires_confirmation: bool
    tool_result: Any

MEMBERS = [
    "UserAgent",
    "TaskAgent",
    "ProjectAgent",
    "RAGAgent",
    "AnalyticsAgent",
]


class RouteResponse(BaseModel):
  next_node: Literal[
      "UserAgent",
      "TaskAgent",
      "ProjectAgent",
      "RAGAgent",
      "AnalyticsAgent",
      "FINISH",
  ]


def build_graph():
  llm = get_llm(temperature=0)

  system_prompt = (
      "You are the DevFlow AI supervisor dispatching requests to these workers:"
      " {members}.\n\n"
      "ROUTING PRECEDENCE & STRICT RULES:\n"
      "1. TASK OPERATIONS (HIGHEST PRIORITY FOR TASKS):\n"
      "   - ANY request to create, update, delete, complete, find, list, or"
      " assign/reassign TASKS must route to 'TaskAgent'.\n"
      "   - Common triggers & typos: 'task', 'tasks', 'assign tasks', 'assigne"
      " tasks', 'reassign', 'reassign tasks', 'todo', 'backlog', 'change task"
      " status'.\n"
      "   - Examples:\n"
      "     * 'Assigne tasks Revathi to Ravi5' -> TaskAgent\n"
      "     * 'Assign all tasks from X to Y' -> TaskAgent\n"
      "     * 'Create task Fix login' -> TaskAgent\n\n"
      "2. PROJECT OPERATIONS:\n"
      "   - ANY request to create, update, rename, delete, view, or change a"
      " PROJECT must route to 'ProjectAgent'.\n"
      "   - Includes assigning project owner: 'Project X assign owner to Y' ->"
      " ProjectAgent.\n\n"
      "3. USER OPERATIONS:\n"
      "   - Requests to manage user accounts directly (e.g., 'Create user"
      " Ravi', 'Show user profile') route to 'UserAgent'.\n\n"
      "4. RAG / DOCUMENT OPERATIONS:\n"
      "   - Requests involving uploaded documents, TTD specs, or architecture"
      " docs route to 'RAGAgent'.\n\n"
      "5. ANALYTICS OPERATIONS:\n"
      "   - Requests for velocity, burndown, or progress metrics route to"
      " 'AnalyticsAgent'.\n\n"
      "STRICT INVARIANTS:\n"
      "- You are ONLY a router. You are strictly FORBIDDEN from generating"
      " answers or executing actions.\n"
      "- If the user input mentions tasks or assigning tasks, you MUST select"
      " 'TaskAgent'.\n"
      "- NEVER select 'FINISH' on an incoming user command.\n\n"
      "Given the conversation above, who should act next?"
  )

  prompt = ChatPromptTemplate.from_messages([
      ("system", system_prompt),
      ("placeholder", "{messages}"),
      ("system", "Select exactly one worker from: {options}"),
  ]).partial(options=str(MEMBERS + ["FINISH"]), members=", ".join(MEMBERS))

  supervisor_chain = prompt | llm.with_structured_output(RouteResponse)

  async def supervisor_node(state: AgentState):
    messages = state.get("messages", [])

    if not messages:
      return {"next_node": "FINISH"}

    last_msg = messages[-1]

    # If the last message is an AIMessage (and NOT a tool call), a worker agent has already answered.
    # We now finish the turn.
    if isinstance(last_msg, AIMessage) and not getattr(
        last_msg, "tool_calls", None
    ):
      return {"next_node": "FINISH"}

    # Extract user prompt for fast-path routing
    user_prompt = ""
    for m in reversed(messages):
      if isinstance(m, HumanMessage):
        user_prompt = str(m.content).strip().lower()
        break

    # Fast-path deterministic router for tasks (immune to model slip-ups and typos like 'assigne')
    if user_prompt:
      # If task / tasks is explicitly mentioned, TaskAgent takes priority
      if re.search(r"\btasks?\b", user_prompt):
        return {"next_node": "TaskAgent"}

      # If assign/reassign is mentioned with tasks implied
      if any(
          kw in user_prompt
          for kw in [
              "reassign",
              "assigne task",
              "assign task",
              "assign tasks",
              "assigne tasks",
          ]
      ):
        return {"next_node": "TaskAgent"}

      # Project keywords
      if re.search(r"\bprojects?\b", user_prompt):
        return {"next_node": "ProjectAgent"}


    # Standard LLM fallback
    result = await supervisor_chain.ainvoke(state)
    return {"next_node": result.next_node}

  workflow = StateGraph(AgentState)
  workflow.add_node("supervisor", supervisor_node)
  workflow.add_node("UserAgent", user_agent_node)
  workflow.add_node("TaskAgent", task_agent_node)
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
      },
  )

  for member in MEMBERS:
    workflow.add_edge(member, "supervisor")

  workflow.set_entry_point("supervisor")
  return workflow.compile(checkpointer=MemorySaver())


app_graph = build_graph()