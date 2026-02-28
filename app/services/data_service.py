"""
Data service — loads and caches SCADA sensor data and ground truth.
"""

from pathlib import Path
import pandas as pd

# Project root is 2 levels up from app/services/
_ROOT = Path(__file__).resolve().parents[2]
_DATA_DIR = _ROOT / 'data'
_SCADA_DIR = _DATA_DIR / 'SCADA_data' / '2019'
_GT_FILE = _DATA_DIR / 'leak_ground_truth' / '2019_Leakages.csv'

_pressures: pd.DataFrame | None = None
_flows: pd.DataFrame | None = None
_ground_truth_raw: pd.DataFrame | None = None


def get_pressures() -> pd.DataFrame:
    global _pressures
    if _pressures is None:
        p = pd.read_csv(
            _SCADA_DIR / 'Pressures.csv',
            dayfirst=True, sep=';', decimal=','
        )
        p.index = pd.to_datetime(p['Timestamp'])
        _pressures = p.drop('Timestamp', axis=1)
    return _pressures


def get_flows() -> pd.DataFrame:
    global _flows
    if _flows is None:
        f = pd.read_csv(
            _SCADA_DIR / 'Flows.csv',
            dayfirst=True, sep=';', decimal=','
        )
        f.index = pd.to_datetime(f['Timestamp'])
        _flows = f.drop('Timestamp', axis=1)
    return _flows


def get_ground_truth_raw() -> pd.DataFrame:
    global _ground_truth_raw
    if _ground_truth_raw is None:
        gt = pd.read_csv(_GT_FILE, sep=';', decimal=',').fillna(0)
        gt['Timestamp'] = pd.to_datetime(gt['Timestamp'])
        _ground_truth_raw = gt
    return _ground_truth_raw


def get_active_leak_pipes() -> list[str]:
    gt = get_ground_truth_raw()
    gt_ts = gt.set_index('Timestamp')
    active = gt_ts.max()
    return active[active > 0].index.tolist()
