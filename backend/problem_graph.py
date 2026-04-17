"""
LangGraph workflow for multi-agent problem solving.

5 specialist agents + 1 facilitator collaborate through structured phases:
  Phase 1: Frame (facilitator introduces problem)
  Phase 2: Diverge (all agents give independent analysis, multi-round)
  Phase 3: React (targeted cross-pollination, multi-round)
  Phase 4: Converge (solution building, multi-round)
  Phase 5: Stress-Test (challenge + defend, multi-round)
  Phase 6: Synthesis (facilitator produces Solution Matrix)
"""

from typing import TypedDict, List, Dict, Annotated, Optional
import operator
import os
import json
import logging
import random as rand_module
from pathlib import Path

from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("debate.problem")

PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


# --- Configuration ---

from backend.graph import (
    LLM_PROVIDER, OLLAMA_BASE_URL, MODEL_MODERATOR,
    PROFILES, TONES, WORD_LIMIT, WORD_LIMIT_MIN,
    get_model, get_profile_data, get_tone_data,
    build_identity_prompt, format_history,
    GUEST_NAMES_A, GUEST_NAMES_B,
)

MODEL_FACILITATOR = os.getenv("MODEL_PROBLEM_FACILITATOR", MODEL_MODERATOR)
MODEL_AGENTS = os.getenv("MODEL_PROBLEM_AGENTS", MODEL_MODERATOR)
MAX_ROUNDS_PER_PHASE = int(os.getenv("MAX_ROUNDS_PER_PHASE", 2))
FACILITATOR_WORD_LIMIT = int(os.getenv("FACILITATOR_WORD_LIMIT", 200))
AGENT_WORD_LIMIT = int(os.getenv("AGENT_WORD_LIMIT", 150))

AGENT_ROLES = ["analyst", "creative", "critic", "pragmatist", "synthesizer"]

ROLE_DESCRIPTIONS = {
    "analyst": "Breaks down problems, identifies root causes, maps dependencies",
    "creative": "Proposes unconventional solutions, challenges assumptions",
    "critic": "Stress-tests ideas, finds flaws, identifies risks",
    "pragmatist": "Evaluates feasibility, cost, timeline, real-world constraints",
    "synthesizer": "Merges ideas, resolves contradictions, builds consensus",
}

ROLE_DIVERGE_INSTRUCTIONS = {
    "analyst": "Decompose the problem. What are the root causes? What are the dependencies? What data do we need?",
    "creative": "Reframe the problem. What assumptions is everyone making? What unconventional angle could work?",
    "critic": "What makes this problem HARD? Where do solutions usually fail? What are the hidden risks?",
    "pragmatist": "What are the real-world constraints? Budget, timeline, political, technical? What's non-negotiable?",
    "synthesizer": "What themes do you see across the team's inputs? Where are the natural integration points?",
}

ROLE_CONVERGE_INSTRUCTIONS = {
    "analyst": "what specific data or evidence supports the emerging solution",
    "creative": "what innovative element could make this solution stand out",
    "critic": "what remaining weakness needs to be addressed before this can work",
    "pragmatist": "what the realistic implementation timeline and cost look like",
    "synthesizer": "how to merge the team's proposals into one coherent recommendation",
}

PHASES = ["frame", "diverge", "react", "converge", "stress", "synthesis"]


def random_word_limit():
    return rand_module.randint(WORD_LIMIT_MIN, max(WORD_LIMIT, WORD_LIMIT_MIN))


def assign_five_names():
    """Pick 5 distinct names from both pools."""
    all_names = list(set(GUEST_NAMES_A + GUEST_NAMES_B))
    return rand_module.sample(all_names, 5)


# --- State ---

class ProblemState(TypedDict):
    messages: Annotated[List[str], operator.add]
    phase: str
    phase_round: int
    problem: str
    agent_configs: Dict[str, Dict]  # {role: {profile, tone, language, name}}
    current_agent: str
    agent_index: int
    facilitator_language: str
    facilitator_directions: str  # latest checkpoint directions for agent prompts
    solution: str


