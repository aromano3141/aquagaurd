
import pandas as pd
import numpy as np
import wntr
from pathlib import Path
from scipy.spatial.distance import euclidean

_ROOT = Path(__file__).resolve().parent
_DATA_DIR = _ROOT / 'data'
_EPANET_FILE = _DATA_DIR / 'L-TOWN.inp'
_GT_FILE = _DATA_DIR / 'leak_ground_truth' / '2019_Leakages.csv'

wn = wntr.network.WaterNetworkModel(str(_EPANET_FILE))
gt_df = pd.read_csv(str(_GT_FILE), delimiter=';', decimal=',').fillna(0)

active_pipes = gt_df.drop('Timestamp', axis=1).max()
active_pipes = active_pipes[active_pipes > 0].index.tolist()

print('--- Ground Truth Leaks ---')
for pipe_id in active_pipes:
    if pipe_id in wn.link_name_list:
        link = wn.get_link(pipe_id)
        start_coord = np.array(wn.get_node(link.start_node_name).coordinates)
        end_coord = np.array(wn.get_node(link.end_node_name).coordinates)
        mid = (start_coord + end_coord) / 2
        print(f'{pipe_id}: {mid}')

print('\n--- Sensors ---')
for sens in ['n1', 'n4', 'n31', 'n415', 'n549', 'n105']:
    if sens in wn.node_name_list:
        print(f'{sens}: {wn.get_node(sens).coordinates}')

