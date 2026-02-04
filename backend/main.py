from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import Optional

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "ok"}

async def event_generator(limit: Optional[int] = None):
    # Initial connection message
    yield f"data: {json.dumps({'type': 'system', 'content': 'connected'})}\n\n"
    
    count = 0
    # Keep the connection open
    while True:
        if limit is not None and count >= limit:
            break
        await asyncio.sleep(1)
        # yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        count += 1

@app.get("/api/debate/stream")
async def stream_debate(limit: Optional[int] = None):
    return StreamingResponse(event_generator(limit), media_type="text/event-stream")
