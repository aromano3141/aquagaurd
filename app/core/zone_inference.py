"""
Zone inference — load a trained universal model and run zone-level
leak detection on any .inp network.
"""

import os
from pathlib import Path

import numpy as np
import torch
from torch_geometric.data import Data

import wntr

from .data_generator import _get_adjacency, _simulate_pressures, _compute_node_features
from .zone_model import ZoneLeakDetector


_MODEL_PATH = Path(__file__).resolve().parents[2] / "data" / "models" / "universal_zone_model.pt"
_model_cache = None


def _load_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    if not _MODEL_PATH.exists():
        raise FileNotFoundError(f"No trained model found at {_MODEL_PATH}. Run scripts/train_universal.py first.")

    checkpoint = torch.load(_MODEL_PATH, map_location="cpu", weights_only=False)
    model = ZoneLeakDetector(
        in_channels=checkpoint["in_channels"],
        hidden_channels=checkpoint["hidden_channels"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    _model_cache = model
    return model


def detect_zones(
    inp_path: str,
    leak_node: str | None = None,
    top_k_zones: int = 10,
) -> dict:
    """
    Run zone-level leak detection on a network.

    If leak_node is provided, inject a simulated leak at that node.
    Otherwise, simulate a random leak for demo purposes.

    Returns dict with:
      - nodes: [{id, x, y, probability}, ...]
      - links: [{id, start, end, start_x, start_y, end_x, end_y}, ...]
      - zones: top-K suspect nodes sorted by probability
      - stats: {total_nodes, suspect_nodes, clear_pct, ...}
    """
    model = _load_model()

    wn = wntr.network.WaterNetworkModel(inp_path)
    edge_index, node_list, node_to_idx = _get_adjacency(wn)

    # Baseline simulation
    wn_baseline = wntr.network.WaterNetworkModel(inp_path)
    baseline_pressures = _simulate_pressures(wn_baseline)
    baseline_features = _compute_node_features(wn, baseline_pressures, node_list)

    # Leak simulation
    wn_leak = wntr.network.WaterNetworkModel(inp_path)
    junctions = wn_leak.junction_name_list

    if leak_node and leak_node in junctions:
        target = leak_node
    else:
        import random
        target = random.choice(junctions)

    node_obj = wn_leak.get_node(target)
    leak_area = np.pi * (0.03 / 2) ** 2
    node_obj.emitter_coefficient = 0.75 * leak_area * np.sqrt(2 * 9.81)

    leak_pressures = _simulate_pressures(wn_leak)
    leak_features = _compute_node_features(wn, leak_pressures, node_list)

    residuals = leak_features - baseline_features
    combined = np.concatenate([baseline_features, residuals], axis=1)
    combined = np.nan_to_num(combined, nan=0.0, posinf=0.0, neginf=0.0)

    # Per-graph feature standardization
    mu = combined.mean(axis=0, keepdims=True)
    sigma = combined.std(axis=0, keepdims=True) + 1e-6
    combined = (combined - mu) / sigma

    data = Data(
        x=torch.tensor(combined, dtype=torch.float),
        edge_index=edge_index,
        num_nodes=len(node_list),
    )

    # Run model
    probs = model.predict_proba(data).numpy()

    # Build node list with coordinates and probabilities
    nodes_out = []
    for idx, name in enumerate(node_list):
        try:
            node = wn.get_node(name)
            coords = node.coordinates
            nodes_out.append({
                "id": name,
                "x": float(coords[0]),
                "y": float(coords[1]),
                "probability": float(probs[idx]),
            })
        except Exception:
            continue

    # Build links
    links_out = []
    for link_name in wn.pipe_name_list:
        link = wn.get_link(link_name)
        try:
            start_node = wn.get_node(link.start_node_name)
            end_node = wn.get_node(link.end_node_name)
            links_out.append({
                "id": link_name,
                "start": link.start_node_name,
                "end": link.end_node_name,
                "start_x": float(start_node.coordinates[0]),
                "start_y": float(start_node.coordinates[1]),
                "end_x": float(end_node.coordinates[0]),
                "end_y": float(end_node.coordinates[1]),
            })
        except Exception:
            continue

    # Sort zones by probability
    sorted_nodes = sorted(nodes_out, key=lambda n: n["probability"], reverse=True)
    top_zones = sorted_nodes[:top_k_zones]

    suspect_count = sum(1 for n in nodes_out if n["probability"] > 0.5)
    total = len(nodes_out)
    clear_pct = round((total - suspect_count) / total * 100, 1) if total > 0 else 100.0

    return {
        "nodes": nodes_out,
        "links": links_out,
        "zones": top_zones,
        "injected_leak": target,
        "stats": {
            "total_nodes": total,
            "suspect_nodes": suspect_count,
            "clear_pct": clear_pct,
            "top_zone_probability": round(top_zones[0]["probability"] * 100, 1) if top_zones else 0,
        },
    }
