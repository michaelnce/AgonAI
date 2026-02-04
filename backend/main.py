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

async def event_generator(
    topic: str,
    proponent_profile: str,
    proponent_tone: str,
    proponent_language: str,
    opponent_profile: str,
    opponent_tone: str,
    opponent_language: str,
    limit: Optional[int] = None
):
    # Initial connection message
    yield f"data: {json.dumps({'type': 'system', 'content': 'connected'})}\n\n"
    
    inputs = {
        "messages": [], 
        "current_speaker": "moderator", 
        "turn_count": 0,
        "topic": topic,
        "proponent_profile": proponent_profile,
        "proponent_tone": proponent_tone,
        "proponent_language": proponent_language,
        "opponent_profile": opponent_profile,
        "opponent_tone": opponent_tone,
        "opponent_language": opponent_language
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
                
                # Check for verdict
                if "verdict" in node_output:
                    try:
                        verdict_data = node_output["verdict"]
                        verdict_data = verdict_data.replace("```json", "").replace("```", "").strip()
                        yield f"data: {json.dumps({'type': 'verdict', 'content': verdict_data})}\n\n"
                    except Exception as e:
                         print(f"Error parsing verdict: {e}")

            count += 1
            if limit is not None and count >= limit:
                break
                
        yield f"data: {json.dumps({'type': 'system', 'content': 'finished'})}\n\n"
        
    except Exception as e:
        print(f"Error in event_generator: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

@app.get("/api/debate/stream")
async def stream_debate(
    topic: str = "AI Safety",
    proponent_profile: str = "Analytical Scholar",
    proponent_tone: str = "Assertive",
    proponent_language: str = "English",
    opponent_profile: str = "Creative Disruptor",
    opponent_tone: str = "Socratic",
    opponent_language: str = "English",
    limit: Optional[int] = None
):
    return StreamingResponse(
        event_generator(
            topic, 
            proponent_profile, 
            proponent_tone, 
            proponent_language, 
            opponent_profile, 
            opponent_tone, 
            opponent_language, 
            limit
        ), 
        media_type="text/event-stream"
    )
