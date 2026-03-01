
import pandas as pd
import numpy as np
import wntr
from pathlib import Path
from scipy.spatial.distance import euclidean
import networkx as nx

_ROOT = Path(__file__).resolve().parent
_DATA_DIR = _ROOT / 'data'
_EPANET_FILE = _DATA_DIR / 'L-TOWN.inp'

wn = wntr.network.WaterNetworkModel(str(_EPANET_FILE))
G = wn.get_graph()

# Get all node coordinates
node_coords = {}
for node_name, node in wn.nodes():
    node_coords[node_name] = np.array(node.coordinates)

def snap_to_node(target_coord):
    min_dist = float('inf')
    best_node = None
    for name, coord in node_coords.items():
        d = euclidean(target_coord, coord)
        if d < min_dist:
            min_dist = d
            best_node = name
    return best_node, min_dist

t_coord = np.array([1250, 600])
snapped, dist = snap_to_node(t_coord)
print(f'Test Coord: {t_coord} -> Snapped Node: {snapped} (Dist: {dist:.2f}m)')

