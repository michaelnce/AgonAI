from typing import TypedDict, List, Annotated
import operator
import os
import logging
import random as rand_module
from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv

import json
from pathlib import Path

logger = logging.getLogger("debate.graph")

# Load prompt templates from files
PROMPTS_DIR = Path(__file__).parent / "prompts"

def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()

load_dotenv()

# Configuration — LLM provider switch
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # "ollama" or "claude"

# Ollama settings (used when LLM_PROVIDER=ollama)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_PROPONENT = os.getenv("OLLAMA_MODEL_PROPONENT", "llama3")
MODEL_OPPONENT = os.getenv("OLLAMA_MODEL_OPPONENT", "llama3")
MODEL_MODERATOR = os.getenv("OLLAMA_MODEL_MODERATOR", "llama3")
MODEL_FACT_CHECK = os.getenv("MODEL_FACT_CHECK", MODEL_MODERATOR)
MAX_TURNS = int(os.getenv("MAX_TURNS", 6))
MAX_TURNS_MIN = 10  # Debate length is randomized between MAX_TURNS_MIN and MAX_TURNS
WORD_LIMIT = int(os.getenv("WORD_LIMIT", 200))
WORD_LIMIT_MIN = 100  # Debater word limit is randomized between WORD_LIMIT_MIN and WORD_LIMIT each turn
MODERATOR_WORD_LIMIT = int(os.getenv("MODERATOR_WORD_LIMIT", 60))


def random_word_limit():
    """Return a random word limit between WORD_LIMIT_MIN and WORD_LIMIT for natural length variation."""
    return rand_module.randint(WORD_LIMIT_MIN, max(WORD_LIMIT, WORD_LIMIT_MIN))

# Guest name pools — moderator picks from these
GUEST_NAMES_A = ["Alex", "Jordan", "Morgan", "Casey", "Riley", "Taylor", "Quinn", "Avery", "Jamie", "Drew",
                 "Marco", "Elena", "Yuki", "Priya", "Dmitri", "Amara", "Luca", "Sofia", "Kai", "Nadia"]
GUEST_NAMES_B = ["Sam", "Blake", "Reese", "Harper", "Skyler", "Rowan", "Sage", "Phoenix", "Dakota", "Emery",
                 "Zara", "Ravi", "Ingrid", "Omar", "Mila", "Theo", "Ines", "Nico", "Anika", "Leon"]

