import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import json
import uuid
from typing import Optional, Dict, List, Any
from pydantic import BaseModel
from backend.graph import create_debate_graph, get_model, MODEL_MODERATOR, PROFILES, TONES, MAX_TURNS, MAX_TURNS_MIN
from dotenv import load_dotenv
import random

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("debate.api")

app = FastAPI()

logger.info("Compiling debate workflow graph...")
debate_workflow = create_debate_graph().compile()
logger.info("Debate workflow graph compiled successfully")

# Store active debate queues: debate_id -> asyncio.Queue
ACTIVE_DEBATES: Dict[str, asyncio.Queue] = {}

class MessageRequest(BaseModel):
    message: str

class Message(BaseModel):
    speaker: str
    content: str
    turn: Optional[Any] = None
    timestamp: Optional[str] = None

class EmailRequest(BaseModel):
    recipient_email: str
    topic: str
    proponent: Dict[str, Any]
    opponent: Dict[str, Any]
    messages: List[Message]
    verdict: Dict[str, Any]
    token_usage: Optional[Dict[str, Any]] = None
    total_wall_time_ms: Optional[int] = None
    agent_names: Optional[Dict[str, str]] = None
    fact_checks: Optional[List[Dict[str, Any]]] = None

@app.get("/health")
async def health_check():
    logger.debug("Health check called")
    return {"status": "ok"}

