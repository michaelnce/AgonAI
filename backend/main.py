import os
import logging
import json
import uuid
import random
import asyncio
from typing import Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from backend.models import MessageRequest, EmailRequest, BestMatchRequest
from backend.graph import get_model, MODEL_MODERATOR, PROFILES, TONES, MAX_TURNS, MAX_TURNS_MIN
from backend.storage import save_debate, list_debates, get_debate, delete_debate
from backend.services.email_service import send_email
from backend.services.fact_check import fact_check_messages_stream
from backend.services.streaming import event_generator, ACTIVE_DEBATES

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("debate.api")

app = FastAPI()


# --- Health ---

@app.get("/health")
async def health_check():
    return {"status": "ok"}


# --- Debate persistence ---

@app.get("/api/debates")
async def api_list_debates():
    return list_debates()

@app.get("/api/debates/{debate_id}")
async def api_get_debate(debate_id: str):
    debate = get_debate(debate_id)
    if debate is None:
        raise HTTPException(status_code=404, detail="Debate not found")
    return debate

@app.post("/api/debates")
async def api_save_debate(request: Request):
    body = await request.json()
    if not body.get("id"):
        raise HTTPException(status_code=400, detail="Debate must have an 'id' field")
    debate_id = save_debate(body)
    return {"status": "saved", "id": debate_id}

@app.delete("/api/debates/{debate_id}")
async def api_delete_debate(debate_id: str):
    found = delete_debate(debate_id)
    if not found:
        raise HTTPException(status_code=404, detail="Debate not found")
    return {"status": "deleted"}


# --- Email ---

@app.post("/api/debate/email")
async def send_debate_email(request: EmailRequest):
    return send_email(request)


# --- Live debate messaging ---

@app.post("/api/debate/{debate_id}/message")
async def send_message(debate_id: str, request: MessageRequest):
    if debate_id in ACTIVE_DEBATES:
        await ACTIVE_DEBATES[debate_id].put(request.message)
        return {"status": "sent"}
    return {"status": "error", "message": "Debate ID not found or inactive"}


# --- On-demand fact-check ---

@app.post("/api/debate/fact-check")
async def run_fact_check(request: Request):
    """Run fact-check on debate messages, one message at a time, streamed via SSE."""
    from backend.graph import LLM_PROVIDER

    body = await request.json()
    messages = body.get("messages", [])
    logger.info(f"[FACT-CHECK] Received request with {len(messages)} messages (provider: {LLM_PROVIDER})")

    if LLM_PROVIDER != "claude":
        raise HTTPException(status_code=400, detail="Fact-checking is only available with the Claude provider")

    debater_messages = [
        m for m in messages
        if m.get("speaker", "").lower() in ("proponent", "opponent")
        and not m.get("content", "").startswith("The debate has concluded")
    ]

    if not debater_messages:
        raise HTTPException(status_code=400, detail="No debater messages to fact-check")

    logger.info(f"[FACT-CHECK] Will process {len(debater_messages)} debater messages individually")

    async def stream():
        from backend.claude_llm import TokenTracker
        token_tracker = TokenTracker()
        async for event in fact_check_messages_stream(debater_messages, token_tracker):
            yield event

    return StreamingResponse(stream(), media_type="text/event-stream")


# --- Best-match resolution ---

