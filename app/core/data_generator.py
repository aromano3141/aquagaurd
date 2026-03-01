"""
Synthetic data generator for universal leak detection.
Uses WNTR to simulate normal and leak scenarios on any .inp network,
producing PyTorch Geometric Data objects for GNN training.
"""

import os
import random
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from torch_geometric.data import Data

import wntr


def _get_adjacency(wn):
    """Build edge_index tensor from the WNTR network."""
    node_list = wn.junction_name_list + wn.reservoir_name_list + wn.tank_name_list
    node_to_idx = {name: i for i, name in enumerate(node_list)}

    edges = []
    for link_name in wn.pipe_name_list:
        link = wn.get_link(link_name)
        i = node_to_idx.get(link.start_node_name)
        j = node_to_idx.get(link.end_node_name)
        if i is not None and j is not None:
            edges.append([i, j])
            edges.append([j, i])  # undirected

    if not edges:
        return torch.zeros((2, 0), dtype=torch.long), node_list, node_to_idx

    edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
    return edge_index, node_list, node_to_idx


def _simulate_pressures(wn, duration_hours=48):
    """Run a hydraulic simulation and return the mean pressure per junction."""
    wn.options.time.duration = duration_hours * 3600
    wn.options.time.hydraulic_timestep = 3600
    wn.options.time.report_timestep = 3600

    try:
        sim = wntr.sim.EpanetSimulator(wn)
        results = sim.run_sim()
    except Exception:
        # Fallback to WNTR's own solver if EPANET binary fails
        sim = wntr.sim.WNTRSimulator(wn)
        results = sim.run_sim()

    pressures = results.node['pressure']
    return pressures


def _compute_node_features(wn, pressures_df, node_list):
    """Compute per-node feature vectors: [mean_pressure, std_pressure, elevation, degree]."""
    node_to_idx_map = {name: i for i, name in enumerate(node_list)}
    n_nodes = len(node_list)
    features = np.zeros((n_nodes, 4), dtype=np.float32)

    # Degree (number of connected pipes)
    degree = np.zeros(n_nodes, dtype=np.float32)
    for link_name in wn.pipe_name_list:
        link = wn.get_link(link_name)
        i = node_to_idx_map.get(link.start_node_name)
        j = node_to_idx_map.get(link.end_node_name)
        if i is not None:
            degree[i] += 1
        if j is not None:
            degree[j] += 1

    for idx, name in enumerate(node_list):
        if name in pressures_df.columns:
            series = pressures_df[name].values
            features[idx, 0] = np.nanmean(series)
            features[idx, 1] = np.nanstd(series)
        try:
            node = wn.get_node(name)
            features[idx, 2] = getattr(node, 'elevation', 0.0)
        except Exception:
            features[idx, 2] = 0.0
        features[idx, 3] = degree[idx]

    return features


def _get_zone_labels(wn, node_list, node_to_idx, leak_node_name, zone_radius=2):
    """
    Label nodes within `zone_radius` hops of the leak node as 1 (leak zone), else 0.
    This creates the 'suspect area' rather than pinpointing a single pipe.
    """
    n_nodes = len(node_list)
    labels = np.zeros(n_nodes, dtype=np.float32)

    leak_idx = node_to_idx.get(leak_node_name)
    if leak_idx is None:
        return labels

    # BFS to find all nodes within zone_radius hops
    # Build adjacency list
    adj = {i: set() for i in range(n_nodes)}
    for link_name in wn.pipe_name_list:
        link = wn.get_link(link_name)
        i = node_to_idx.get(link.start_node_name)
        j = node_to_idx.get(link.end_node_name)
        if i is not None and j is not None:
            adj[i].add(j)
            adj[j].add(i)

    visited = {leak_idx}
    frontier = {leak_idx}
    for _ in range(zone_radius):
        next_frontier = set()
        for node in frontier:
            for neighbor in adj[node]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    next_frontier.add(neighbor)
        frontier = next_frontier

    for idx in visited:
        labels[idx] = 1.0

    return labels


