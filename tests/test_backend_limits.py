import re
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from backend.graph import moderator_node, proponent_node, opponent_node, DebateState, WORD_LIMIT, WORD_LIMIT_MIN

@pytest.mark.asyncio
async def test_word_limit_in_prompt():
    # Mock LLM response
    mock_response = MagicMock()
    mock_response.content = "Short response."

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("backend.graph.get_model", return_value=mock_llm):
        state = DebateState(
            messages=[],
            current_speaker="moderator",
            turn_count=0,
            topic="Test Topic",
            proponent_profile="Rationalism",
            proponent_tone="Assertive",
            proponent_language="English",
            opponent_profile="Empiricism",
            opponent_tone="Skeptical",
            opponent_language="English",
            verdict=None,
            proponent_name="Alex",
            opponent_name="Sam"
        )

        mock_config = {"configurable": {"input_queue": MagicMock(), "token_tracker": None}}
        await moderator_node(state, mock_config)

        # Check if the prompt contains a word limit in the valid range
        args, _ = mock_llm.ainvoke.call_args
        prompt = args[0]
        assert "words" in prompt
        # Extract numbers from the prompt and verify at least one is in the valid range
        numbers = [int(n) for n in re.findall(r'\b(\d+)\b', prompt)]
        assert any(WORD_LIMIT_MIN <= n <= WORD_LIMIT for n in numbers), \
            f"No word limit in range [{WORD_LIMIT_MIN}, {WORD_LIMIT}] found in prompt numbers: {numbers}"
