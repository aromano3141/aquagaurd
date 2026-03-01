
import pandas as pd
import numpy as np
import wntr
from pathlib import Path
import matplotlib.pyplot as plt

_ROOT = Path(__file__).resolve().parent
_DATA_DIR = _ROOT / 'data'
_EPANET_FILE = _DATA_DIR / 'L-TOWN.inp'
_GT_FILE = _DATA_DIR / 'leak_ground_truth' / '2019_Leakages.csv'

wn = wntr.network.WaterNetworkModel(str(_EPANET_FILE))
gt_df = pd.read_csv(str(_GT_FILE), delimiter=';', decimal=',').fillna(0)

active_pipes = gt_df.drop('Timestamp', axis=1).max()
active_pipes = active_pipes[active_pipes > 0].index.tolist()

true_coords = []
for pipe_id in active_pipes:
    if pipe_id in wn.link_name_list:
        link = wn.get_link(pipe_id)
        start_coord = np.array(wn.get_node(link.start_node_name).coordinates)
        end_coord = np.array(wn.get_node(link.end_node_name).coordinates)
        mid = (start_coord + end_coord) / 2
        true_coords.append(mid)
true_coords = np.array(true_coords)

sensor_nodes = ['n1', 'n4', 'n31', 'n415', 'n549', 'n105', 'n114', 'n215', 'n288', 'n332', 'n429', 'n506', 'n613', 'n644', 'n670', 'n722', 'n740', 'n769', 'n2', 'n3']
all_sensors = [s for s in sensor_nodes if s in wn.node_name_list]
sens_coords = np.array([wn.get_node(s).coordinates for s in all_sensors])

plt.figure(figsize=(10, 6))
# Plot all network nodes for backdrop
all_nodes = np.array([node.coordinates for node_name, node in wn.nodes()])
plt.scatter(all_nodes[:, 0], all_nodes[:, 1], s=1, c='gray', alpha=0.3, label='Network')

if len(true_coords) > 0:
    plt.scatter(true_coords[:, 0], true_coords[:, 1], c='red', marker='x', label='Ground Truth')
if len(sens_coords) > 0:
    plt.scatter(sens_coords[:, 0], sens_coords[:, 1], c='blue', marker='o', label='Sensors')

plt.legend()
plt.title('L-Town Coordinate Space Check')
plt.savefig('l_town_check.png')
print('Plot saved to l_town_check.png')

