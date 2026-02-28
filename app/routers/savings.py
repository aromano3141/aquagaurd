"""Savings calculator API endpoints."""

from fastapi import APIRouter, Query
import pandas as pd

from ..services.data_service import get_ground_truth_raw

router = APIRouter(prefix="/api/savings", tags=["savings"])

DT_SEC = 300  # 5-minute sampling interval


@router.get("/compute")
async def compute_savings(
    water_cost: float = Query(2.50, ge=0.5, le=20.0),
    repair_cost: float = Query(8500, ge=1000, le=100000),
    detection_speedup: int = Query(7, ge=1, le=30),
):
    """Compute economic savings from early leak detection."""
    gt = get_ground_truth_raw()
    gt_ts = gt.set_index('Timestamp')

    active_pipes = [c for c in gt_ts.columns if gt_ts[c].max() > 0]

    leak_stats = []
    for pipe in active_pipes:
        series = gt_ts[pipe]
        active = series[series > 0]
        if len(active) == 0:
            continue
        start_time = active.index[0]
        end_time = active.index[-1]
        duration_days = (end_time - start_time).total_seconds() / 86400
        total_liters = active.sum() * DT_SEC
        total_m3 = total_liters / 1000
        peak_lps = float(active.max())
        avg_lps = float(active.mean())
        saved_liters = avg_lps * detection_speedup * 86400
        saved_m3 = saved_liters / 1000

        leak_stats.append({
            "pipe": pipe,
            "start": str(start_time),
            "duration_days": round(duration_days, 1),
            "total_m3": round(total_m3, 0),
            "saved_m3": round(saved_m3, 0),
            "peak_lps": round(peak_lps, 2),
            "avg_lps": round(avg_lps, 2),
            "water_lost_cost": round(total_m3 * water_cost, 0),
            "potential_savings": round(saved_m3 * water_cost, 0),
        })

    total_lost_m3 = sum(l["total_m3"] for l in leak_stats)
    total_saved_m3 = sum(l["saved_m3"] for l in leak_stats)
    total_lost_cost = total_lost_m3 * water_cost
    total_saved_cost = total_saved_m3 * water_cost
    total_repair_savings = len(leak_stats) * repair_cost * 0.3
    total_combined = total_saved_cost + total_repair_savings
    system_cost = 50000
    roi = ((total_combined - system_cost) / system_cost) * 100

    # Cumulative timeline (downsampled)
    cum_volume = (gt_ts[active_pipes].sum(axis=1) * DT_SEC / 1000).cumsum()
    step = max(1, len(cum_volume) // 500)
    timeline = [
        {"timestamp": str(ts), "cumulative_m3": round(float(v), 0)}
        for ts, v in cum_volume.iloc[::step].items()
    ]

    return {
        "total_lost_m3": round(total_lost_m3, 0),
        "total_lost_cost": round(total_lost_cost, 0),
        "total_saved_m3": round(total_saved_m3, 0),
        "total_saved_cost": round(total_saved_cost, 0),
        "total_repair_savings": round(total_repair_savings, 0),
        "total_combined_savings": round(total_combined, 0),
        "roi_pct": round(roi, 0),
        "num_leaks": len(leak_stats),
        "avg_duration_days": round(sum(l["duration_days"] for l in leak_stats) / max(len(leak_stats), 1), 0),
        "per_leak": leak_stats,
        "cumulative_timeline": timeline,
    }