def _agent_list_str(state: ProblemState) -> str:
    """Format agent list for prompt injection."""
    parts = []
    for role in AGENT_ROLES:
        cfg = state["agent_configs"].get(role, {})
        name = cfg.get("name", role.title())
        parts.append(f"- {name} ({role.title()}): {ROLE_DESCRIPTIONS[role]}")
    return "\n".join(parts)


def _get_agent_name(state: ProblemState, role: str) -> str:
    return state["agent_configs"].get(role, {}).get("name", role.title())


def _get_round_messages(state: ProblemState) -> str:
    """Get messages from the current round only (after last facilitator message)."""
    messages = state["messages"]
    # Find last facilitator message
    last_fac_idx = -1
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].startswith("Facilitator:"):
            last_fac_idx = i
            break
    if last_fac_idx >= 0:
        return "\n\n".join(messages[last_fac_idx + 1:])
    return "\n\n".join(messages)


# --- Nodes ---

async def facilitator_frame_node(state: ProblemState, config: RunnableConfig):
    """Phase 1: Facilitator frames the problem."""
    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    stream_cb = configurable.get("stream_callback")
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = "facilitator"
    llm = get_model(MODEL_FACILITATOR, label="facilitator-frame", token_tracker=tracker, stream_callback=stream_cb)

    wl = FACILITATOR_WORD_LIMIT
    prompt = _load_prompt("facilitator_frame.txt").format(
        problem=state["problem"],
        analyst_name=_get_agent_name(state, "analyst"),
        creative_name=_get_agent_name(state, "creative"),
        critic_name=_get_agent_name(state, "critic"),
        pragmatist_name=_get_agent_name(state, "pragmatist"),
        synthesizer_name=_get_agent_name(state, "synthesizer"),
        wl=wl,
        language=state.get("facilitator_language", "English"),
    )

    response = await llm.ainvoke(prompt)
    logger.info(f"[FACILITATOR] Frame: {len(response.content)} chars")

    return {
        "messages": [f"Facilitator: {response.content}"],
        "phase": "diverge",
        "phase_round": 1,
        "current_agent": "analyst",
        "agent_index": 0,
        "facilitator_directions": "",
    }


async def agent_node(state: ProblemState, config: RunnableConfig):
    """Generic agent node — dispatches based on phase and current_agent."""
    phase = state["phase"]
    role = state["current_agent"]
    phase_round = state["phase_round"]
    agent_cfg = state["agent_configs"].get(role, {})
    my_name = agent_cfg.get("name", role.title())
    profile_data = get_profile_data(agent_cfg.get("profile", ""))
    tone_data = get_tone_data(agent_cfg.get("tone", ""))
    language = agent_cfg.get("language", "English")
    identity = build_identity_prompt(profile_data, tone_data)

    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    stream_cb = configurable.get("stream_callback")

    # Notify streaming layer which agent is about to speak
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = role

    label = f"{role}-{phase}-r{phase_round}"
    llm = get_model(MODEL_AGENTS, label=label, token_tracker=tracker, stream_callback=stream_cb)

    wl = AGENT_WORD_LIMIT
    history = format_history(state["messages"], window=15)
    facilitator_directions = state.get("facilitator_directions", "")
    if facilitator_directions:
        facilitator_directions = f"The facilitator's direction: {facilitator_directions}"

    if phase == "diverge":
        role_instruction = ROLE_DIVERGE_INSTRUCTIONS.get(role, "Give your analysis.")
        prompt = _load_prompt("agent_diverge.txt").format(
            my_name=my_name, role=role.title(), language=language,
            identity=identity, problem=state["problem"],
            facilitator_directions=facilitator_directions,
            wl=wl, role_instruction=role_instruction,
        )
    elif phase == "react":
        prompt = _load_prompt("agent_react.txt").format(
            my_name=my_name, role=role.title(), language=language,
            identity=identity, problem=state["problem"],
            facilitator_directions=facilitator_directions,
            history=history, wl=wl,
        )
    elif phase == "converge":
        role_instruction = ROLE_CONVERGE_INSTRUCTIONS.get(role, "propose your concrete recommendation")
        prompt = _load_prompt("agent_converge.txt").format(
            my_name=my_name, role=role.title(), language=language,
            identity=identity, problem=state["problem"],
            facilitator_directions=facilitator_directions,
            history=history, wl=wl, role_instruction=role_instruction,
        )
    elif phase == "stress":
        if role in ("critic", "pragmatist"):
            stress_instruction = (
                f"As the {role.title()}, review the draft recommendation constructively. "
                "Identify the highest-risk assumption or the biggest implementation gap. "
                "Propose a specific way to address it."
            )
        else:
            stress_instruction = (
                f"As the {role.title()}, assess the draft recommendation from your lens. "
                "Identify one element to strengthen and propose how. "
                "If a concern was raised by another team member, suggest how to integrate it."
            )
        prompt = _load_prompt("agent_stress.txt").format(
            my_name=my_name, role=role.title(), language=language,
            identity=identity, problem=state["problem"],
            facilitator_directions=facilitator_directions,
            history=history, wl=wl, stress_instruction=stress_instruction,
        )
    else:
        prompt = f"You are {my_name}. Respond briefly about: {state['problem']}"

    logger.info(f"[{role.upper()}:{my_name}] Phase={phase}, round={phase_round}")
    response = await llm.ainvoke(prompt)
    logger.info(f"[{role.upper()}:{my_name}] Response: {len(response.content)} chars")

    # Advance to next agent
    agent_index = state["agent_index"] + 1

    return {
        "messages": [f"{role.title()}: {response.content}"],
        "agent_index": agent_index,
    }


