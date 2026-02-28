"""
Graph Builder

Converts a parsed WNTR water network into PyTorch Geometric Data objects
suitable for training and inference with GNN models.
"""

import numpy as np
import networkx as nx

try:
    import torch
    from torch_geometric.data import Data
    HAS_TORCH_GEOMETRIC = True
except ImportError:
    HAS_TORCH_GEOMETRIC = False

import wntr


def network_to_graph(wn: wntr.network.WaterNetworkModel) -> nx.Graph:
    """
    Convert a WNTR network model to a NetworkX graph.

    Nodes are junctions with attributes: elevation, base_demand, coordinates.
    Edges are pipes with attributes: length, diameter, roughness.
    """
    G = wn.to_graph()

    # Enrich junction nodes with features
    for name in wn.junction_name_list:
        node = wn.get_node(name)
        G.nodes[name]["elevation"] = node.elevation
        G.nodes[name]["base_demand"] = node.base_demand
        G.nodes[name]["x"] = node.coordinates[0]
        G.nodes[name]["y"] = node.coordinates[1]
        G.nodes[name]["node_type"] = "junction"

    for name in wn.reservoir_name_list:
        node = wn.get_node(name)
        G.nodes[name]["elevation"] = node.base_head
        G.nodes[name]["base_demand"] = 0
        G.nodes[name]["x"] = node.coordinates[0]
        G.nodes[name]["y"] = node.coordinates[1]
        G.nodes[name]["node_type"] = "reservoir"

    for name in wn.tank_name_list:
        node = wn.get_node(name)
        G.nodes[name]["elevation"] = node.elevation
        G.nodes[name]["base_demand"] = 0
        G.nodes[name]["x"] = node.coordinates[0]
        G.nodes[name]["y"] = node.coordinates[1]
        G.nodes[name]["node_type"] = "tank"

    return G


def compute_graph_features(G: nx.Graph) -> dict:
    """
    Compute graph-structural features for each node:
    - degree
    - betweenness centrality
    - clustering coefficient
    """
    degrees = dict(G.degree())
    betweenness = nx.betweenness_centrality(G)
    clustering = nx.clustering(G)

    return {
        "degree": degrees,
        "betweenness": betweenness,
        "clustering": clustering,
    }


def build_pyg_data(
    wn: wntr.network.WaterNetworkModel,
    pressure_snapshot: np.ndarray = None,
    sensor_names: list = None,
) -> "Data":
    """
    Build a PyTorch Geometric Data object from a WNTR network model.

    Args:
        wn: WNTR water network model.
        pressure_snapshot: Optional array of pressure values at each junction
                          (same order as wn.junction_name_list).
        sensor_names: Optional list of junction names that have sensors.

    Returns:
        PyG Data object with node features, edge indices, and positions.
    """
    if not HAS_TORCH_GEOMETRIC:
        raise ImportError("PyTorch Geometric is required. Install with: pip install torch-geometric")

    G = network_to_graph(wn)
    graph_features = compute_graph_features(G)

    # Create ordered node list (junctions first, then reservoirs, tanks)
    all_nodes = wn.junction_name_list + wn.reservoir_name_list + wn.tank_name_list
    node_to_idx = {name: i for i, name in enumerate(all_nodes)}

    num_nodes = len(all_nodes)
    sensor_set = set(sensor_names) if sensor_names else set()

    # Build node feature matrix
    # Features: [elevation, base_demand, degree, betweenness, clustering, has_sensor]
    feature_dim = 6
    if pressure_snapshot is not None:
        feature_dim += 1  # Add pressure as a feature

    x = np.zeros((num_nodes, feature_dim), dtype=np.float32)

    for i, name in enumerate(all_nodes):
        if name in G.nodes:
            x[i, 0] = G.nodes[name].get("elevation", 0)
            x[i, 1] = G.nodes[name].get("base_demand", 0)
            x[i, 2] = graph_features["degree"].get(name, 0)
            x[i, 3] = graph_features["betweenness"].get(name, 0)
            x[i, 4] = graph_features["clustering"].get(name, 0)
            x[i, 5] = 1.0 if name in sensor_set else 0.0

            if pressure_snapshot is not None and i < len(pressure_snapshot):
                x[i, 6] = pressure_snapshot[i]

    # Build edge index (bidirectional)
    edge_list = []
    for u, v in G.edges():
        if u in node_to_idx and v in node_to_idx:
            edge_list.append([node_to_idx[u], node_to_idx[v]])
            edge_list.append([node_to_idx[v], node_to_idx[u]])

    if edge_list:
        edge_index = torch.tensor(edge_list, dtype=torch.long).t().contiguous()
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)

    # Node positions for visualization
    pos = np.zeros((num_nodes, 2), dtype=np.float32)
    for i, name in enumerate(all_nodes):
        if name in G.nodes:
            pos[i, 0] = G.nodes[name].get("x", 0)
            pos[i, 1] = G.nodes[name].get("y", 0)

    data = Data(
        x=torch.tensor(x),
        edge_index=edge_index,
        pos=torch.tensor(pos),
        num_nodes=num_nodes,
    )

    # Store node name mapping as metadata
    data.node_names = all_nodes
    data.node_to_idx = node_to_idx

    return data
