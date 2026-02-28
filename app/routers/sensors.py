"""Sensor data API endpoints."""

from fastapi import APIRouter, Query
import pandas as pd

from ..services.data_service import get_pressures
from ..services.pipeline_service import run_pipeline

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.get("")
async def list_sensors():
    """Return all available sensor node IDs."""
    p = get_pressures()
    return {"sensor_ids": p.columns.tolist()}


@router.get("/timeseries")
async def get_timeseries(
    sensors: str = Query(..., description="Comma-separated sensor IDs"),
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """Return pressure time-series for selected sensors within a date range."""
    p = get_pressures()
    sensor_list = [s.strip() for s in sensors.split(",")]

    # Validate sensors exist
    valid = [s for s in sensor_list if s in p.columns]
    if not valid:
        return {"data": [], "sensors": []}

    filtered = p[valid]
    if start_date:
        filtered = filtered.loc[start_date:]
    if end_date:
        filtered = filtered.loc[:end_date]

    # Downsample for large ranges (keep every Nth point for performance)
    if len(filtered) > 5000:
        step = len(filtered) // 5000
        filtered = filtered.iloc[::step]

    data = []
    for ts, row in filtered.iterrows():
        point = {"timestamp": str(ts)}
        for s in valid:
            point[s] = round(float(row[s]), 4) if pd.notna(row[s]) else None
        data.append(point)

    return {"data": data, "sensors": valid}


@router.get("/stats")
async def get_stats(
    sensors: str = Query(..., description="Comma-separated sensor IDs"),
    start_date: str = Query(None),
    end_date: str = Query(None),
):
    """Return statistics (mean, std, min, max) for selected sensors."""
    p = get_pressures()
    sensor_list = [s.strip() for s in sensors.split(",")]
    valid = [s for s in sensor_list if s in p.columns]

    filtered = p[valid]
    if start_date:
        filtered = filtered.loc[start_date:]
    if end_date:
        filtered = filtered.loc[:end_date]

    stats = []
    desc = filtered.describe().T
    for sensor_id in valid:
        stats.append({
            "sensor_id": sensor_id,
            "mean": round(float(desc.loc[sensor_id, "mean"]), 2),
            "std": round(float(desc.loc[sensor_id, "std"]), 2),
            "min": round(float(desc.loc[sensor_id, "min"]), 2),
            "max": round(float(desc.loc[sensor_id, "max"]), 2),
        })

    return {"stats": stats}
