from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
import os
import httpx

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])

class DispatchRequest(BaseModel):
    node_id: str

@router.post("")
async def generate_dispatch_audio(req: DispatchRequest):
    """Generate a voice alert for a specific node using ElevenLabs."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing ELEVENLABS_API_KEY")

    message = f"Dispatching repair team to node {req.node_id}."
    
    # Use a generic voice (e.g. Rachel or arbitrary ElevenLabs standard voice)
    voice_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    
    payload = {
        "text": message,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
        
    return Response(content=response.content, media_type="audio/mpeg")