@app.post("/api/debate/email")
async def send_debate_email(request: EmailRequest):
    # Get email settings from environment
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SENDER_EMAIL", smtp_user)

    if not all([smtp_server, smtp_user, smtp_pass]):
        raise HTTPException(status_code=500, detail="Email configuration is missing in .env")

    # Construct email body
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = request.recipient_email
    msg['Subject'] = f"⚖️ Debate Results: {request.topic}"

    # Resolve agent names
    pro_name = (request.agent_names or {}).get("proponent", "Proponent")
    opp_name = (request.agent_names or {}).get("opponent", "Opponent")

    def resolve_speaker(speaker: str) -> tuple:
        """Return (display_name, role_label, color) for a speaker."""
        s = speaker.lower()
        if "proponent" in s:
            return pro_name, "PRO", "#3b82f6"
        elif "opponent" in s:
            return opp_name, "OPP", "#a855f7"
        return "Moderator", "HOST", "#64748b"

    # Generate messages HTML
    messages_html = ""
    for m in request.messages:
        name, role, color = resolve_speaker(m.speaker)
        messages_html += f"""
        <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid {color}; background-color: #f8fafc; border-radius: 4px;">
            <div style="font-size: 10px; font-weight: bold; color: {color}; margin-bottom: 4px;">{name} <span style="color: #94a3b8; font-weight: normal;">({role})</span></div>
            <div style="font-size: 14px; color: #1e293b; line-height: 1.5;">{m.content}</div>
        </div>
        """

    recommendations_html = ""
    if request.verdict.get('recommendations'):
        recs = "".join([f"<li style='margin-bottom: 8px;'>{r}</li>" for r in request.verdict['recommendations']])
        recommendations_html = f"""
        <div style="margin-top: 24px; padding: 20px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px;">
            <h3 style="margin-top: 0; color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">📚 Further Reading</h3>
            <ul style="margin: 0; padding-left: 20px; color: #b45309; font-size: 14px;">{recs}</ul>
        </div>
        """

    references_html = ""
    if request.verdict.get('references'):
        refs = "".join([f"<li style='margin-bottom: 8px;'>{r}</li>" for r in request.verdict['references']])
        references_html = f"""
        <div style="margin-top: 24px; padding: 20px; background-color: #ecfeff; border: 1px solid #cffafe; border-radius: 12px;">
            <h3 style="margin-top: 0; color: #155e75; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">📑 Sources Cited During Debate</h3>
            <ul style="margin: 0; padding-left: 20px; color: #0e7490; font-size: 14px;">{refs}</ul>
        </div>
        """

    # Build stats HTML
    stats_html = ""
    if request.token_usage:
        tu = request.token_usage
        total_tokens = tu.get('total_input_tokens', 0) + tu.get('total_output_tokens', 0)
        num_calls = len(tu.get('calls', []))
        api_duration_ms = tu.get('total_duration_ms', 0)
        wall_time_ms = request.total_wall_time_ms or api_duration_ms

        def fmt_duration(ms):
            if ms < 1000:
                return f"{ms}ms"
            s = ms // 1000
            m = s // 60
            s = s % 60
            return f"{m}m {s}s" if m > 0 else f"{s}s"

        calls_rows = ""
        for i, call in enumerate(tu.get('calls', []), 1):
            calls_rows += f"""
            <tr>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-size: 12px;">{call.get('label','')}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{call.get('input_tokens',0):,}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{call.get('output_tokens',0):,}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{call.get('cache_read',0):,}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{fmt_duration(call.get('duration_ms',0))}</td>
            </tr>"""

        stats_html = f"""
        <div style="margin-top: 24px; padding: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
            <h3 style="margin-top: 0; color: #166534; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Performance Stats</h3>
            <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse; margin-bottom: 16px;">
                <tr>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>Total Wall Time</b></td>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{fmt_duration(wall_time_ms)}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>API Processing Time</b></td>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{fmt_duration(api_duration_ms)}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>LLM Calls</b></td>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{num_calls}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>Total Tokens</b></td>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{total_tokens:,}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>Input / Output</b></td>
                    <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{tu.get('total_input_tokens',0):,} / {tu.get('total_output_tokens',0):,}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0;"><b>Cache (Read / Create)</b></td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace;">{tu.get('total_cache_read_tokens',0):,} / {tu.get('total_cache_creation_tokens',0):,}</td>
                </tr>
            </table>

            <h4 style="margin: 0 0 8px; color: #166534; font-size: 12px; text-transform: uppercase;">Per-Call Breakdown</h4>
            <table style="width: 100%; font-size: 12px; color: #334155; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #bbf7d0;">
                        <th style="padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #6b7280;">Call</th>
                        <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #6b7280;">In</th>
                        <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #6b7280;">Out</th>
                        <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #6b7280;">Cache</th>
                        <th style="padding: 6px 8px; text-align: right; font-size: 10px; text-transform: uppercase; color: #6b7280;">Duration</th>
                    </tr>
                </thead>
                <tbody>{calls_rows}</tbody>
            </table>
        </div>
        """

    # Build fact-check HTML
    fact_check_html = ""
    if request.fact_checks:
        verdict_colors = {
            "VERIFIED": ("#166534", "#f0fdf4", "#bbf7d0"),
            "DISPUTED": ("#854d0e", "#fefce8", "#fef9c3"),
            "FALSE": ("#991b1b", "#fef2f2", "#fecaca"),
            "UNVERIFIABLE": ("#374151", "#f9fafb", "#e5e7eb"),
        }
        verified = sum(1 for f in request.fact_checks if f.get("verdict") == "VERIFIED")
        disputed = sum(1 for f in request.fact_checks if f.get("verdict") == "DISPUTED")
        false_c = sum(1 for f in request.fact_checks if f.get("verdict") == "FALSE")
        unverifiable = sum(1 for f in request.fact_checks if f.get("verdict") == "UNVERIFIABLE")

        claims_html = ""
        for fc in request.fact_checks:
            v = fc.get("verdict", "UNVERIFIABLE")
            text_color, bg_color, border_color = verdict_colors.get(v, verdict_colors["UNVERIFIABLE"])
            claims_html += f"""
            <div style="padding: 10px 12px; border-left: 4px solid {border_color}; background-color: {bg_color}; border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <span style="font-size: 12px; color: #1e293b; flex: 1;">"{fc.get('claim', '')}"</span>
                    <span style="font-size: 10px; font-weight: bold; color: {text_color}; background: {border_color}; padding: 2px 8px; border-radius: 4px; margin-left: 8px; white-space: nowrap;">{v}</span>
                </div>
                <div style="font-size: 11px; color: #64748b;">
                    <b>{fc.get('speaker', '')}</b> &mdash; {fc.get('explanation', '')}
                </div>
            </div>"""

        fact_check_html = f"""
        <div style="margin-top: 24px; padding: 20px; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px;">
            <h3 style="margin-top: 0; color: #9a3412; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Fact-Check Report</h3>
            <div style="display: flex; gap: 12px; margin-bottom: 16px; font-size: 12px; font-weight: bold;">
                <span style="color: #166534;">{verified} Verified</span>
                <span style="color: #854d0e;">{disputed} Disputed</span>
                <span style="color: #991b1b;">{false_c} False</span>
                <span style="color: #374151;">{unverifiable} Unverifiable</span>
            </div>
            {claims_html}
        </div>
        """

    # Safely extract scores with defaults
    scores = request.verdict.get('scores', {})
    pro_scores = scores.get('proponent', {})
    opp_scores = scores.get('opponent', {})
    pro_logic = pro_scores.get('logic', '-')
    pro_evidence = pro_scores.get('evidence', '-')
    pro_style = pro_scores.get('style', '-')
    opp_logic = opp_scores.get('logic', '-')
    opp_evidence = opp_scores.get('evidence', '-')
    opp_style = opp_scores.get('style', '-')
    winner_role = request.verdict.get('winner', 'Unknown')
    winner_name = pro_name if winner_role.lower() == 'proponent' else opp_name
    reasoning = request.verdict.get('reasoning', 'No rationale provided.')

    body = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <!-- Header -->
            <div style="background-color: #1e293b; padding: 32px 24px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">⚖️</div>
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">DEBATE SUMMARY</h1>
                <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">{request.topic}</p>
            </div>

            <!-- Verdict Card -->
            <div style="padding: 24px;">
                <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Moderator's Verdict</div>
                    <div style="font-size: 28px; font-weight: 900; color: {'#3b82f6' if winner_role.lower() == 'proponent' else '#a855f7'}; text-transform: uppercase;">
                        {winner_name} Wins
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                        {winner_role} &mdash; {request.proponent['profile'] if winner_role.lower() == 'proponent' else request.opponent['profile']}
                    </div>
                    <p style="margin: 16px 0 0; color: #475569; font-size: 14px; line-height: 1.6; font-style: italic;">
                        "{reasoning}"
                    </p>
                </div>

                <!-- Scores -->
                <div style="margin-top: 24px; display: flex; gap: 12px;">
                    <div style="flex: 1; padding: 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <div style="font-size: 13px; font-weight: bold; color: #3b82f6; margin-bottom: 2px;">{pro_name}</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px;">{request.proponent['profile']} &bull; PRO</div>
                        <div style="font-size: 12px; color: #1e3a8a;">
                            Logic: <b>{pro_logic}</b><br>
                            Evidence: <b>{pro_evidence}</b><br>
                            Style: <b>{pro_style}</b>
                        </div>
                    </div>
                    <div style="flex: 1; padding: 16px; background-color: #faf5ff; border-radius: 8px; border-left: 4px solid #a855f7;">
                        <div style="font-size: 13px; font-weight: bold; color: #a855f7; margin-bottom: 2px;">{opp_name}</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px;">{request.opponent['profile']} &bull; OPP</div>
                        <div style="font-size: 12px; color: #581c87;">
                            Logic: <b>{opp_logic}</b><br>
                            Evidence: <b>{opp_evidence}</b><br>
                            Style: <b>{opp_style}</b>
                        </div>
                    </div>
                </div>

                {recommendations_html}

                {references_html}

                {stats_html}

                {fact_check_html}

                <!-- Participants Info -->
                <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <h3 style="margin: 0 0 16px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Participants</h3>
                    <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; color: #3b82f6; font-weight: bold;">{pro_name} (PRO)</td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">{request.proponent['profile']} &bull; {request.proponent['tone']} &bull; {request.proponent.get('language', 'English')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #a855f7; font-weight: bold;">{opp_name} (OPP)</td>
                            <td style="padding: 8px 0; text-align: right;">{request.opponent['profile']} &bull; {request.opponent['tone']} &bull; {request.opponent.get('language', 'English')}</td>
                        </tr>
                    </table>
                </div>

                <!-- History -->
                <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <h3 style="margin: 0 0 16px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Full Transcript</h3>
                    {messages_html}
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">Generated by AgonAI • Adversarial Intelligence Simulation</p>
            </div>
        </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        return {"status": "success", "message": "Email sent successfully"}
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/debate/{debate_id}/message")
async def send_message(debate_id: str, request: MessageRequest):
    if debate_id in ACTIVE_DEBATES:
        await ACTIVE_DEBATES[debate_id].put(request.message)
        return {"status": "sent"}
    return {"status": "error", "message": "Debate ID not found or inactive"}

