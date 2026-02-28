"""
Network service — loads and caches the EPANET water network model.
"""

from pathlib import Path
import numpy as np
import wntr

_ROOT = Path(__file__).resolve().parents[2]
_EPANET_FILE = _ROOT / 'data' / 'L-TOWN.inp'

_network = None


def get_network():
    global _network
    if _network is None:
        _network = wntr.network.WaterNetworkModel(str(_EPANET_FILE))
    return _network


def get_network_data() -> dict:
    wn = get_network()
    nodes = [{"id": n, "x": float(nd.coordinates[0]), "y": float(nd.coordinates[1])} for n, nd in wn.nodes()]
    links = []
    for name, link in wn.links():
        sc = wn.get_node(link.start_node_name).coordinates
        ec = wn.get_node(link.end_node_name).coordinates
        links.append({
            "id": name, "start_node": link.start_node_name, "end_node": link.end_node_name,
            "start_x": float(sc[0]), "start_y": float(sc[1]),
            "end_x": float(ec[0]), "end_y": float(ec[1]),
        })
    return {"nodes": nodes, "links": links, "num_nodes": wn.num_nodes, "num_links": wn.num_links}


def get_ground_truth_coords(active_pipes: list[str]) -> list[dict]:
    wn = get_network()
    coords = []
    for pipe_id in active_pipes:
        if pipe_id in wn.link_name_list:
            link = wn.get_link(pipe_id)
            sc = np.array(wn.get_node(link.start_node_name).coordinates)
            ec = np.array(wn.get_node(link.end_node_name).coordinates)
            mid = (sc + ec) / 2
            coords.append({"pipe_id": pipe_id, "x": float(mid[0]), "y": float(mid[1])})
    return coords
