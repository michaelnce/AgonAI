"""LangChain-compatible chat model that calls the Claude Code CLI.

Uses your Claude Max/Pro subscription — no API key needed.
Requires the `claude` CLI to be installed and authenticated.
"""

import asyncio
import json
import logging
import subprocess
from typing import Any, Callable, Dict, List, Optional

from langchain_core.callbacks import CallbackManagerForLLMRun, AsyncCallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatResult, ChatGeneration

logger = logging.getLogger("debate.claude_llm")


class TokenTracker:
    """Tracks cumulative token usage across multiple Claude CLI calls."""

    def __init__(self):
        self.calls: List[Dict[str, Any]] = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cache_read_tokens = 0
        self.total_cache_creation_tokens = 0
        self.total_cost_usd = 0.0
        self.total_duration_ms = 0

    def record(self, label: str, data: dict):
        usage = data.get("usage", {})
        input_t = usage.get("input_tokens", 0)
        output_t = usage.get("output_tokens", 0)
        cache_read = usage.get("cache_read_input_tokens", 0)
        cache_create = usage.get("cache_creation_input_tokens", 0)
        cost = data.get("total_cost_usd", 0.0)
        duration = data.get("duration_ms", 0)

        self.total_input_tokens += input_t
        self.total_output_tokens += output_t
        self.total_cache_read_tokens += cache_read
        self.total_cache_creation_tokens += cache_create
        self.total_cost_usd += cost
        self.total_duration_ms += duration

        self.calls.append({
            "label": label,
            "input_tokens": input_t,
            "output_tokens": output_t,
            "cache_read": cache_read,
            "cache_creation": cache_create,
            "cost_usd": cost,
            "duration_ms": duration,
        })

        logger.info(
            f"[TOKENS] {label}: "
            f"in={input_t} out={output_t} "
            f"cache_read={cache_read} cache_create={cache_create} "
            f"cost=${cost:.4f} duration={duration}ms"
        )

    def log_summary(self):
        logger.info(
            f"[TOKENS] === DEBATE TOTAL ({len(self.calls)} calls) === "
            f"in={self.total_input_tokens} out={self.total_output_tokens} "
            f"cache_read={self.total_cache_read_tokens} cache_create={self.total_cache_creation_tokens} "
            f"total_cost=${self.total_cost_usd:.4f} total_duration={self.total_duration_ms}ms"
        )
        for i, call in enumerate(self.calls, 1):
            logger.info(
                f"[TOKENS]   {i}. {call['label']}: "
                f"in={call['input_tokens']} out={call['output_tokens']} "
                f"cost=${call['cost_usd']:.4f} duration={call['duration_ms']}ms"
            )

    def to_dict(self) -> dict:
        return {
            "calls": self.calls,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cache_read_tokens": self.total_cache_read_tokens,
            "total_cache_creation_tokens": self.total_cache_creation_tokens,
            "total_cost_usd": self.total_cost_usd,
            "total_duration_ms": self.total_duration_ms,
        }


