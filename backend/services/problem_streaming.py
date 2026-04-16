import asyncio
import json
import logging
import random
from typing import Dict, Optional

from backend.problem_graph import (
    create_problem_graph, AGENT_ROLES, ROLE_DESCRIPTIONS,
    assign_five_names, LLM_PROVIDER,
)
from backend.graph import get_profile_data, get_tone_data, build_identity_prompt
from backend.services.fact_check import fact_check_message

logger = logging.getLogger("debate.api")

# Compile graph once
logger.info("Compiling problem-solving workflow graph...")
problem_workflow = create_problem_graph().compile()
logger.info("Problem-solving workflow graph compiled successfully")


async def problem_event_generator(
    session_id: str,
    problem: str,
    agent_configs: Dict[str, Dict],
    facilitator_language: str = "English",
    fact_check: bool = True,
):
    logger.info(f"[PROBLEM:{session_id[:8]}] Event generator started — problem: '{problem[:80]}'")

    yield f"data: {json.dumps({'type': 'system', 'content': 'connected', 'session_id': session_id})}\n\n"

    # Assign names to agents
    names = assign_five_names()
    agent_names_map = {}
    for i, role in enumerate(AGENT_ROLES):
        agent_configs[role]["name"] = names[i]
        agent_names_map[role] = names[i]

    # Send agent names to frontend
    yield f"data: {json.dumps({'type': 'agent_names', 'agents': agent_names_map})}\n\n"

    inputs = {
        "messages": [],
        "phase": "frame",
        "phase_round": 0,
        "problem": problem,
        "agent_configs": agent_configs,
        "current_agent": "",
        "agent_index": 0,
        "facilitator_language": facilitator_language,
        "facilitator_directions": "",
        "solution": "",
    }

    # Token tracking
    token_tracker = None
    if LLM_PROVIDER == "claude":
        from backend.claude_llm import TokenTracker
        token_tracker = TokenTracker()

    # Streaming queue
    stream_queue = asyncio.Queue()
    current_streaming_speaker = {"name": None}

    async def on_stream_chunk(chunk: str):
        speaker = current_streaming_speaker["name"]
        if speaker:
            await stream_queue.put(("chunk", speaker, chunk))

    config = {
        "recursion_limit": 100,
        "configurable": {
            "token_tracker": token_tracker,
            "stream_callback": on_stream_chunk if LLM_PROVIDER == "claude" else None,
        },
    }

    try:
        graph_done = asyncio.Event()
        graph_outputs = []
        graph_error = [None]
        last_phase = [None]

        async def run_graph():
            try:
                async for output in problem_workflow.astream(inputs, config=config):
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
                    # Emit phase change events
                    phase = node_output.get("phase", "")
                    phase_round = node_output.get("phase_round", 1)
                    if phase and phase != last_phase[0] and phase != "done":
                        last_phase[0] = phase
                        yield f"data: {json.dumps({'type': 'phase', 'phase': phase, 'round': phase_round, 'label': f'Phase: {phase.title()}'})}\n\n"

                    # Set streaming speaker for next node
                    current_agent = node_output.get("current_agent", "")
                    if current_agent and current_agent in agent_names_map:
                        current_streaming_speaker["name"] = current_agent
                    elif node_name in ("frame", "checkpoint", "synthesis"):
                        current_streaming_speaker["name"] = "facilitator"

                    # Emit messages
                    messages = node_output.get("messages", [])
                    for msg in messages:
                        # Determine speaker from message prefix
                        speaker = "facilitator"
                        for role in AGENT_ROLES:
                            if msg.startswith(f"{role.title()}:"):
                                speaker = role
                                break

                        yield f"data: {json.dumps({'type': 'stream_end', 'speaker': speaker, 'content': msg, 'phase': phase, 'round': phase_round})}\n\n"

                    # Check for solution
                    if node_output.get("solution"):
                        solution_raw = node_output["solution"]
                        solution_raw = solution_raw.replace("```json", "").replace("```", "").strip()
                        logger.info(f"[PROBLEM:{session_id[:8]}] Solution received: {solution_raw[:100]}...")
                        yield f"data: {json.dumps({'type': 'solution', 'content': solution_raw})}\n\n"

            elif event_type == "finished":
                break

        if graph_error[0]:
            raise graph_error[0]

        await graph_task

        logger.info(f"[PROBLEM:{session_id[:8]}] Session finished")

        # Fact-check pass
        if LLM_PROVIDER == "claude" and fact_check:
            try:
                logger.info(f"[PROBLEM:{session_id[:8]}] Starting fact-check pass...")
                yield f"data: {json.dumps({'type': 'system', 'content': 'fact_checking'})}\n\n"

                # Collect agent messages (skip facilitator)
                agent_messages = []
                for output in graph_outputs:
                    for _, node_out in output.items():
                        for m in node_out.get("messages", []):
                            for role in AGENT_ROLES:
                                if m.startswith(f"{role.title()}:"):
                                    content = m[len(role) + 1:].strip()
                                    speaker_name = agent_names_map.get(role, role.title())
                                    agent_messages.append({"speaker": speaker_name, "content": content})
                                    break

                all_checks = []
                total = len(agent_messages)
                logger.info(f"[PROBLEM:{session_id[:8]}] Will fact-check {total} agent messages")

                for idx, msg in enumerate(agent_messages):
                    msg_num = idx + 1
                    yield f": keepalive\n\n"
                    try:
                        checks = await fact_check_message(msg["speaker"], msg["content"], msg_num, token_tracker)
                        if checks:
                            all_checks.extend(checks)
                            logger.info(f"[PROBLEM:{session_id[:8]}] Message {msg_num}/{total}: {len(checks)} claims")
                    except Exception as e:
                        logger.error(f"[PROBLEM:{session_id[:8]}] Fact-check {msg_num}/{total} failed: {e}")

                yield f"data: {json.dumps({'type': 'fact_check', 'content': json.dumps(all_checks)})}\n\n"

            except Exception as e:
                logger.error(f"[PROBLEM:{session_id[:8]}] Fact-check failed: {e}", exc_info=True)
                yield f"data: {json.dumps({'type': 'fact_check_error', 'content': str(e)})}\n\n"

        # Token usage
        if token_tracker and token_tracker.calls:
            token_tracker.log_summary()
            yield f"data: {json.dumps({'type': 'token_usage', 'content': token_tracker.to_dict()})}\n\n"

        yield f"data: {json.dumps({'type': 'system', 'content': 'finished'})}\n\n"

    except Exception as e:
        logger.error(f"[PROBLEM:{session_id[:8]}] Error: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