class BestMatchRequest(BaseModel):
    topic: str
    resolve_proponent_profile: bool = False
    resolve_proponent_tone: bool = False
    resolve_opponent_profile: bool = False
    resolve_opponent_tone: bool = False
    current_proponent_profile: Optional[str] = None
    current_opponent_profile: Optional[str] = None

@app.post("/api/debate/resolve-best-match")
async def resolve_best_match(request: BestMatchRequest):
    logger.info(f"[BEST-MATCH] Request received — topic: '{request.topic}', resolve: profile_pro={request.resolve_proponent_profile}, tone_pro={request.resolve_proponent_tone}, profile_opp={request.resolve_opponent_profile}, tone_opp={request.resolve_opponent_tone}")
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
        logger.info("[BEST-MATCH] No fields to resolve, returning empty")
        return {}

    context_lines = []
    if request.current_proponent_profile and request.current_proponent_profile not in ("__random__", "__best_match__"):
        context_lines.append(f"Proponent is already: {request.current_proponent_profile}")
    if request.current_opponent_profile and request.current_opponent_profile not in ("__random__", "__best_match__"):
        context_lines.append(f"Opponent is already: {request.current_opponent_profile}")
    context_str = ("\n" + "\n".join(context_lines)) if context_lines else ""

    # Build compact profile list grouped by category for a shorter prompt
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
        logger.info(f"[BEST-MATCH] Prompt length: {len(prompt)} chars")
        llm = get_model(MODEL_MODERATOR, label="best-match")
        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=30.0)
        raw = response.content.strip()
        logger.info(f"[BEST-MATCH] LLM raw response: {raw[:200]}")
        # Strip markdown fences if present
        raw = raw.replace("```json", "").replace("```", "").strip()
        resolved = json.loads(raw)

        result = {}
        for field in fields_to_resolve:
            value = resolved.get(field)
            if field.endswith("_profile"):
                if value in profile_names:
                    result[field] = value
                else:
                    result[field] = random.choice(profile_names)
            elif field.endswith("_tone"):
                if value in tone_names:
                    result[field] = value
                else:
                    result[field] = random.choice(tone_names)

        # Ensure distinct profiles
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

    # Fallback (reached on timeout or exception)
    result = {}
    for field in fields_to_resolve:
        if field.endswith("_profile"):
            result[field] = random.choice(profile_names)
        elif field.endswith("_tone"):
            result[field] = random.choice(tone_names)
    logger.info(f"[BEST-MATCH] Random fallback: {result}")
    return result


