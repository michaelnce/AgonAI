import pytest
import asyncio
import json
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

from unittest.mock import MagicMock, patch, AsyncMock
import os

@pytest.mark.asyncio
async def test_sse_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Wrap the stream operation with a timeout
        try:
            # Use limit=0 to ensure the generator finishes immediately after connection
            async with ac.stream("GET", "/api/debate/stream?limit=0") as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers["content-type"]
                
                # Define a function to read the stream
                async def read_stream():
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            assert "connected" in line
                            return
                
                # Wait for the read_stream to complete with a timeout
                await asyncio.wait_for(read_stream(), timeout=2.0)
                
        except asyncio.TimeoutError:
            pytest.fail("SSE stream timed out")

@pytest.mark.asyncio
async def test_debate_integration():
    # Mock the debate_workflow.astream method
    mock_workflow = MagicMock()
    
    # Define a generator for astream
    async def mock_astream(inputs, config=None):
        yield {"moderator": {"messages": ["Moderator: Intro"], "turn_count": 1}}
        yield {"proponent": {"messages": ["Proponent: Yes"], "turn_count": 2}}
    
    mock_workflow.astream = mock_astream
    
    with patch("backend.services.streaming.debate_workflow", mock_workflow):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            async with ac.stream("GET", "/api/debate/stream?limit=2") as response:
                assert response.status_code == 200
                
                events = []
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        data = json.loads(line[6:])
                        events.append(data)
                
                # Verify we got the system connected message and the updates
                assert len(events) >= 3 # connected + 2 updates + finished (maybe)
                assert events[0]["type"] == "system"
                assert events[0]["content"] == "connected"
                
                # Find the first stream_end or debate_update events (skip agent_names etc)
                message_events = [e for e in events if e["type"] in ("debate_update", "stream_end")]
                assert len(message_events) >= 2
                assert message_events[0]["speaker"] == "moderator"
                assert "Intro" in message_events[0]["content"]

                assert message_events[1]["speaker"] == "proponent"
                assert "Yes" in message_events[1]["content"]

@pytest.mark.asyncio
async def test_resolve_best_match():
    mock_response = MagicMock()
    mock_response.content = '{"proponent_profile": "Rationalism", "opponent_profile": "Empiricism", "proponent_tone": "Formal", "opponent_tone": "Sarcastic"}'

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("backend.main.get_model", return_value=mock_llm):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/api/debate/resolve-best-match", json={
                "topic": "Is democracy the best form of government?",
                "resolve_proponent_profile": True,
                "resolve_proponent_tone": True,
                "resolve_opponent_profile": True,
                "resolve_opponent_tone": True,
            })
            assert response.status_code == 200
            data = response.json()
            assert data["proponent_profile"] == "Rationalism"
            assert data["opponent_profile"] == "Empiricism"
            assert data["proponent_tone"] == "Formal"
            assert data["opponent_tone"] == "Sarcastic"

@pytest.mark.asyncio
async def test_resolve_best_match_fallback_on_invalid():
    """When LLM returns invalid values, endpoint falls back to random."""
    mock_response = MagicMock()
    mock_response.content = '{"proponent_profile": "NonExistent", "proponent_tone": "FakeTone"}'

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("backend.main.get_model", return_value=mock_llm):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/api/debate/resolve-best-match", json={
                "topic": "Test topic",
                "resolve_proponent_profile": True,
                "resolve_proponent_tone": True,
            })
            assert response.status_code == 200
            data = response.json()
            # Should have fallen back to random valid values
            from backend.graph import PROFILES, TONES
            profile_names = [p["Movement"] for p in PROFILES]
            tone_names = [t["tone"] for t in TONES]
            assert data["proponent_profile"] in profile_names
            assert data["proponent_tone"] in tone_names