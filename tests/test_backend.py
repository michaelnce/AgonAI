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
    async def mock_astream(inputs):
        yield {"moderator": {"messages": ["Moderator: Intro"], "turn_count": 1}}
        yield {"proponent": {"messages": ["Proponent: Yes"], "turn_count": 2}}
    
    mock_workflow.astream = mock_astream
    
    with patch("backend.main.debate_workflow", mock_workflow):
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
                
                assert events[1]["type"] == "debate_update"
                assert events[1]["speaker"] == "moderator"
                assert "Intro" in events[1]["content"]
                
                assert events[2]["type"] == "debate_update"
                assert events[2]["speaker"] == "proponent"
                assert "Yes" in events[2]["content"]