import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

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