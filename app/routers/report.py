from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import asyncio
import os
import httpx

router = APIRouter(prefix="/api/report", tags=["report"])


class ReportRequest(BaseModel):
    leaks: list[dict]
    metrics: dict | None = None


@router.post("")
async def generate_report(req: ReportRequest):
    """Generate a natural-language leak report using Gemini."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing GEMINI_API_KEY")

    # Build a concise summary of pipeline results for the prompt
    leak_lines = []
    for i, leak in enumerate(req.leaks, 1):
        wo = leak.get("work_order", {})
        leak_lines.append(
            f"  {i}. Node/Pipe: {wo.get('dispatch_target', leak.get('detected_node', 'Unknown'))}, "
            f"Detected: {leak.get('estimated_start_time', 'N/A')}, "
            f"CUSUM Severity: {leak.get('estimated_cusum_severity', 0):.1f}, "
            f"Water Loss: {wo.get('gallons_lost_per_hour', 'N/A')} gal/hr, "
            f"Cost: ${wo.get('cost_per_hour', 'N/A')}/hr, "
            f"Confidence: {wo.get('confidence_score', 'N/A')}%"
        )

    metrics_text = ""
    if req.metrics:
        metrics_text = (
            f"\nPipeline Metrics:\n"
            f"  - Leaks detected: {req.metrics.get('leaks_detected', 'N/A')}\n"
            f"  - Ground truth leaks: {req.metrics.get('ground_truth_leaks', 'N/A')}\n"
            f"  - Mean localization error: {req.metrics.get('mean_localization_error', 'N/A')}m\n"
            f"  - Baseline error: {req.metrics.get('baseline_error', 'N/A')}m\n"
            f"  - Improvement: {req.metrics.get('improvement_pct', 'N/A')}%\n"
        )

    prompt = f"""You are AquaGuard, an AI-powered water leak detection system for city water networks.
Write a professional, concise incident report summarizing the following leak detection results from the L-TOWN water network.
Include actionable recommendations for city water authorities. Use clear headings and keep it under 300 words.

Detected Leaks:
{chr(10).join(leak_lines)}
{metrics_text}
Write the report now:"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
        },
    }

    # Retry up to 3 times on rate-limit (429)
    last_error = None
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload)

        if response.status_code == 200:
            break
        elif response.status_code == 429:
            last_error = "Rate limited by Gemini API. Retrying..."
            await asyncio.sleep(2 * (attempt + 1))  # 2s, 4s, 6s backoff
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Gemini API error: {response.text[:200]}"
            )
    else:
        raise HTTPException(status_code=429, detail="Gemini rate limit exceeded. Please wait a moment and try again.")

    data = response.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=500, detail="Unexpected Gemini response format")

    return JSONResponse({"report": text})