class ChatClaudeCode(BaseChatModel):
    """Chat model that shells out to the `claude` CLI."""

    model_name: str = "claude"
    max_tokens: int = 4096
    call_label: str = ""
    token_tracker: Optional[TokenTracker] = None
    stream_callback: Optional[Callable] = None  # async fn(chunk: str) called for each token delta

    class Config:
        arbitrary_types_allowed = True

    @property
    def _llm_type(self) -> str:
        return "claude-code-cli"

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        prompt = self._messages_to_prompt(messages)
        text, data = self._call_cli(prompt)
        if self.token_tracker and data:
            self.token_tracker.record(self.call_label or "unknown", data)
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=text))])

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        prompt = self._messages_to_prompt(messages)
        if self.stream_callback:
            text, data = await self._acall_cli_streaming(prompt)
        else:
            text, data = await self._acall_cli(prompt)
        if self.token_tracker and data:
            self.token_tracker.record(self.call_label or "unknown", data)
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=text))])

    @staticmethod
    def _messages_to_prompt(messages: List[BaseMessage]) -> str:
        """Convert LangChain messages to a single prompt string."""
        if len(messages) == 1:
            return messages[0].content
        parts = []
        for msg in messages:
            role = getattr(msg, "role", msg.type)
            parts.append(f"{role}: {msg.content}")
        return "\n\n".join(parts)

    def _call_cli(self, prompt: str) -> tuple:
        """Synchronous subprocess call to claude CLI. Returns (text, raw_data)."""
        logger.info(f"[CLAUDE-CLI] Calling claude (sync), prompt length: {len(prompt)} chars")
        try:
            result = subprocess.run(
                [
                    "claude",
                    "-p", "-",
                    "--output-format", "json",
                    "--max-turns", "1",
                ],
                input=prompt,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                logger.error(f"[CLAUDE-CLI] CLI error (rc={result.returncode}): {result.stderr[:500]}")
                raise RuntimeError(f"claude CLI failed: {result.stderr[:500]}")
            return self._parse_response(result.stdout)
        except subprocess.TimeoutExpired:
            raise RuntimeError("claude CLI timed out after 120s")

    async def _acall_cli(self, prompt: str) -> tuple:
        """Async subprocess call to claude CLI (non-streaming). Returns (text, raw_data).
        Uses stdin pipe for the prompt to avoid shell argument size limits."""
        logger.info(f"[CLAUDE-CLI] Calling claude (async), prompt length: {len(prompt)} chars")
        try:
            proc = await asyncio.create_subprocess_exec(
                "claude",
                "-p", "-",
                "--output-format", "json",
                "--max-turns", "1",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=prompt.encode()),
                timeout=120
            )
            stdout_str = stdout.decode()
            stderr_str = stderr.decode()
            if proc.returncode != 0:
                error_detail = stderr_str.strip() or stdout_str.strip()
                logger.error(f"[CLAUDE-CLI] CLI error (rc={proc.returncode}): stderr={stderr_str[:300]!r} stdout={stdout_str[:300]!r}")
                raise RuntimeError(f"claude CLI failed (rc={proc.returncode}): {error_detail[:500]}")
            return self._parse_response(stdout_str)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError("claude CLI timed out after 120s")

    async def _acall_cli_streaming(self, prompt: str) -> tuple:
        """Async streaming subprocess call. Yields token deltas via stream_callback.
        Returns (full_text, result_data)."""
        logger.info(f"[CLAUDE-CLI] Calling claude (streaming), prompt length: {len(prompt)} chars")
        try:
            proc = await asyncio.create_subprocess_exec(
                "claude",
                "-p", "-",
                "--output-format", "stream-json",
                "--max-turns", "1",
                "--verbose",
                "--include-partial-messages",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            # Write prompt to stdin and close it
            proc.stdin.write(prompt.encode())
            await proc.stdin.drain()
            proc.stdin.close()

            full_text = ""
            result_data = None

            async def read_stream():
                nonlocal full_text, result_data
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    line_str = line.decode().strip()
                    if not line_str:
                        continue
                    try:
                        event = json.loads(line_str)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type")

                    # Stream text deltas
                    if event_type == "stream_event":
                        inner = event.get("event", {})
                        if inner.get("type") == "content_block_delta":
                            delta = inner.get("delta", {})
                            if delta.get("type") == "text_delta":
                                chunk = delta.get("text", "")
                                if chunk and self.stream_callback:
                                    full_text += chunk
                                    await self.stream_callback(chunk)

                    # Final result with usage data
                    elif event_type == "result":
                        result_data = event
                        if not full_text and event.get("result"):
                            full_text = event["result"]

            await asyncio.wait_for(read_stream(), timeout=120)
            await proc.wait()

            if proc.returncode != 0:
                stderr = await proc.stderr.read()
                stderr_str = stderr.decode() if stderr else ""
                logger.error(f"[CLAUDE-CLI] CLI error (rc={proc.returncode}): {stderr_str[:500]}")
                raise RuntimeError(f"claude CLI failed: {stderr_str[:500]}")

            return full_text, result_data

        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError("claude CLI timed out after 120s")

    @staticmethod
    def _parse_response(raw: str) -> tuple:
        """Parse the JSON output from `claude -p --output-format json`.
        Returns (text, raw_data_dict)."""
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and "result" in data:
                return data["result"], data
            return str(data), data
        except json.JSONDecodeError:
            return raw.strip(), None