async def facilitator_checkpoint_node(state: ProblemState, config: RunnableConfig):
    """Facilitator checkpoint between rounds — decides advance or another round."""
    phase = state["phase"]
    phase_round = state["phase_round"]

    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    stream_cb = configurable.get("stream_callback")
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = "facilitator"

    # For stress phase, use the stress-specific prompt on first entry
    if phase == "stress" and phase_round == 1:
        llm = get_model(MODEL_FACILITATOR, label=f"facilitator-stress", token_tracker=tracker, stream_callback=stream_cb)
        prompt = _load_prompt("facilitator_stress.txt").format(
            problem=state["problem"],
            agent_list=_agent_list_str(state),
            history=format_history(state["messages"], window=20),
            wl=FACILITATOR_WORD_LIMIT,
            critic_name=_get_agent_name(state, "critic"),
            pragmatist_name=_get_agent_name(state, "pragmatist"),
            analyst_name=_get_agent_name(state, "analyst"),
            creative_name=_get_agent_name(state, "creative"),
            synthesizer_name=_get_agent_name(state, "synthesizer"),
            language=state.get("facilitator_language", "English"),
        )
    else:
        llm = get_model(MODEL_FACILITATOR, label=f"facilitator-{phase}-cp-r{phase_round}", token_tracker=tracker, stream_callback=stream_cb)
        round_messages = _get_round_messages(state)
        prompt = _load_prompt("facilitator_checkpoint.txt").format(
            problem=state["problem"],
            agent_list=_agent_list_str(state),
            phase=phase.title(),
            round=phase_round,
            max_rounds=MAX_ROUNDS_PER_PHASE,
            round_messages=round_messages,
            history=format_history(state["messages"], window=20),
            wl=FACILITATOR_WORD_LIMIT,
            language=state.get("facilitator_language", "English"),
        )

    response = await llm.ainvoke(prompt)
    raw = response.content.strip()
    logger.info(f"[FACILITATOR] Checkpoint {phase}/r{phase_round}: {len(raw)} chars")

    # Parse advance decision from JSON at end of response
    advance = False
    directions = raw
    try:
        # Find last JSON block in response
        json_start = raw.rfind("{")
        json_end = raw.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            decision = json.loads(raw[json_start:json_end])
            advance = decision.get("advance", False)
            # Remove JSON from the display message
            directions = raw[:json_start].strip()
    except (json.JSONDecodeError, KeyError):
        logger.warning(f"[FACILITATOR] Failed to parse checkpoint decision, defaulting to advance=False")

    # Force advance if we've hit max rounds
    if phase_round >= MAX_ROUNDS_PER_PHASE:
        advance = True
        logger.info(f"[FACILITATOR] Forcing advance — max rounds ({MAX_ROUNDS_PER_PHASE}) reached")

    if advance:
        # Move to next phase
        phase_idx = PHASES.index(phase)
        next_phase = PHASES[phase_idx + 1] if phase_idx + 1 < len(PHASES) else "synthesis"
        logger.info(f"[FACILITATOR] Advancing: {phase} → {next_phase}")
        return {
            "messages": [f"Facilitator: {directions}"] if directions else [],
            "phase": next_phase,
            "phase_round": 1,
            "agent_index": 0,
            "current_agent": "analyst",
            "facilitator_directions": directions,
        }
    else:
        # Another round in same phase
        logger.info(f"[FACILITATOR] Another round: {phase} r{phase_round + 1}")
        return {
            "messages": [f"Facilitator: {directions}"] if directions else [],
            "phase_round": phase_round + 1,
            "agent_index": 0,
            "current_agent": "analyst",
            "facilitator_directions": directions,
        }


