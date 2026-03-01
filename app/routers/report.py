"""AI-powered leak report generation via Gemini API."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import httpx
import traceback

router = APIRouter(prefix="/api/report", tags=["report"])


class ReportRequest(BaseModel):
    leaks: list[dict]
    metrics: dict | None = None


@router.post("")
async def generate_report(req: ReportRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Missing GEMINI_API_KEY")

        # Build prompt
        leak_lines = []
        for i, leak in enumerate(req.leaks, 1):
            wo = leak.get("work_order", {})
            leak_lines.append(
                f"  {i}. Node/Pipe: {wo.get('dispatch_target', leak.get('detected_node', 'Unknown'))}, "
                f"Detected: {leak.get('estimated_start_time', 'N/A')}, "
                f"Severity: {leak.get('estimated_cusum_severity', 0):.1f}, "
                f"Loss: {wo.get('gallons_lost_per_hour', 'N/A')} gal/hr, "
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
                f"  - Improvement: {req.metrics.get('improvement_pct', 'N/A')}%\n"
            )

        prompt = f"""You are AquaGuard, an AI water leak detection system.
Write a professional incident report summarizing these leak detection results from the L-TOWN water network.
Include actionable recommendations. Use clear headings. Keep it under 300 words.

Detected Leaks:
{chr(10).join(leak_lines)}
{metrics_text}
Write the report now:"""

        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
        headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        print(f"[Report] Sending request to Gemini ({len(leak_lines)} leaks)...")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers=headers)

        print(f"[Report] Gemini response status: {response.status_code}")

        if response.status_code != 200:
            detail = response.text[:200]
            print(f"[Report] Gemini error: {detail}")
            raise HTTPException(status_code=response.status_code, detail=f"Gemini API error: {detail}")

        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        print(f"[Report] Success! Report length: {len(text)} chars")
        return JSONResponse({"report": text})

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Report] Unexpected error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