async def event_generator(
    debate_id: str,
    topic: str,
    proponent_profile: str,
    proponent_tone: str,
    proponent_language: str,
    opponent_profile: str,
    opponent_tone: str,
    opponent_language: str,
    moderator_language: str = "English",
    limit: Optional[int] = None
):
    logger.info(f"[STREAM:{debate_id[:8]}] Event generator started — topic: '{topic}'")
    logger.info(f"[STREAM:{debate_id[:8]}] Proponent: {proponent_profile} / {proponent_tone} / {proponent_language}")
    logger.info(f"[STREAM:{debate_id[:8]}] Opponent:  {opponent_profile} / {opponent_tone} / {opponent_language}")

    # Create input queue for this session
    queue = asyncio.Queue()
    ACTIVE_DEBATES[debate_id] = queue

    # Initial connection message with debate ID
    yield f"data: {json.dumps({'type': 'system', 'content': 'connected', 'debate_id': debate_id})}\n\n"
    debate_max_turns = random.randint(MAX_TURNS_MIN, max(MAX_TURNS, MAX_TURNS_MIN))
    logger.info(f"[STREAM:{debate_id[:8]}] SSE connected, starting debate workflow (max_turns={debate_max_turns})")

    inputs = {
        "messages": [],
        "current_speaker": "moderator",
        "turn_count": 0,
        "max_turns": debate_max_turns,
        "topic": topic,
        "proponent_profile": proponent_profile,
        "proponent_tone": proponent_tone,
        "proponent_language": proponent_language,
        "opponent_profile": opponent_profile,
        "opponent_tone": opponent_tone,
        "opponent_language": opponent_language,
        "moderator_language": moderator_language,
        "proponent_name": "",
        "opponent_name": "",
    }

    # Token tracking for Claude provider
    from backend.graph import LLM_PROVIDER
    token_tracker = None
    if LLM_PROVIDER == "claude":
        from backend.claude_llm import TokenTracker
        token_tracker = TokenTracker()

    # Streaming queue: nodes push partial text chunks here, we yield them as SSE
    stream_queue = asyncio.Queue()
    current_streaming_speaker = {"name": None}  # mutable ref for the callback closure

    async def on_stream_chunk(chunk: str):
        """Called by ChatClaudeCode for each token delta."""
        speaker = current_streaming_speaker["name"]
        if speaker:
            await stream_queue.put(("chunk", speaker, chunk))

    # Configure graph run with the queue, token tracker, and stream callback
    config = {"configurable": {
        "input_queue": queue,
        "token_tracker": token_tracker,
        "stream_callback": on_stream_chunk if LLM_PROVIDER == "claude" else None,
    }}

    try:
        count = 0
        agent_names = {}  # Track assigned names: {proponent: "Dmitri", opponent: "Harper"}
        current_streaming_speaker["name"] = "moderator"  # First node is moderator

        # Run the graph in a background task so we can yield SSE events concurrently
        graph_done = asyncio.Event()
        graph_outputs = []
        graph_error = [None]

        async def run_graph():
            try:
                async for output in debate_workflow.astream(inputs, config=config):
                    graph_outputs.append(output)
                    await stream_queue.put(("node_done", output, None))
            except Exception as e:
                graph_error[0] = e
            finally:
                graph_done.set()
                await stream_queue.put(("finished", None, None))

        graph_task = asyncio.create_task(run_graph())

        while True:
            # Wait for either a stream event or graph completion
            try:
                event_type, payload, chunk = await asyncio.wait_for(stream_queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                # Check if graph finished while we were waiting
                if graph_done.is_set():
                    break
                continue

            if event_type == "chunk":
                # Partial token from LLM — send to frontend
                speaker = payload
                yield f"data: {json.dumps({'type': 'stream_chunk', 'speaker': speaker, 'chunk': chunk})}\n\n"

            elif event_type == "node_done":
                output = payload
                for node_name, node_output in output.items():
                    turn = node_output.get('turn_count', '?')

                    # Capture agent names when assigned by moderator
                    if node_output.get("proponent_name"):
                        agent_names["proponent"] = node_output["proponent_name"]
                    if node_output.get("opponent_name"):
                        agent_names["opponent"] = node_output["opponent_name"]
                        if "proponent" in agent_names and "opponent" in agent_names:
                            yield f"data: {json.dumps({'type': 'agent_names', 'proponent_name': agent_names['proponent'], 'opponent_name': agent_names['opponent']})}\n\n"

                    messages = node_output.get("messages", [])
                    if messages:
                        last_message = messages[-1]
                        logger.info(f"[STREAM:{debate_id[:8]}] Turn {turn} — {node_name}: {last_message[:80]}...")

                        # Signal end of streaming for this turn, send the full message as backup
                        yield f"data: {json.dumps({'type': 'stream_end', 'speaker': node_name, 'content': last_message, 'turn': turn})}\n\n"

                        # Set next speaker for streaming
                        next_speaker = node_output.get("current_speaker", "")
                        current_streaming_speaker["name"] = next_speaker

                    # Check for verdict
                    if "verdict" in node_output:
                        try:
                            verdict_data = node_output["verdict"]
                            verdict_data = verdict_data.replace("```json", "").replace("```", "").strip()
                            logger.info(f"[STREAM:{debate_id[:8]}] Verdict received: {verdict_data[:100]}...")
                            yield f"data: {json.dumps({'type': 'verdict', 'content': verdict_data})}\n\n"
                        except Exception as e:
                            logger.error(f"[STREAM:{debate_id[:8]}] Error parsing verdict: {e}", exc_info=True)

                count += 1
                if limit is not None and count >= limit:
                    logger.info(f"[STREAM:{debate_id[:8]}] Reached limit ({limit}), stopping")
                    graph_task.cancel()
                    break

            elif event_type == "finished":
                break

        if graph_error[0]:
            raise graph_error[0]

        await graph_task

        logger.info(f"[STREAM:{debate_id[:8]}] Debate finished after {count} iterations")

        # Fact-check pass — run after debate finishes
        if LLM_PROVIDER == "claude":
            try:
                logger.info(f"[STREAM:{debate_id[:8]}] Starting fact-check pass...")
                yield f"data: {json.dumps({'type': 'system', 'content': 'fact_checking'})}\n\n"
                # Send keepalive comment to prevent SSE timeout during long LLM call
                yield f": keepalive\n\n"

                # Collect debate messages for fact-checking (skip verdict message)
                all_messages = [m for output in graph_outputs for _, node_out in output.items() for m in node_out.get("messages", []) if not m.startswith("Moderator: The debate has concluded")]
                # Limit transcript size to avoid CLI timeouts
                transcript = "\n\n".join(all_messages[-20:])

                fact_check_llm = get_model(MODEL_MODERATOR, label="fact-check", token_tracker=token_tracker)
                fact_check_prompt = f"""You are a rigorous fact-checker reviewing a debate transcript. Your job is to identify EVERY specific factual claim — dates, statistics, quotes, book titles, historical events, attributions — and verify them.

For each claim, determine:
- VERIFIED: the claim is accurate
- DISPUTED: the claim is partially true but misleading or imprecise
- FALSE: the claim is factually wrong
- UNVERIFIABLE: cannot be confirmed or denied with confidence

Debate transcript:
{transcript}

Return a JSON array of claims. Each item:
{{
  "claim": "the specific factual statement",
  "speaker": "Proponent" or "Opponent" or "Moderator",
  "verdict": "VERIFIED" | "DISPUTED" | "FALSE" | "UNVERIFIABLE",
  "explanation": "brief explanation of why"
}}

Only include SPECIFIC factual claims (dates, numbers, named works, quotes, events). Do NOT fact-check opinions or arguments.
Return ONLY the JSON array, no other text."""

                fact_response = await asyncio.wait_for(
                    fact_check_llm.ainvoke(fact_check_prompt),
                    timeout=90.0
                )
                raw = fact_response.content.strip().replace("```json", "").replace("```", "").strip()
                logger.info(f"[STREAM:{debate_id[:8]}] Fact-check complete: {raw[:200]}...")
                yield f"data: {json.dumps({'type': 'fact_check', 'content': raw})}\n\n"
            except asyncio.TimeoutError:
                logger.error(f"[STREAM:{debate_id[:8]}] Fact-check timed out after 90s")
                yield f"data: {json.dumps({'type': 'fact_check_error', 'content': 'Fact-check timed out'})}\n\n"
            except Exception as e:
                logger.error(f"[STREAM:{debate_id[:8]}] Fact-check failed: {e}", exc_info=True)
                yield f"data: {json.dumps({'type': 'fact_check_error', 'content': str(e)})}\n\n"

        # Log and send token usage summary
        if token_tracker and token_tracker.calls:
            token_tracker.log_summary()
            yield f"data: {json.dumps({'type': 'token_usage', 'content': token_tracker.to_dict()})}\n\n"

        yield f"data: {json.dumps({'type': 'system', 'content': 'finished'})}\n\n"

    except Exception as e:
        logger.error(f"[STREAM:{debate_id[:8]}] Error in event_generator: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    finally:
        # Cleanup queue
        if debate_id in ACTIVE_DEBATES:
            del ACTIVE_DEBATES[debate_id]
        logger.info(f"[STREAM:{debate_id[:8]}] Cleaned up, debate session ended")

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
    limit: Optional[int] = None
):
    debate_id = str(uuid.uuid4())
    logger.info(f"[API] /api/debate/stream called — debate_id: {debate_id[:8]}, topic: '{topic}', limit: {limit}")
    return StreamingResponse(
        event_generator(
            debate_id,
            topic,
            proponent_profile,
            proponent_tone,
            proponent_language,
            opponent_profile,
            opponent_tone,
            opponent_language,
            moderator_language,
            limit
        ),
        media_type="text/event-stream"
    )
