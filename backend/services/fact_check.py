import asyncio
import json
import logging
from typing import AsyncGenerator, List

from backend.graph import get_model, MODEL_FACT_CHECK, LLM_PROVIDER

logger = logging.getLogger("debate.api")


FACT_CHECK_PROMPT = """You are a rigorous fact-checker. Analyze this single debate statement and identify ALL specific factual claims — dates, statistics, quotes, book titles, historical events, attributions.

Speaker: {speaker}
Statement: "{content}"

For each claim, determine:
- VERIFIED: the claim is accurate
- DISPUTED: partially true but misleading or imprecise
- FALSE: factually wrong
- UNVERIFIABLE: cannot be confirmed or denied with confidence

Return a JSON array. Each item:
{{
  "claim": "the specific factual statement",
  "speaker": "{speaker}",
  "verdict": "VERIFIED" | "DISPUTED" | "FALSE" | "UNVERIFIABLE",
  "explanation": "brief explanation"
}}

Only include SPECIFIC factual claims (dates, numbers, named works, quotes, events). Do NOT fact-check opinions or arguments.
If there are NO specific factual claims in this statement, return an empty array: []
Return ONLY the JSON array, no other text."""


def parse_fact_check_json(raw: str) -> list:
    """Parse fact-check JSON from LLM response, handling common formatting issues."""
    raw = raw.strip().replace("```json", "").replace("```", "").strip()
    bracket_start = raw.find("[")
    bracket_end = raw.rfind("]")
    if bracket_start != -1 and bracket_end != -1 and bracket_end > bracket_start:
        raw = raw[bracket_start:bracket_end + 1]
    return json.loads(raw)


async def fact_check_message(
    speaker: str,
    content: str,
    msg_num: int,
    token_tracker=None,
) -> list:
    """Fact-check a single debate message. Returns a list of claim dicts."""
    llm = get_model(
        MODEL_FACT_CHECK,
        label=f"fact-check-msg-{msg_num}",
        token_tracker=token_tracker,
        max_turns=3,
    )
    prompt = FACT_CHECK_PROMPT.format(speaker=speaker, content=content)

    response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=60.0)
    raw = response.content.strip()
    return parse_fact_check_json(raw)


async def fact_check_messages_stream(
    debater_messages: List[dict],
    token_tracker=None,
) -> AsyncGenerator[str, None]:
    """Fact-check multiple messages, yielding SSE events for progress, partial results, and completion."""
    total = len(debater_messages)
    all_checks = []

    for idx, msg in enumerate(debater_messages):
        speaker = msg.get("speaker", msg.get("speaker", "Unknown"))
        content = msg.get("content", "")
        msg_num = idx + 1

        logger.info(f"[FACT-CHECK] Processing message {msg_num}/{total} ({speaker}, {len(content)} chars)")
        yield f"data: {json.dumps({'type': 'progress', 'current': msg_num, 'total': total, 'speaker': speaker})}\n\n"

        try:
            checks = await fact_check_message(speaker, content, msg_num, token_tracker)
            if checks:
                all_checks.extend(checks)
                yield f"data: {json.dumps({'type': 'partial', 'checks': checks, 'message_num': msg_num})}\n\n"
                logger.info(f"[FACT-CHECK] Message {msg_num}/{total}: found {len(checks)} claims")
            else:
                logger.info(f"[FACT-CHECK] Message {msg_num}/{total}: no factual claims found")
        except asyncio.TimeoutError:
            logger.error(f"[FACT-CHECK] Message {msg_num}/{total} timed out after 60s")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Message {msg_num} timed out', 'message_num': msg_num})}\n\n"
        except json.JSONDecodeError as e:
            logger.error(f"[FACT-CHECK] Message {msg_num}/{total} JSON parse failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to parse message {msg_num}', 'message_num': msg_num})}\n\n"
        except Exception as e:
            logger.error(f"[FACT-CHECK] Message {msg_num}/{total} failed: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': f'Message {msg_num} failed: {str(e)}', 'message_num': msg_num})}\n\n"

    logger.info(f"[FACT-CHECK] Complete: {len(all_checks)} total claims from {total} messages")
    yield f"data: {json.dumps({'type': 'complete', 'fact_checks': all_checks})}\n\n"

    if token_tracker and token_tracker.calls:
        token_tracker.log_summary()
        yield f"data: {json.dumps({'type': 'token_usage', 'content': token_tracker.to_dict()})}\n\n"
