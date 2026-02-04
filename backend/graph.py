from typing import TypedDict, List, Annotated
import operator
import os
from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama
from dotenv import load_dotenv

load_dotenv()

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_PROPONENT = os.getenv("OLLAMA_MODEL_PROPONENT", "llama3")
MODEL_OPPONENT = os.getenv("OLLAMA_MODEL_OPPONENT", "llama3")
MODEL_MODERATOR = os.getenv("OLLAMA_MODEL_MODERATOR", "llama3")
MAX_TURNS = int(os.getenv("MAX_TURNS", 6))

# Define the State
class DebateState(TypedDict):
    messages: Annotated[List[str], operator.add]
    current_speaker: str
    turn_count: int

def get_model(model_name: str):
    return ChatOllama(base_url=OLLAMA_BASE_URL, model=model_name)

# Define Nodes
async def moderator_node(state: DebateState):
    llm = get_model(MODEL_MODERATOR)
    # Simple prompt construction
    messages = state["messages"]
    prompt = f"You are the Moderator. The debate history is: {messages}. Provide a brief introduction or steer the debate."
    if not messages:
        prompt = "You are the Moderator. Introduce the topic 'AI Safety'."
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Moderator: {response.content}"], "current_speaker": "proponent", "turn_count": state["turn_count"] + 1}

async def proponent_node(state: DebateState):
    llm = get_model(MODEL_PROPONENT)
    messages = state["messages"]
    prompt = f"You are the Proponent arguing FOR the topic. The debate history is: {messages}. Respond to the previous point."
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Proponent: {response.content}"], "current_speaker": "opponent", "turn_count": state["turn_count"] + 1}

async def opponent_node(state: DebateState):
    llm = get_model(MODEL_OPPONENT)
    messages = state["messages"]
    prompt = f"You are the Opponent arguing AGAINST the topic. The debate history is: {messages}. Respond to the previous point."
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Opponent: {response.content}"], "current_speaker": "proponent", "turn_count": state["turn_count"] + 1}

def should_continue(state: DebateState):
    if state["turn_count"] > MAX_TURNS:
        return END
    return state["current_speaker"]

def create_debate_graph():
    # Initialize the graph with the state
    workflow = StateGraph(DebateState)
    
    # Add nodes
    workflow.add_node("moderator", moderator_node)
    workflow.add_node("proponent", proponent_node)
    workflow.add_node("opponent", opponent_node)
    
    # Add edges
    workflow.set_entry_point("moderator")
    
    workflow.add_conditional_edges(
        "moderator",
        should_continue,
        {
            "proponent": "proponent",
            "opponent": "opponent",
            END: END
        }
    )
    
    workflow.add_conditional_edges(
        "proponent",
        should_continue,
        {
            "opponent": "opponent",
            "moderator": "moderator",
            END: END
        }
    )
    
    workflow.add_conditional_edges(
        "opponent",
        should_continue,
        {
            "proponent": "proponent",
            "moderator": "moderator",
            END: END
        }
    )
    
    return workflow