@app.post("/api/debate/resolve-best-match")
async def resolve_best_match(request: BestMatchRequest):
    logger.info(f"[BEST-MATCH] Request received — topic: '{request.topic}'")
    profile_names = [p["Movement"] for p in PROFILES]
    tone_names = [t["tone"] for t in TONES]

    fields_to_resolve = []
    if request.resolve_proponent_profile:
        fields_to_resolve.append("proponent_profile")
    if request.resolve_opponent_profile:
        fields_to_resolve.append("opponent_profile")
    if request.resolve_proponent_tone:
        fields_to_resolve.append("proponent_tone")
    if request.resolve_opponent_tone:
        fields_to_resolve.append("opponent_tone")

    if not fields_to_resolve:
        return {}

    context_lines = []
    if request.current_proponent_profile and request.current_proponent_profile not in ("__random__", "__best_match__"):
        context_lines.append(f"Proponent is already: {request.current_proponent_profile}")
    if request.current_opponent_profile and request.current_opponent_profile not in ("__random__", "__best_match__"):
        context_lines.append(f"Opponent is already: {request.current_opponent_profile}")
    context_str = ("\n" + "\n".join(context_lines)) if context_lines else ""

    profile_categories = {}
    for p in PROFILES:
        cat = p["Category"]
        if cat not in profile_categories:
            profile_categories[cat] = []
        profile_categories[cat].append(p["Movement"])
    profile_list = "; ".join(f"{cat}: {', '.join(moves)}" for cat, moves in profile_categories.items())
    tone_list = ", ".join(tone_names)

    prompt = f"""Topic: "{request.topic}"
{context_str}
Profiles: {profile_list}
Tones: {tone_list}

Pick the best profile and tone for each debater. Profiles must clash on this topic. Tones must contrast.
Return ONLY JSON with keys: {json.dumps(fields_to_resolve)}. Values must be exact names from the lists."""

    try:
        logger.info(f"[BEST-MATCH] Calling LLM ({MODEL_MODERATOR}) to resolve: {fields_to_resolve}")
        llm = get_model(MODEL_MODERATOR, label="best-match")
        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=30.0)
        raw = response.content.strip().replace("```json", "").replace("```", "").strip()
        resolved = json.loads(raw)

        result = {}
        for field in fields_to_resolve:
            value = resolved.get(field)
            if field.endswith("_profile"):
                result[field] = value if value in profile_names else random.choice(profile_names)
            elif field.endswith("_tone"):
                result[field] = value if value in tone_names else random.choice(tone_names)

        if "proponent_profile" in result and "opponent_profile" in result:
            if result["proponent_profile"] == result["opponent_profile"]:
                others = [p for p in profile_names if p != result["proponent_profile"]]
                result["opponent_profile"] = random.choice(others)

        logger.info(f"[BEST-MATCH] Resolved: {result}")
        return result
    except asyncio.TimeoutError:
        logger.warning("[BEST-MATCH] LLM call timed out after 30s, falling back to random")
    except Exception as e:
        logger.error(f"[BEST-MATCH] Failed, falling back to random: {e}", exc_info=True)

    result = {}
    for field in fields_to_resolve:
        if field.endswith("_profile"):
            result[field] = random.choice(profile_names)
        elif field.endswith("_tone"):
            result[field] = random.choice(tone_names)
    logger.info(f"[BEST-MATCH] Random fallback: {result}")
    return result


# --- Problem Solver ---

@app.post("/api/problem/resolve-agents")
async def resolve_problem_agents(request: Request):
    """Best-match resolution for 5 problem-solving agents."""
    body = await request.json()
    problem = body.get("problem", "")
    agents = body.get("agents", {})
    logger.info(f"[PROBLEM-MATCH] Request for problem: '{problem[:60]}'")

    profile_names = [p["Movement"] for p in PROFILES]
    tone_names = [t["tone"] for t in TONES]

    fields_to_resolve = {}
    for role, cfg in agents.items():
        resolve_profile = cfg.get("resolve_profile", False)
        resolve_tone = cfg.get("resolve_tone", False)
        if resolve_profile or resolve_tone:
            fields_to_resolve[role] = {"profile": resolve_profile, "tone": resolve_tone}

    if not fields_to_resolve:
        return {}

    profile_categories = {}
    for p in PROFILES:
        cat = p["Category"]
        if cat not in profile_categories:
            profile_categories[cat] = []
        profile_categories[cat].append(p["Movement"])
    profile_list = "; ".join(f"{cat}: {', '.join(moves)}" for cat, moves in profile_categories.items())
    tone_list = ", ".join(tone_names)

    roles_desc = ", ".join(f"{r} ({'' if f.get('profile') else 'tone only'})" for r, f in fields_to_resolve.items())

    prompt = f"""Problem: "{problem}"

5 specialist roles solving this problem: Analyst, Creative, Critic, Pragmatist, Synthesizer.
Roles to assign: {roles_desc}

Available profiles: {profile_list}
Available tones: {tone_list}

Pick the best profile and tone for each role. Profiles should give DIVERSE worldviews on this problem. Tones should contrast.
Return ONLY JSON: {{"analyst": {{"profile": "...", "tone": "..."}}, "creative": {{...}}, ...}}
Only include roles that need resolution. Values must be exact names from the lists."""

    try:
        llm = get_model(MODEL_MODERATOR, label="problem-best-match")
        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=30.0)
        raw = response.content.strip().replace("```json", "").replace("```", "").strip()
        resolved = json.loads(raw)

        result = {}
        used_profiles = set()
        for role in ["analyst", "creative", "critic", "pragmatist", "synthesizer"]:
            if role not in fields_to_resolve:
                continue
            role_data = resolved.get(role, {})
            r = {}
            if fields_to_resolve[role].get("profile"):
                p = role_data.get("profile", "")
                if p in profile_names and p not in used_profiles:
                    r["profile"] = p
                    used_profiles.add(p)
                else:
                    available = [x for x in profile_names if x not in used_profiles]
                    r["profile"] = random.choice(available) if available else random.choice(profile_names)
                    used_profiles.add(r["profile"])
            if fields_to_resolve[role].get("tone"):
                t = role_data.get("tone", "")
                r["tone"] = t if t in tone_names else random.choice(tone_names)
            result[role] = r

        logger.info(f"[PROBLEM-MATCH] Resolved: {result}")
        return result
    except asyncio.TimeoutError:
        logger.warning("[PROBLEM-MATCH] Timed out, falling back to random")
    except Exception as e:
        logger.error(f"[PROBLEM-MATCH] Failed: {e}", exc_info=True)

    result = {}
    used_profiles = set()
    for role in fields_to_resolve:
        r = {}
        if fields_to_resolve[role].get("profile"):
            available = [x for x in profile_names if x not in used_profiles]
            r["profile"] = random.choice(available) if available else random.choice(profile_names)
            used_profiles.add(r["profile"])
        if fields_to_resolve[role].get("tone"):
            r["tone"] = random.choice(tone_names)
        result[role] = r
    return result