# Load Data
def load_json_data(filename):
    try:
        with open(os.path.join("data", filename), "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

PROFILES = load_json_data("profile.json")
TONES = load_json_data("tones.json")
logger.info(f"Loaded {len(PROFILES)} profiles and {len(TONES)} tones")

# Conversational debate moves — rotated each rebuttal turn
DEBATE_MOVES = [
    "Push back HARD on their weakest claim. Call it out: 'That's the part that falls apart...'",
    "Use a vivid real-world example or story that makes your point undeniable. Make it concrete.",
    "Flip their own argument against them. 'By your own logic, you'd have to accept that...'",
    "Concede something small, then hit harder: 'Sure, maybe X — but that actually proves MY point because...'",
    "Ask them a question they can't answer without hurting their own position. Put them in a corner.",
]


def get_profile_data(name):
    """Return full profile dict for a given movement name."""
    return next((p for p in PROFILES if p["Movement"] == name), None)


def get_tone_data(name):
    """Return full tone dict for a given tone name."""
    return next((t for t in TONES if t["tone"] == name), None)


def assign_guest_names():
    """Pick two distinct guest names."""
    a = rand_module.choice(GUEST_NAMES_A)
    b = rand_module.choice(GUEST_NAMES_B)
    return a, b


def format_history(messages, window=None):
    """Format message history as readable dialogue, optionally windowed."""
    if not messages:
        return "(No prior exchanges.)"
    if window and len(messages) > window:
        earlier_count = len(messages) - window
        summary = f"[{earlier_count} earlier exchanges omitted]\n\n"
        return summary + "\n\n".join(messages[-window:])
    return "\n\n".join(messages)


def get_last_opponent_message(messages, my_role):
    """Extract the last message from the other side."""
    target = "Opponent" if my_role == "Proponent" else "Proponent"
    for msg in reversed(messages):
        if msg.startswith(f"{target}:"):
            return msg[len(target)+1:].strip()
    return None


def get_debate_phase(turn_count, max_turns):
    """Determine the current debate phase based on turn progress."""
    if turn_count <= 2:
        return "opening"
    elif turn_count >= max_turns - 1:
        return "closing"
    else:
        return "rebuttal"


def get_move_for_turn(turn_count):
    """Rotate through debate moves for rebuttal turns."""
    idx = (turn_count - 3) % len(DEBATE_MOVES)
    return DEBATE_MOVES[idx]


def build_identity_prompt(profile_data, tone_data):
    """Build a concise personality. Short so the model focuses on the debate, not the bio."""
    if not profile_data:
        return ""
    parts = [f"Your worldview is {profile_data['Movement']}: {profile_data['Definition']}"]
    if profile_data.get("KeyThinkers"):
        parts.append(f"You draw on thinkers like {', '.join(profile_data['KeyThinkers'][:2])}.")
    if profile_data.get("RhetoricalStyle"):
        parts.append(profile_data["RhetoricalStyle"])
    if tone_data:
        parts.append(f"Your vibe: {tone_data['description']}.")
        if tone_data.get("sentenceStyle"):
            parts.append(tone_data["sentenceStyle"])
    return " ".join(parts)


DEBATER_RULES = _load_prompt("debater_rules.txt")


# Define the State
class DebateState(TypedDict):
    messages: Annotated[List[str], operator.add]
    current_speaker: str
    turn_count: int
    max_turns: int
    topic: str
    proponent_profile: str
    proponent_tone: str
    proponent_language: str
    opponent_profile: str
    opponent_tone: str
    opponent_language: str
    moderator_language: str
    proponent_name: str
    opponent_name: str
    verdict: str

def get_model(model_name: str, label: str = "", token_tracker=None, stream_callback=None, max_turns: int = 1):
    if LLM_PROVIDER == "claude":
        from backend.claude_llm import ChatClaudeCode
        return ChatClaudeCode(model_name="claude", max_turns=max_turns, call_label=label, token_tracker=token_tracker, stream_callback=stream_callback)
    else:
        from langchain_ollama import ChatOllama
        return ChatOllama(base_url=OLLAMA_BASE_URL, model=model_name)

# Define Nodes
async def moderator_node(state: DebateState, config: RunnableConfig):
    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    stream_cb = configurable.get("stream_callback")
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = "moderator"
    turn_count = state["turn_count"]
    llm = get_model(MODEL_MODERATOR, label=f"moderator-turn-{turn_count}", token_tracker=tracker, stream_callback=stream_cb)
    messages = state["messages"]
    topic = state.get("topic", "AI Safety")

    pro_profile = state.get("proponent_profile", "Rationalism")
    opp_profile = state.get("opponent_profile", "Empiricism")
    pro_name = state.get("proponent_name", "")
    opp_name = state.get("opponent_name", "")
    moderator_language = state.get("moderator_language", "English")

    logger.info(f"[MODERATOR] Turn {turn_count}, messages so far: {len(messages)}")

    # Assign names on first run
    name_updates = {}
    if not pro_name or not opp_name:
        pro_name, opp_name = assign_guest_names()
        name_updates = {"proponent_name": pro_name, "opponent_name": opp_name}
        logger.info(f"[MODERATOR] Assigned names: {pro_name} (proponent), {opp_name} (opponent)")

    wl = random_word_limit()
    if not messages:
        prompt = _load_prompt("moderator_opening.txt").format(
            topic=topic, pro_name=pro_name, opp_name=opp_name,
            pro_profile=pro_profile, opp_profile=opp_profile,
            wl=wl, moderator_language=moderator_language,
        )
    else:
        history = format_history(messages, window=6)
        prompt = _load_prompt("moderator_intervention.txt").format(
            topic=topic, pro_name=pro_name, opp_name=opp_name,
            history=history, moderator_word_limit=MODERATOR_WORD_LIMIT,
            moderator_language=moderator_language,
        )

    logger.info(f"[MODERATOR] Calling LLM ({LLM_PROVIDER}:{MODEL_MODERATOR})...")
    response = await llm.ainvoke(prompt)
    logger.info(f"[MODERATOR] Response received ({len(response.content)} chars)")
    # Only increment turn_count on the opening (first moderator turn)
    # Mid-debate interventions don't count toward MAX_TURNS so they don't shorten the debate
    is_opening = not state["messages"]
    return {
        "messages": [f"Moderator: {response.content}"],
        "current_speaker": "proponent",
        "turn_count": state["turn_count"] + (1 if is_opening else 0),
        **name_updates,
    }


async def verdict_node(state: DebateState, config: RunnableConfig):
    logger.info(f"[VERDICT] Generating verdict for {len(state['messages'])} messages")
    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    # No streaming for verdict — it's JSON that needs to be complete
    llm = get_model(MODEL_MODERATOR, label="verdict", token_tracker=tracker)
    messages = state["messages"]
    topic = state.get("topic", "AI Safety")
    pro_name = state.get("proponent_name", "Proponent")
    opp_name = state.get("opponent_name", "Opponent")
    moderator_language = state.get("moderator_language", "English")
    history = format_history(messages)

    prompt = _load_prompt("verdict.txt").format(
        topic=topic, pro_name=pro_name, opp_name=opp_name,
        history=history, moderator_language=moderator_language,
    )

    logger.info(f"[VERDICT] Calling LLM ({LLM_PROVIDER}:{MODEL_MODERATOR})...")
    response = await llm.ainvoke(prompt)
    logger.info(f"[VERDICT] Response received ({len(response.content)} chars)")
    return {"messages": [f"Moderator: The debate has concluded. Rendering verdict..."], "verdict": response.content}


def _build_debater_prompt(
    role_label: str,
    role_for: str,
    my_name: str,
    opponent_name: str,
    topic: str,
    language: str,
    identity: str,
    history: str,
    phase: str,
    phase_instruction: str,
    profile_data: dict,
    additional_instruction: str,
):
    """Build the full prompt for a debater (proponent or opponent)."""
    # Inject opponent name into the rules template
    rules = DEBATER_RULES.replace("{opponent_name}", opponent_name)

    # Profile anchoring — remind what this worldview actually believes about the topic
    anchoring = ""
    if profile_data and profile_data.get("RootConflict"):
        anchoring = f"\nRemember: your core tension is '{profile_data['RootConflict']}'. Your arguments must flow from this worldview, not just your tone."

    return f"""You are {my_name}, a podcast guest debating {role_for} the topic. You MUST speak and write ENTIRELY in {language}. Every word of your response must be in {language}.
{identity}{anchoring}

{rules}

Conversation so far:
{history}

{phase_instruction}{additional_instruction}

LANGUAGE REMINDER: Your ENTIRE response must be in {language}. Not a single word in another language."""


async def proponent_node(state: DebateState, config: RunnableConfig):
    turn_count = state["turn_count"]
    phase = get_debate_phase(turn_count, state.get("max_turns", MAX_TURNS))
    my_name = state.get("proponent_name", "Proponent")
    their_name = state.get("opponent_name", "Opponent")
    logger.info(f"[PROPONENT:{my_name}] Turn {turn_count}, phase: {phase}, profile: {state.get('proponent_profile')}, tone: {state.get('proponent_tone')}")
    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    stream_cb = configurable.get("stream_callback")
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = "proponent"
    llm = get_model(MODEL_PROPONENT, label=f"proponent-turn-{turn_count}", token_tracker=tracker, stream_callback=stream_cb)
    messages = state["messages"]
    topic = state.get("topic", "AI Safety")
    profile_data = get_profile_data(state.get("proponent_profile", "Rationalism"))
    tone_data = get_tone_data(state.get("proponent_tone", "Assertive"))
    language = state.get("proponent_language", "English")

    identity = build_identity_prompt(profile_data, tone_data)

    # Check for external moderator instruction
    additional_instruction = ""
    if "configurable" in config and "input_queue" in config["configurable"]:
        queue = config["configurable"]["input_queue"]
        if not queue.empty():
            user_input = queue.get_nowait()
            additional_instruction = f"\nThe host just directed you: {user_input}. Address this."

    # Extract what the opponent last said
    last_opponent = get_last_opponent_message(messages, "Proponent")
    wl = random_word_limit()

    if phase == "opening":
        history = format_history(messages)
        phase_instruction = _load_prompt("debater_opening.txt").format(
            role_intro="", topic=topic, role_for="FOR", wl=wl, opponent_name=their_name,
        )
    elif phase == "closing":
        history = format_history(messages, window=8)
        phase_instruction = _load_prompt("debater_closing.txt").format(
            topic=topic, role_for="FOR", wl=wl, opponent_name=their_name,
        )
    else:
        history = format_history(messages, window=6)
        move = get_move_for_turn(turn_count)
        opponent_quote = f'\n{their_name} just said: "{last_opponent}"' if last_opponent else ""
        phase_instruction = _load_prompt("debater_rebuttal.txt").format(
            topic=topic, role_for="FOR", wl=wl, opponent_name=their_name,
            opponent_quote=opponent_quote, move=move,
        )

    prompt = _build_debater_prompt(
        role_label="Proponent", role_for="FOR", my_name=my_name, opponent_name=their_name,
        topic=topic, language=language, identity=identity, history=history,
        phase=phase, phase_instruction=phase_instruction, profile_data=profile_data,
        additional_instruction=additional_instruction,
    )

    logger.info(f"[PROPONENT:{my_name}] Calling LLM ({LLM_PROVIDER}:{MODEL_PROPONENT})...")
    response = await llm.ainvoke(prompt)
    logger.info(f"[PROPONENT:{my_name}] Response received ({len(response.content)} chars)")
    return {"messages": [f"Proponent: {response.content}"], "current_speaker": "opponent", "turn_count": state["turn_count"] + 1}


async def opponent_node(state: DebateState, config: RunnableConfig):
    turn_count = state["turn_count"]
    phase = get_debate_phase(turn_count, state.get("max_turns", MAX_TURNS))
    my_name = state.get("opponent_name", "Opponent")
    their_name = state.get("proponent_name", "Proponent")
    logger.info(f"[OPPONENT:{my_name}] Turn {turn_count}, phase: {phase}, profile: {state.get('opponent_profile')}, tone: {state.get('opponent_tone')}")
    configurable = config.get("configurable", {})
    tracker = configurable.get("token_tracker")
    stream_cb = configurable.get("stream_callback")
    speaker_ref = configurable.get("current_speaker_ref")
    if speaker_ref is not None:
        speaker_ref["name"] = "opponent"
    llm = get_model(MODEL_OPPONENT, label=f"opponent-turn-{turn_count}", token_tracker=tracker, stream_callback=stream_cb)
    messages = state["messages"]
    topic = state.get("topic", "AI Safety")
    profile_data = get_profile_data(state.get("opponent_profile", "Empiricism"))
    tone_data = get_tone_data(state.get("opponent_tone", "Skeptical"))
    language = state.get("opponent_language", "English")

    identity = build_identity_prompt(profile_data, tone_data)

    # Check for external moderator instruction
    additional_instruction = ""
    if "configurable" in config and "input_queue" in config["configurable"]:
        queue = config["configurable"]["input_queue"]
        if not queue.empty():
            user_input = queue.get_nowait()
            additional_instruction = f"\nThe host just directed you: {user_input}. Address this."

    # Extract what the proponent last said
    last_proponent = get_last_opponent_message(messages, "Opponent")
    wl = random_word_limit()

    if phase == "opening":
        history = format_history(messages)
        phase_instruction = _load_prompt("debater_opening.txt").format(
            role_intro="Your turn to respond. ", topic=topic, role_for="AGAINST", wl=wl, opponent_name=their_name,
        )
    elif phase == "closing":
        history = format_history(messages, window=8)
        phase_instruction = _load_prompt("debater_closing.txt").format(
            topic=topic, role_for="AGAINST", wl=wl, opponent_name=their_name,
        )
    else:
        history = format_history(messages, window=6)
        move = get_move_for_turn(turn_count)
        proponent_quote = f'\n{their_name} just said: "{last_proponent}"' if last_proponent else ""
        phase_instruction = _load_prompt("debater_rebuttal.txt").format(
            topic=topic, role_for="AGAINST", wl=wl, opponent_name=their_name,
            opponent_quote=proponent_quote, move=move,
        )

    prompt = _build_debater_prompt(
        role_label="Opponent", role_for="AGAINST", my_name=my_name, opponent_name=their_name,
        topic=topic, language=language, identity=identity, history=history,
        phase=phase, phase_instruction=phase_instruction, profile_data=profile_data,
        additional_instruction=additional_instruction,
    )

    logger.info(f"[OPPONENT:{my_name}] Calling LLM ({LLM_PROVIDER}:{MODEL_OPPONENT})...")
    response = await llm.ainvoke(prompt)
    logger.info(f"[OPPONENT:{my_name}] Response received ({len(response.content)} chars)")
    return {"messages": [f"Opponent: {response.content}"], "current_speaker": "proponent", "turn_count": state["turn_count"] + 1}

MODERATOR_INTERVAL = int(os.getenv("MODERATOR_INTERVAL", 3))  # Moderator intervenes every N debater turns

def should_continue_from_moderator(state: DebateState):
    """Route after moderator — never loops back to moderator."""
    turn_count = state["turn_count"]
    mt = state.get("max_turns", MAX_TURNS)
    if turn_count > mt:
        logger.info(f"[ROUTER] Turn {turn_count} > max_turns ({mt}) → verdict")
        return "verdict"
    next_speaker = state["current_speaker"]
    logger.info(f"[ROUTER] Turn {turn_count}/{mt} → {next_speaker} (from moderator)")
    return next_speaker

def should_continue(state: DebateState):
    """Route after debater — may redirect to moderator for interventions."""
    turn_count = state["turn_count"]
    mt = state.get("max_turns", MAX_TURNS)
    if turn_count > mt:
        logger.info(f"[ROUTER] Turn {turn_count} > max_turns ({mt}) → verdict")
        return "verdict"

    next_speaker = state["current_speaker"]

    # Moderator intervenes every MODERATOR_INTERVAL debater turns (after opening)
    if turn_count > 2 and turn_count % MODERATOR_INTERVAL == 0:
        logger.info(f"[ROUTER] Turn {turn_count}/{mt} → moderator (intervention every {MODERATOR_INTERVAL} turns)")
        return "moderator"

    logger.info(f"[ROUTER] Turn {turn_count}/{mt} → {next_speaker}")
    return next_speaker

def create_debate_graph():
    workflow = StateGraph(DebateState)

    workflow.add_node("moderator", moderator_node)
    workflow.add_node("proponent", proponent_node)
    workflow.add_node("opponent", opponent_node)
    workflow.add_node("verdict", verdict_node)

    workflow.set_entry_point("moderator")

    workflow.add_conditional_edges(
        "moderator",
        should_continue_from_moderator,
        {"proponent": "proponent", "opponent": "opponent", "verdict": "verdict"}
    )

    workflow.add_conditional_edges(
        "proponent",
        should_continue,
        {"opponent": "opponent", "moderator": "moderator", "verdict": "verdict"}
    )

    workflow.add_conditional_edges(
        "opponent",
        should_continue,
        {"proponent": "proponent", "moderator": "moderator", "verdict": "verdict"}
    )

    workflow.add_edge("verdict", END)

    return workflow
