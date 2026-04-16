import asyncio
import json
import logging
import random
from typing import Dict, Optional

from backend.graph import (
    create_debate_graph, get_model, MODEL_FACT_CHECK,
    LLM_PROVIDER, MAX_TURNS, MAX_TURNS_MIN,
)
from backend.services.fact_check import fact_check_message, parse_fact_check_json

logger = logging.getLogger("debate.api")

ACTIVE_DEBATES: Dict[str, asyncio.Queue] = {}

# Compile graph once at import time
logger.info("Compiling debate workflow graph...")
debate_workflow = create_debate_graph().compile()
logger.info("Debate workflow graph compiled successfully")


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
    limit: Optional[int] = None,
    fact_check: bool = True,
):
    logger.info(f"[STREAM:{debate_id[:8]}] Event generator started — topic: '{topic}' (fact_check={fact_check})")
    logger.info(f"[STREAM:{debate_id[:8]}] Proponent: {proponent_profile} / {proponent_tone} / {proponent_language}")
    logger.info(f"[STREAM:{debate_id[:8]}] Opponent:  {opponent_profile} / {opponent_tone} / {opponent_language}")

    queue = asyncio.Queue()
    ACTIVE_DEBATES[debate_id] = queue

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

    token_tracker = None
    if LLM_PROVIDER == "claude":
        from backend.claude_llm import TokenTracker
        token_tracker = TokenTracker()

    stream_queue = asyncio.Queue()
    current_streaming_speaker = {"name": None}

    async def on_stream_chunk(chunk: str):
        speaker = current_streaming_speaker["name"]
        if speaker:
            await stream_queue.put(("chunk", speaker, chunk))

    config = {"configurable": {
        "input_queue": queue,
        "token_tracker": token_tracker,
        "stream_callback": on_stream_chunk if LLM_PROVIDER == "claude" else None,
    }}

    try:
        count = 0
        agent_names = {}
        current_streaming_speaker["name"] = "moderator"

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
            try:
                event_type, payload, chunk = await asyncio.wait_for(stream_queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                if graph_done.is_set():
                    break
                continue

            if event_type == "chunk":
                speaker = payload
                yield f"data: {json.dumps({'type': 'stream_chunk', 'speaker': speaker, 'chunk': chunk})}\n\n"

            elif event_type == "node_done":
                output = payload
                for node_name, node_output in output.items():
                    turn = node_output.get('turn_count', '?')

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
                        yield f"data: {json.dumps({'type': 'stream_end', 'speaker': node_name, 'content': last_message, 'turn': turn})}\n\n"
                        next_speaker = node_output.get("current_speaker", "")
                        current_streaming_speaker["name"] = next_speaker

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

        # Fact-check pass
        if LLM_PROVIDER == "claude" and fact_check:
            try:
                logger.info(f"[STREAM:{debate_id[:8]}] Starting fact-check pass (per-message)...")
                yield f"data: {json.dumps({'type': 'system', 'content': 'fact_checking'})}\n\n"

                debater_messages = []
                for output in graph_outputs:
                    for _, node_out in output.items():
                        for m in node_out.get("messages", []):
                            if m.startswith("Proponent:") or m.startswith("Opponent:"):
                                speaker = "Proponent" if m.startswith("Proponent:") else "Opponent"
                                content = m[len(speaker) + 1:].strip()
                                debater_messages.append({"speaker": speaker, "content": content})

                all_checks = []
                total = len(debater_messages)
                logger.info(f"[STREAM:{debate_id[:8]}] Will fact-check {total} debater messages individually")

                for idx, msg in enumerate(debater_messages):
                    msg_num = idx + 1
                    speaker = msg["speaker"]
                    content = msg["content"]
                    logger.info(f"[STREAM:{debate_id[:8]}] Fact-checking message {msg_num}/{total} ({speaker})")
                    yield f": keepalive\n\n"

                    try:
                        checks = await fact_check_message(speaker, content, msg_num, token_tracker)
                        if checks:
                            all_checks.extend(checks)
                            logger.info(f"[STREAM:{debate_id[:8]}] Message {msg_num}/{total}: {len(checks)} claims found")
                        else:
                            logger.info(f"[STREAM:{debate_id[:8]}] Message {msg_num}/{total}: no factual claims")
                    except asyncio.TimeoutError:
                        logger.error(f"[STREAM:{debate_id[:8]}] Fact-check message {msg_num}/{total} timed out")
                    except Exception as e:
                        logger.error(f"[STREAM:{debate_id[:8]}] Fact-check message {msg_num}/{total} failed: {e}")

                if all_checks:
                    logger.info(f"[STREAM:{debate_id[:8]}] Fact-check complete: {len(all_checks)} total claims")
                    yield f"data: {json.dumps({'type': 'fact_check', 'content': json.dumps(all_checks)})}\n\n"
                else:
                    logger.info(f"[STREAM:{debate_id[:8]}] Fact-check complete: no claims found")
                    yield f"data: {json.dumps({'type': 'fact_check', 'content': '[]'})}\n\n"

            except Exception as e:
                logger.error(f"[STREAM:{debate_id[:8]}] Fact-check failed: {e}", exc_info=True)
                yield f"data: {json.dumps({'type': 'fact_check_error', 'content': str(e)})}\n\n"

        # Token usage summary
        if token_tracker and token_tracker.calls:
            token_tracker.log_summary()
            yield f"data: {json.dumps({'type': 'token_usage', 'content': token_tracker.to_dict()})}\n\n"

        yield f"data: {json.dumps({'type': 'system', 'content': 'finished'})}\n\n"

    except Exception as e:
        logger.error(f"[STREAM:{debate_id[:8]}] Error in event_generator: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    finally:
        if debate_id in ACTIVE_DEBATES:
            del ACTIVE_DEBATES[debate_id]
        logger.info(f"[STREAM:{debate_id[:8]}] Cleaned up, debate session ended")