@app.get("/api/problem/stream")
async def stream_problem(
    problem: str = "How to reduce cloud costs by 40%",
    analyst_profile: str = "__random__",
    analyst_tone: str = "__random__",
    analyst_language: str = "English",
    creative_profile: str = "__random__",
    creative_tone: str = "__random__",
    creative_language: str = "English",
    critic_profile: str = "__random__",
    critic_tone: str = "__random__",
    critic_language: str = "English",
    pragmatist_profile: str = "__random__",
    pragmatist_tone: str = "__random__",
    pragmatist_language: str = "English",
    synthesizer_profile: str = "__random__",
    synthesizer_tone: str = "__random__",
    synthesizer_language: str = "English",
    fact_check: bool = True,
):
    from backend.services.problem_streaming import problem_event_generator
    from backend.problem_graph import AGENT_ROLES
    import random as rnd

    session_id = str(uuid.uuid4())
    logger.info(f"[API] /api/problem/stream called — session_id: {session_id[:8]}, problem: '{problem[:60]}'")

    profile_names = [p["Movement"] for p in PROFILES]
    tone_names = [t["tone"] for t in TONES]

    def resolve(val, pool):
        return rnd.choice(pool) if val == "__random__" else val

    agent_configs = {
        "analyst": {"profile": resolve(analyst_profile, profile_names), "tone": resolve(analyst_tone, tone_names), "language": analyst_language},
        "creative": {"profile": resolve(creative_profile, profile_names), "tone": resolve(creative_tone, tone_names), "language": creative_language},
        "critic": {"profile": resolve(critic_profile, profile_names), "tone": resolve(critic_tone, tone_names), "language": critic_language},
        "pragmatist": {"profile": resolve(pragmatist_profile, profile_names), "tone": resolve(pragmatist_tone, tone_names), "language": pragmatist_language},
        "synthesizer": {"profile": resolve(synthesizer_profile, profile_names), "tone": resolve(synthesizer_tone, tone_names), "language": synthesizer_language},
    }

    # Ensure all profiles are distinct
    used_profiles = set()
    for role in AGENT_ROLES:
        while agent_configs[role]["profile"] in used_profiles:
            agent_configs[role]["profile"] = rnd.choice(profile_names)
        used_profiles.add(agent_configs[role]["profile"])

    # Determine facilitator language (majority language)
    langs = [agent_configs[r]["language"] for r in AGENT_ROLES]
    facilitator_language = max(set(langs), key=langs.count)

    return StreamingResponse(
        problem_event_generator(
            session_id, problem, agent_configs,
            facilitator_language, fact_check,
        ),
        media_type="text/event-stream",
    )


# --- SSE debate stream ---

@app.get("/api/debate/stream")
async def stream_debate(
    topic: str = "AI Safety",
    proponent_profile: str = "Analytical Scholar",
    proponent_tone: str = "Assertive",
    proponent_language: str = "English",
    opponent_profile: str = "Creative Disruptor",
    opponent_tone: str = "Socratic",
    opponent_language: str = "English",
    moderator_language: str = "English",
    limit: Optional[int] = None,
    fact_check: bool = True,
):
    debate_id = str(uuid.uuid4())
    logger.info(f"[API] /api/debate/stream called — debate_id: {debate_id[:8]}, topic: '{topic}', fact_check: {fact_check}")
    return StreamingResponse(
        event_generator(
            debate_id, topic,
            proponent_profile, proponent_tone, proponent_language,
            opponent_profile, opponent_tone, opponent_language,
            moderator_language, limit, fact_check,
        ),
        media_type="text/event-stream",
    )
