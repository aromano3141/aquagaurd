"""
Network Parser Service

Parses EPANET .inp files using WNTR and extracts the water distribution
network topology: junctions, pipes, sensors, and their spatial coordinates.
"""

import wntr


def parse_inp_file(inp_path: str) -> dict:
    """
    Parse an EPANET .inp file and return a JSON-serializable dict containing
    the network topology (nodes, edges, metadata).

    Args:
        inp_path: Path to the .inp file on disk.

    Returns:
        Dictionary with keys: nodes, edges, metadata
    """
    wn = wntr.network.WaterNetworkModel(inp_path)

    # Extract junctions (nodes)
    nodes = []
    for name, junction in wn.junctions():
        coords = wn.get_node(name).coordinates
        nodes.append({
            "id": name,
            "type": "junction",
            "x": coords[0],
            "y": coords[1],
            "elevation": junction.elevation,
            "base_demand": junction.base_demand,
        })

    # Extract reservoirs
    for name, reservoir in wn.reservoirs():
        coords = wn.get_node(name).coordinates
        nodes.append({
            "id": name,
            "type": "reservoir",
            "x": coords[0],
            "y": coords[1],
            "elevation": reservoir.base_head,
            "base_demand": 0,
        })

    # Extract tanks
    for name, tank in wn.tanks():
        coords = wn.get_node(name).coordinates
        nodes.append({
            "id": name,
            "type": "tank",
            "x": coords[0],
            "y": coords[1],
            "elevation": tank.elevation,
            "base_demand": 0,
        })

    # Extract pipes (edges)
    edges = []
    for name, pipe in wn.pipes():
        edges.append({
            "id": name,
            "start_node": pipe.start_node_name,
            "end_node": pipe.end_node_name,
            "length": pipe.length,
            "diameter": pipe.diameter,
            "roughness": pipe.roughness,
        })

    # Extract pumps
    for name, pump in wn.pumps():
        edges.append({
            "id": name,
            "start_node": pump.start_node_name,
            "end_node": pump.end_node_name,
            "length": 0,
            "diameter": 0,
            "roughness": 0,
            "type": "pump",
        })

    # Extract valves
    for name, valve in wn.valves():
        edges.append({
            "id": name,
            "start_node": valve.start_node_name,
            "end_node": valve.end_node_name,
            "length": 0,
            "diameter": valve.diameter,
            "roughness": 0,
            "type": "valve",
        })

    metadata = {
        "num_junctions": wn.num_junctions,
        "num_pipes": wn.num_pipes,
        "num_reservoirs": wn.num_reservoirs,
        "num_tanks": wn.num_tanks,
        "num_pumps": wn.num_pumps,
        "num_valves": wn.num_valves,
    }

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": metadata,
    }
