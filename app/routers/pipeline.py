"""Pipeline API endpoints."""

from fastapi import APIRouter
from ..services import pipeline_service
from ..schemas import LeakResult, PipelineMetrics

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("/run", response_model=list[LeakResult])
async def run_pipeline():
    """Run the full detection pipeline and return detected leaks."""
    return pipeline_service.run_pipeline()


@router.get("/metrics", response_model=PipelineMetrics)
async def get_metrics():
    """Get pipeline accuracy metrics."""
    return pipeline_service.get_metrics()
