from typing import TypedDict, List, Annotated
import operator
import os
from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama
from dotenv import load_dotenv

import json

load_dotenv()

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_PROPONENT = os.getenv("OLLAMA_MODEL_PROPONENT", "llama3")
MODEL_OPPONENT = os.getenv("OLLAMA_MODEL_OPPONENT", "llama3")
MODEL_MODERATOR = os.getenv("OLLAMA_MODEL_MODERATOR", "llama3")
MAX_TURNS = int(os.getenv("MAX_TURNS", 6))
WORD_LIMIT = int(os.getenv("WORD_LIMIT", 75))

# Load Data
def load_json_data(filename):
    try:
        with open(os.path.join("data", filename), "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

PROFILES = load_json_data("profile.json")
TONES = load_json_data("tones.json")

def get_profile_def(name):
    p = next((p for p in PROFILES if p["Movement"] == name), None)
    return f"{p['Definition']} (Root Conflict: {p['RootConflict']})" if p else name

def get_tone_desc(name):
    t = next((t for t in TONES if t["tone"] == name), None)
    return t["description"] if t else name

# Define the State
class DebateState(TypedDict):
    messages: Annotated[List[str], operator.add]
    current_speaker: str
    turn_count: int
    topic: str
    proponent_profile: str
    proponent_tone: str
    opponent_profile: str
    opponent_tone: str
    verdict: str

def get_model(model_name: str):
    return ChatOllama(base_url=OLLAMA_BASE_URL, model=model_name)

# Define Nodes
async def moderator_node(state: DebateState):
    llm = get_model(MODEL_MODERATOR)
    messages = state["messages"]
    topic = state.get("topic", "AI Safety")
    
    prompt = f"You are the Moderator. The debate topic is '{topic}'. The debate history is: {messages}. Provide a brief introduction or steer the debate. Keep your response under {WORD_LIMIT} words."
    if not messages:
        prompt = f"You are the Moderator. Introduce the debate topic: '{topic}'. Keep your response under {WORD_LIMIT} words."
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Moderator: {response.content}"], "current_speaker": "proponent", "turn_count": state["turn_count"] + 1}

async def verdict_node(state: DebateState):
    llm = get_model(MODEL_MODERATOR)
    messages = state["messages"]
    topic = state.get("topic", "AI Safety")
    
    prompt = f"""You are the Chief Judge of the Debate. The topic was '{topic}'.
    The debate history is: {messages}.
    
    Your task is to synthesize the exchange into a final Decision Matrix.
    1. Decide the winner (Proponent or Opponent).
    2. Assign scores (0-10) for Logic, Evidence, and Style for each side.
    3. Provide a punchy, concise rationale (max 50 words) for the decision.
    
    You MUST return the result as a valid JSON object with the following structure:
    {{
      "winner": "Proponent" | "Opponent",
      "scores": {{
        "proponent": {{"logic": int, "evidence": int, "style": int}},
        "opponent": {{"logic": int, "evidence": int, "style": int}}
      }},
      "reasoning": "string"
    }}
    
    Do NOT output any text before or after the JSON.
    """
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Moderator: The debate has concluded. Rendering verdict..."], "verdict": response.content}

async def proponent_node(state: DebateState):
    llm = get_model(MODEL_PROPONENT)
    messages = state["messages"]
    profile = state.get("proponent_profile", "Rationalism")
    tone = state.get("proponent_tone", "Assertive")
    
    profile_def = get_profile_def(profile)
    tone_desc = get_tone_desc(tone)
    
    prompt = f"""You are the Proponent arguing FOR the topic. 
    Your philosophy is {profile}: {profile_def}. 
    Your tone is {tone}: {tone_desc}.
    The debate history is: {messages}. 
    Respond to the previous point. Keep your response under {WORD_LIMIT} words."""
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Proponent: {response.content}"], "current_speaker": "opponent", "turn_count": state["turn_count"] + 1}

async def opponent_node(state: DebateState):
    llm = get_model(MODEL_OPPONENT)
    messages = state["messages"]
    profile = state.get("opponent_profile", "Empiricism")
    tone = state.get("opponent_tone", "Skeptical")
    
    profile_def = get_profile_def(profile)
    tone_desc = get_tone_desc(tone)
    
    prompt = f"""You are the Opponent arguing AGAINST the topic. 
    Your philosophy is {profile}: {profile_def}. 
    Your tone is {tone}: {tone_desc}.
    The debate history is: {messages}. 
    Respond to the previous point. Keep your response under {WORD_LIMIT} words."""
    
    response = await llm.ainvoke(prompt)
    return {"messages": [f"Opponent: {response.content}"], "current_speaker": "proponent", "turn_count": state["turn_count"] + 1}

def should_continue(state: DebateState):
    if state["turn_count"] > MAX_TURNS:
        return "verdict"
    return state["current_speaker"]

def create_debate_graph():
    # Initialize the graph with the state
    workflow = StateGraph(DebateState)
    
    # Add nodes
    workflow.add_node("moderator", moderator_node)
    workflow.add_node("proponent", proponent_node)
    workflow.add_node("opponent", opponent_node)
    workflow.add_node("verdict", verdict_node)
    
    # Add edges
    workflow.set_entry_point("moderator")
    
    workflow.add_conditional_edges(
        "moderator",
        should_continue,
        {
            "proponent": "proponent",
            "opponent": "opponent",
            "verdict": "verdict"
        }
    )
    
    workflow.add_conditional_edges(
        "proponent",
        should_continue,
        {
            "opponent": "opponent",
            "moderator": "moderator",
            "verdict": "verdict"
        }
    )
    
    workflow.add_conditional_edges(
        "opponent",
        should_continue,
        {
            "proponent": "proponent",
            "moderator": "moderator",
            "verdict": "verdict"
        }
    )
    
    workflow.add_edge("verdict", END)
    
    return workflow
