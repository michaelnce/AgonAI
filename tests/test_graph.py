import pytest
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Annotated
import operator

# Define the State
class DebateState(TypedDict):
    messages: Annotated[List[str], operator.add]
    current_speaker: str
    turn_count: int

def test_debate_state_structure():
    # Verify the state structure matches our requirements
    state = DebateState(messages=[], current_speaker="moderator", turn_count=0)
    assert "messages" in state
    assert "current_speaker" in state
    assert "turn_count" in state
    assert isinstance(state["messages"], list)

from unittest.mock import MagicMock, patch, AsyncMock

@pytest.mark.asyncio
async def test_node_execution():
    from backend.graph import proponent_node, moderator_node, DebateState
    
    # Mock LLM response
    mock_response = MagicMock()
    mock_response.content = "Mocked response"
    
    mock_llm = MagicMock()
    # Use AsyncMock for ainvoke
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    
    # Patch get_model to return our mock
    with patch("backend.graph.get_model", return_value=mock_llm):
        # Mock state
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
        
        # Test moderator node
        mock_config = {"configurable": {"input_queue": MagicMock(), "token_tracker": None}}
        result = await moderator_node(state, mock_config)
        assert "messages" in result
        assert "Moderator: Mocked response" in result["messages"][0]
        assert result["current_speaker"] == "proponent"

        # Test proponent_node
        result = await proponent_node(state, mock_config)
        assert "Proponent: Mocked response" in result["messages"][0]
        assert result["current_speaker"] == "opponent"

@pytest.mark.asyncio
async def test_verdict_node():
    from backend.graph import verdict_node, DebateState
    
    mock_json = '{"winner": "Proponent", "scores": {}, "reasoning": "test"}'
    mock_response = MagicMock()
    mock_response.content = mock_json
    
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    
    with patch("backend.graph.get_model", return_value=mock_llm):
        state = DebateState(
            messages=["Msg 1"], 
            current_speaker="moderator", 
            turn_count=10,
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
        
        mock_config = {"configurable": {"token_tracker": None}}
        result = await verdict_node(state, mock_config)
        assert "verdict" in result
        assert result["verdict"] == mock_json

@pytest.mark.asyncio
async def test_full_workflow():
    from backend.graph import create_debate_graph, DebateState
    
    # Mock LLM response
    mock_response = MagicMock()
    mock_response.content = "Mocked response"
    
    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    
    with patch("backend.graph.get_model", return_value=mock_llm):
        workflow = create_debate_graph()
        app = workflow.compile()
        
        # Initial state
        initial_state = DebateState(
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
            moderator_language="English",
            verdict=None,
            proponent_name="Alex",
            opponent_name="Sam"
        )

        # Run the graph (higher recursion limit to account for moderator interventions)
        result = await app.ainvoke(initial_state, config={"recursion_limit": 50})
        
        # Verify the result has messages and terminated
        assert len(result["messages"]) > 0
        assert result["turn_count"] > 0

