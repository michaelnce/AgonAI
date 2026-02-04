from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import Optional
from backend.graph import create_debate_graph

app = FastAPI()

# Compile the graph once at startup (or per request if we need dynamic config)
debate_workflow = create_debate_graph().compile()

@app.get("/health")
async def health_check():
    return {"status": "ok"}

async def event_generator(topic: Optional[str] = "AI Safety", limit: Optional[int] = None):
    # Initial connection message
    yield f"data: {json.dumps({'type': 'system', 'content': 'connected'})}\n\n"
    
    inputs = {
        "messages": [], 
        "current_speaker": "moderator", 
        "turn_count": 0,
        "topic": topic
    }
    
    try:
        count = 0
        async for output in debate_workflow.astream(inputs):
            for node_name, node_output in output.items():
                messages = node_output.get("messages", [])
                if messages:
                    last_message = messages[-1]
                    data = json.dumps({
                        'type': 'debate_update', 
                        'speaker': node_name, 
                        'content': last_message,
                        'turn': node_output.get('turn_count')
                    })
                    yield f"data: {data}\n\n"
            
            count += 1
            if limit is not None and count >= limit:
                break
                
        yield f"data: {json.dumps({'type': 'system', 'content': 'finished'})}\n\n"
        
    except Exception as e:
        print(f"Error in event_generator: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

@app.get("/api/debate/stream")
async def stream_debate(topic: Optional[str] = "AI Safety", limit: Optional[int] = None):
    return StreamingResponse(event_generator(topic, limit), media_type="text/event-stream")