async def facilitator_synthesis_node(state: ProblemState, config: RunnableConfig):
    """Phase 6: Facilitator produces the Solution Matrix."""
    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = "facilitator"
    llm = get_model(MODEL_FACILITATOR, label="facilitator-synthesis", token_tracker=tracker)

    prompt = _load_prompt("facilitator_synthesis.txt").format(
        problem=state["problem"],
        agent_list=_agent_list_str(state),
        history=format_history(state["messages"]),
        analyst_name=_get_agent_name(state, "analyst"),
        creative_name=_get_agent_name(state, "creative"),
        critic_name=_get_agent_name(state, "critic"),
        pragmatist_name=_get_agent_name(state, "pragmatist"),
        synthesizer_name=_get_agent_name(state, "synthesizer"),
        language=state.get("facilitator_language", "English"),
    )

    response = await llm.ainvoke(prompt)
    logger.info(f"[FACILITATOR] Synthesis: {len(response.content)} chars")

    return {
        "messages": [f"Facilitator: The session is complete. Rendering solution..."],
        "solution": response.content,
        "phase": "done",
    }


# --- Routing ---

def route_after_frame(state: ProblemState):
    return "agent"


def route_after_agent(state: ProblemState):
    """After an agent speaks, go to next agent or to checkpoint."""
    agent_index = state["agent_index"]
    if agent_index < len(AGENT_ROLES):
        # More agents to go in this round
        return "agent"
    else:
        # All agents spoke — go to checkpoint
        return "checkpoint"


def route_after_checkpoint(state: ProblemState):
    """After checkpoint, either run agents again or go to synthesis."""
    phase = state["phase"]
    if phase == "synthesis":
        return "synthesis"
    else:
        return "agent"


def update_current_agent(state: ProblemState):
    """Set current_agent based on agent_index before agent_node runs."""
    idx = state.get("agent_index", 0)
    if idx < len(AGENT_ROLES):
        return AGENT_ROLES[idx]
    return AGENT_ROLES[0]


# --- Wrapper node to set current_agent ---

async def agent_dispatch_node(state: ProblemState, config: RunnableConfig):
    """Sets current_agent from agent_index, then delegates to agent_node."""
    idx = state.get("agent_index", 0)
    if idx < len(AGENT_ROLES):
        state_copy = dict(state)
        state_copy["current_agent"] = AGENT_ROLES[idx]
        return await agent_node(state_copy, config)
    return {}


# --- Graph Construction ---

def create_problem_graph():
    workflow = StateGraph(ProblemState)

    workflow.add_node("frame", facilitator_frame_node)
    workflow.add_node("agent", agent_dispatch_node)
    workflow.add_node("checkpoint", facilitator_checkpoint_node)
    workflow.add_node("synthesis", facilitator_synthesis_node)

    workflow.set_entry_point("frame")

    workflow.add_edge("frame", "agent")

    workflow.add_conditional_edges(
        "agent",
        route_after_agent,
        {"agent": "agent", "checkpoint": "checkpoint"},
    )

    workflow.add_conditional_edges(
        "checkpoint",
        route_after_checkpoint,
        {"agent": "agent", "synthesis": "synthesis"},
    )

    workflow.add_edge("synthesis", END)

    return workflow
