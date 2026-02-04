import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from backend.graph import moderator_node, proponent_node, opponent_node, DebateState, WORD_LIMIT

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
            opponent_profile="Empiricism",
            opponent_tone="Skeptical",
            verdict=None
        )
        
        await moderator_node(state)
        
        # Check if the prompt sent to LLM contains the word limit instruction
        args, _ = mock_llm.ainvoke.call_args
        prompt = args[0]
        assert str(WORD_LIMIT) in prompt
        assert "words" in prompt
