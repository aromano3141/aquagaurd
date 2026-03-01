"""Pipeline API endpoints."""

import asyncio
from fastapi import APIRouter
from ..services import pipeline_service
from ..schemas import LeakResult, PipelineMetrics

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("/run", response_model=list[LeakResult])
async def run_pipeline():
    """Run the full detection pipeline and return detected leaks."""
    # Run in thread pool so the heavy computation doesn't block the event loop
    return await asyncio.to_thread(pipeline_service.run_pipeline)


@router.get("/metrics", response_model=PipelineMetrics)
async def get_metrics():
    """Get pipeline accuracy metrics."""
    return await asyncio.to_thread(pipeline_service.get_metrics)