def generate_dataset_for_network(
    inp_path: str,
    n_leak_scenarios: int = 50,
    zone_radius: int = 2,
    seed: int = 42,
) -> list[Data]:
    """
    Generate a dataset of PyG Data objects for a single .inp network.
    Each Data object represents one leak scenario with zone labels.
    """
    rng = random.Random(seed)
    wn_base = wntr.network.WaterNetworkModel(inp_path)
    edge_index, node_list, node_to_idx = _get_adjacency(wn_base)

    if len(node_list) < 3:
        return []

    # Step 1: Simulate baseline (no leaks)
    wn_baseline = wntr.network.WaterNetworkModel(inp_path)
    try:
        baseline_pressures = _simulate_pressures(wn_baseline)
    except Exception as e:
        print(f"  ⚠ Baseline simulation failed for {inp_path}: {e}")
        return []

    baseline_features = _compute_node_features(wn_base, baseline_pressures, node_list)

    # Step 2: Generate leak scenarios
    junction_names = wn_base.junction_name_list
    if not junction_names:
        return []

    # Sample leak locations (with replacement if needed)
    leak_nodes = [rng.choice(junction_names) for _ in range(n_leak_scenarios)]
    dataset = []

    for i, leak_node in enumerate(leak_nodes):
        try:
            # Create a fresh network and inject a leak
            wn_leak = wntr.network.WaterNetworkModel(inp_path)
            node = wn_leak.get_node(leak_node)

            # Add an emitter to simulate a leak (leak coefficient)
            leak_diameter = rng.uniform(0.01, 0.05)  # meters
            leak_area = np.pi * (leak_diameter / 2) ** 2
            leak_coeff = 0.75 * leak_area * np.sqrt(2 * 9.81)
            node.emitter_coefficient = leak_coeff

            # Simulate with the leak
            leak_pressures = _simulate_pressures(wn_leak)
            leak_features = _compute_node_features(wn_base, leak_pressures, node_list)

            # Compute residuals (how much pressure changed vs baseline)
            residuals = leak_features - baseline_features
            # Combine: [baseline_feat(4) + residual(4)] = 8 features per node
            combined = np.concatenate([baseline_features, residuals], axis=1)
            combined = np.nan_to_num(combined, nan=0.0, posinf=0.0, neginf=0.0)

            # Per-graph feature standardization to prevent exploding gradients
            mu = combined.mean(axis=0, keepdims=True)
            sigma = combined.std(axis=0, keepdims=True) + 1e-6
            combined = (combined - mu) / sigma

            # Zone labels
            labels = _get_zone_labels(wn_base, node_list, node_to_idx, leak_node, zone_radius)

            data = Data(
                x=torch.tensor(combined, dtype=torch.float),
                edge_index=edge_index,
                y=torch.tensor(labels, dtype=torch.float),
                num_nodes=len(node_list),
            )
            dataset.append(data)

        except Exception as e:
            # Some leak configurations may fail — skip them
            continue

    return dataset


def generate_full_dataset(
    inp_dir: str = "data/sample_networks",
    n_scenarios_per_network: int = 30,
    zone_radius: int = 2,
    save_path: Optional[str] = "data/models/training_data.pt",
) -> list[Data]:
    """
    Generate training data across all .inp files in a directory.
    """
    all_data = []
    inp_files = sorted(Path(inp_dir).glob("*.inp"))

    print(f"🔬 Generating synthetic leak data from {len(inp_files)} networks...")

    for inp_file in inp_files:
        print(f"  📐 Processing {inp_file.name}...")
        try:
            data = generate_dataset_for_network(
                str(inp_file),
                n_leak_scenarios=n_scenarios_per_network,
                zone_radius=zone_radius,
            )
            print(f"     ✅ Generated {len(data)} scenarios")
            all_data.extend(data)
        except Exception as e:
            print(f"     ❌ Failed: {e}")

    print(f"\n📊 Total training samples: {len(all_data)}")

    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        torch.save(all_data, save_path)
        print(f"💾 Saved to {save_path}")

    return all_data


if __name__ == "__main__":
    generate_full_dataset()
