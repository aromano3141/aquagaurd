"""Network and ground truth API endpoints."""

from fastapi import APIRouter

from ..services.network_service import get_network_data, get_ground_truth_coords
from ..services.data_service import get_active_leak_pipes

router = APIRouter(prefix="/api/network", tags=["network"])


@router.get("")
async def get_network():
    """Return the full network topology (nodes + links + stats)."""
    return get_network_data()


@router.get("/ground-truth")
async def get_ground_truth():
    """Return ground-truth leak locations with midpoint coordinates."""
    active_pipes = get_active_leak_pipes()
    coords = get_ground_truth_coords(active_pipes)
    return {"leaks": coords, "count": len(coords)}
