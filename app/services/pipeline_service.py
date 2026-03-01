"""
Pipeline service — wraps the LILA detection pipeline and caches results.
"""

from pathlib import Path
import numpy as np
import wntr

from ..core.detect_leaks import LILA_Pipeline, evaluate_accuracy

_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = _ROOT / 'data'
_SCADA_DIR = _DATA_DIR / 'SCADA_data' / '2019'
_EPANET_FILE = _DATA_DIR / 'L-TOWN.inp'
_GT_FILE = _DATA_DIR / 'leak_ground_truth' / '2019_Leakages.csv'

_results: list[dict] | None = None
_pipeline = None
_detector = None
_df_cs = None
_detected_leaks = None


def run_pipeline() -> list[dict]:
    global _results, _pipeline, _detector, _df_cs, _detected_leaks
    if _results is not None:
        return _results

    pipe = LILA_Pipeline(data_dir=str(_SCADA_DIR), epanet_file=str(_EPANET_FILE))
    detected_leaks, computed_df_cs, detector, fault_matrix = pipe.run()

    _pipeline = pipe
    _detector = detector
    _df_cs = computed_df_cs
    _detected_leaks = detected_leaks

    wn = wntr.network.WaterNetworkModel(str(_EPANET_FILE))
    results_list = []
    for node, ts in detected_leaks.items():
        if fault_matrix:
            res = detector.localize_physics_based(ts, computed_df_cs, wn, fault_matrix)
        else:
            res = detector.triangulate(ts, computed_df_cs, wn, detector.pressures, w_gnn=0.5, w_ent=2.0)
            
        if res[0] is None:
            continue
        gps = res[0]
        coords_list = res[1] or []
        weights_list = res[2] or []
        node_names = res[3] or []
        snapped_pipe = res[4] if len(res) > 4 else None
        
        severity = float(computed_df_cs.loc[ts, node]) if node in computed_df_cs.columns else 0.0
        
        heatmap = []
        for i in range(len(coords_list)):
            heatmap.append({
                "x": float(coords_list[i][0]),
                "y": float(coords_list[i][1]),
                "weight": float(weights_list[i]),
                "node": node_names[i]
            })
            
        # Simulated Work Order logic for real data
        gallons_lost = int(severity * 1000 + 500)
        cost_per = round(gallons_lost * 0.03, 2)
        dispatch_target = res[4] if len(res) > 4 and res[4] else (node_names[np.argmax(weights_list)] if weights_list else node)
        conf = float(np.max(weights_list)) * 100 if weights_list else 0.0

        results_list.append({
            "detected_node": dispatch_target, "estimated_start_time": str(ts),
            "gps_coordinates": list(gps) if gps else None,
            "estimated_cusum_severity": severity,
            "heatmap": heatmap,
            "work_order": {
                "dispatch_target": dispatch_target,
                "gallons_lost_per_hour": gallons_lost,
                "cost_per_hour": cost_per,
                "confidence_score": round(conf, 1)
            }
        })

    _results = results_list
    return _results


def get_metrics() -> dict:
    run_pipeline()
    mean_error = None
    if _detected_leaks and _pipeline and _pipeline.network:
        mean_error = evaluate_accuracy(
            _detected_leaks, _df_cs, _detector,
            _pipeline.network, str(_GT_FILE), w_gnn=0.5, w_ent=2.0
        )
    improvement = ((151.03 - mean_error) / 151.03) * 100 if mean_error is not None else None
    return {
        "leaks_detected": len(_results) if _results else 0,
        "ground_truth_leaks": 23,
        "mean_localization_error": round(mean_error, 2) if mean_error else None,
        "baseline_error": 151.03,
        "improvement_pct": round(improvement, 1) if improvement else None,
        "optimal_w_gnn": 0.5, "optimal_w_ent": 2.0,
    }
