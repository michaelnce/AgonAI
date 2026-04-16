import smtplib
import os
import logging
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import HTTPException

from backend.models import EmailRequest

logger = logging.getLogger("debate.api")


def _resolve_speaker(speaker: str, pro_name: str, opp_name: str) -> tuple:
    """Return (display_name, role_label, color) for a speaker."""
    s = speaker.lower()
    if "proponent" in s:
        return pro_name, "PRO", "#3b82f6"
    elif "opponent" in s:
        return opp_name, "OPP", "#a855f7"
    return "Moderator", "HOST", "#64748b"


def _fmt_duration(ms: int) -> str:
    if ms < 1000:
        return f"{ms}ms"
    s = ms // 1000
    m = s // 60
    s = s % 60
    return f"{m}m {s}s" if m > 0 else f"{s}s"


def _build_messages_html(messages, pro_name: str, opp_name: str) -> str:
    html = ""
    for m in messages:
        name, role, color = _resolve_speaker(m.speaker, pro_name, opp_name)
        html += f"""
        <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid {color}; background-color: #f8fafc; border-radius: 4px;">
            <div style="font-size: 10px; font-weight: bold; color: {color}; margin-bottom: 4px;">{name} <span style="color: #94a3b8; font-weight: normal;">({role})</span></div>
            <div style="font-size: 14px; color: #1e293b; line-height: 1.5;">{m.content}</div>
        </div>
        """
    return html


def _build_recommendations_html(verdict: dict) -> str:
    if not verdict.get('recommendations'):
        return ""
    recs = "".join([f"<li style='margin-bottom: 8px;'>{r}</li>" for r in verdict['recommendations']])
    return f"""
    <div style="margin-top: 24px; padding: 20px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px;">
        <h3 style="margin-top: 0; color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">📚 Further Reading</h3>
        <ul style="margin: 0; padding-left: 20px; color: #b45309; font-size: 14px;">{recs}</ul>
    </div>
    """


def _build_references_html(verdict: dict) -> str:
    if not verdict.get('references'):
        return ""
    refs = "".join([f"<li style='margin-bottom: 8px;'>{r}</li>" for r in verdict['references']])
    return f"""
    <div style="margin-top: 24px; padding: 20px; background-color: #ecfeff; border: 1px solid #cffafe; border-radius: 12px;">
        <h3 style="margin-top: 0; color: #155e75; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">📑 Sources Cited During Debate</h3>
        <ul style="margin: 0; padding-left: 20px; color: #0e7490; font-size: 14px;">{refs}</ul>
    </div>
    """


def _build_stats_html(token_usage: dict, total_wall_time_ms: Optional[int]) -> str:
    if not token_usage:
        return ""
    tu = token_usage
    total_tokens = tu.get('total_input_tokens', 0) + tu.get('total_output_tokens', 0)
    num_calls = len(tu.get('calls', []))
    api_duration_ms = tu.get('total_duration_ms', 0)
    wall_time_ms = total_wall_time_ms or api_duration_ms

    calls_rows = ""
    for call in tu.get('calls', []):
        calls_rows += f"""
        <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-size: 12px;">{call.get('label','')}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{call.get('input_tokens',0):,}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{call.get('output_tokens',0):,}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{call.get('cache_read',0):,}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-family: monospace; font-size: 12px;">{_fmt_duration(call.get('duration_ms',0))}</td>
        </tr>"""

    return f"""
    <div style="margin-top: 24px; padding: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
        <h3 style="margin-top: 0; color: #166534; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Performance Stats</h3>
        <table style="width: 100%; font-size: 13px; color: #334155; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>Total Wall Time</b></td>
                <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{_fmt_duration(wall_time_ms)}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7;"><b>API Processing Time</b></td>
                <td style="padding: 6px 0; border-bottom: 1px solid #dcfce7; text-align: right; font-family: monospace;">{_fmt_duration(api_duration_ms)}</td>
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


def _build_fact_check_html(fact_checks: Optional[list]) -> str:
    if not fact_checks:
        return ""
    verdict_colors = {
        "VERIFIED": ("#166534", "#f0fdf4", "#bbf7d0"),
        "DISPUTED": ("#854d0e", "#fefce8", "#fef9c3"),
        "FALSE": ("#991b1b", "#fef2f2", "#fecaca"),
        "UNVERIFIABLE": ("#374151", "#f9fafb", "#e5e7eb"),
    }
    verified = sum(1 for f in fact_checks if f.get("verdict") == "VERIFIED")
    disputed = sum(1 for f in fact_checks if f.get("verdict") == "DISPUTED")
    false_c = sum(1 for f in fact_checks if f.get("verdict") == "FALSE")
    unverifiable = sum(1 for f in fact_checks if f.get("verdict") == "UNVERIFIABLE")

    claims_html = ""
    for fc in fact_checks:
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

    return f"""
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


def build_email_html(request: EmailRequest) -> str:
    """Build the full HTML email body for a debate summary."""
    pro_name = (request.agent_names or {}).get("proponent", "Proponent")
    opp_name = (request.agent_names or {}).get("opponent", "Opponent")

    messages_html = _build_messages_html(request.messages, pro_name, opp_name)
    recommendations_html = _build_recommendations_html(request.verdict)
    references_html = _build_references_html(request.verdict)
    stats_html = _build_stats_html(request.token_usage, request.total_wall_time_ms) if request.token_usage else ""
    fact_check_html = _build_fact_check_html(request.fact_checks)

    scores = request.verdict.get('scores', {})
    pro_scores = scores.get('proponent', {})
    opp_scores = scores.get('opponent', {})
    winner_role = request.verdict.get('winner', 'Unknown')
    winner_name = pro_name if winner_role.lower() == 'proponent' else opp_name
    reasoning = request.verdict.get('reasoning', 'No rationale provided.')

    return f"""
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
                            Logic: <b>{pro_scores.get('logic', '-')}</b><br>
                            Evidence: <b>{pro_scores.get('evidence', '-')}</b><br>
                            Style: <b>{pro_scores.get('style', '-')}</b>
                        </div>
                    </div>
                    <div style="flex: 1; padding: 16px; background-color: #faf5ff; border-radius: 8px; border-left: 4px solid #a855f7;">
                        <div style="font-size: 13px; font-weight: bold; color: #a855f7; margin-bottom: 2px;">{opp_name}</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px;">{request.opponent['profile']} &bull; OPP</div>
                        <div style="font-size: 12px; color: #581c87;">
                            Logic: <b>{opp_scores.get('logic', '-')}</b><br>
                            Evidence: <b>{opp_scores.get('evidence', '-')}</b><br>
                            Style: <b>{opp_scores.get('style', '-')}</b>
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


def send_email(request: EmailRequest) -> dict:
    """Send the debate summary email via SMTP."""
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SENDER_EMAIL", smtp_user)

    if not all([smtp_server, smtp_user, smtp_pass]):
        raise HTTPException(status_code=500, detail="Email configuration is missing in .env")

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = request.recipient_email
    msg['Subject'] = f"⚖️ Debate Results: {request.topic}"
    msg.attach(MIMEText(build_email_html(request), 'html'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        return {"status": "success", "message": "Email sent successfully"}
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail=str(e))
