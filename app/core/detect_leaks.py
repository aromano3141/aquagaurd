import os
import warnings
from pathlib import Path

import einops
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
import wntr
from scipy.fft import fft
from scipy.spatial.distance import euclidean
from scipy.stats import entropy
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import Data
from torch_geometric.loader import DataLoader
from torch_geometric.nn import GATv2Conv

from .models import AnomalyLeakDetector

warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

def permutation_entropy_1d(series, m=3, tau=1):
    if isinstance(series, pd.Series):
        series = series.values
    n = len(series)
    if n <= (m - 1) * tau:
        return 0.0

    permutations = []
    for i in range(n - (m - 1) * tau):
        vec = series[i:i + m * tau:tau]
        permutation = np.argsort(vec)
        permutations.append(tuple(permutation))

    unique_perms, counts = np.unique(permutations, axis=0, return_counts=True)
    probs = counts / len(permutations)
    return entropy(probs, base=2)

def fourier_entropy_1d(series):
    if isinstance(series, pd.Series):
        series = series.values
    fft_coeffs = fft(series)
    power_spectrum = np.abs(fft_coeffs) ** 2
    ps_sum = np.sum(power_spectrum)
    if ps_sum == 0:
        return 0.0
    normalized_spectrum = power_spectrum / ps_sum
    return entropy(normalized_spectrum, base=2)

class LeakDetector:
    def __init__(self, pressures, flows, delta=4, C_thr=3, est_length='3 days'):
        self.pressures = pressures
        self.flows = flows
        
        # CUSUM Configuration
        self.delta = delta
        self.C_thr = C_thr
        self.est_length = pd.Timedelta(est_length)
        self.nodes = pressures.columns.tolist()
        
        # GNN Configuration
        self.gnn_model = None
        self.gnn_scaler = None
        self.edge_index = None

    def _load_edge_index(self):
        # Load edge_index.csv and make it undirected
        edge_path = str(Path(__file__).resolve().parents[2] / 'data' / 'edge_index.csv')
        if not os.path.exists(edge_path):
            return None
            
        edges_df = pd.read_csv(edge_path)
        # Node mapping: usually CSV has nodes 1-32. We need 0-31.
        node1 = edges_df['Node1'].values - 1
        node2 = edges_df['Node2'].values - 1
        
        edges = np.vstack([node1, node2])
        edges_reversed = np.vstack([node2, node1])
        edge_index = np.hstack([edges, edges_reversed])
        return torch.tensor(edge_index, dtype=torch.long)

    def _extract_gnn_features(self, df):
        # Rolling window feature extraction (mean, max, min, std)
        # df shape: (T, N)
        window_size = 120
        stride = 10
        
        # We need a tensor of shape (T, N)
        tensor_data = torch.tensor(df.values, dtype=torch.float32)
        # Unfold to get windows: (T//stride, N, window_size)
        windows = tensor_data.unfold(0, window_size, stride).float()
        
        mean_v = windows.mean(dim=2)
        max_v = windows.max(dim=2).values
        min_v = windows.min(dim=2).values
        std_v = windows.std(dim=2)
        
        # Stack features: (num_windows, N, 4)
        features = torch.stack([mean_v, max_v, min_v, std_v], dim=2)
        return features
        
    def train_gnn(self, cor_time_frame):
        print("Training GNN AnomalyLeakDetector on calibration period...")
        df_cal = self.pressures.loc[cor_time_frame[0]:cor_time_frame[1]]
        
        self.edge_index = self._load_edge_index()
        if self.edge_index is None:
            print("Warning: GNN edge_index not found. Skipping GNN.")
            return

        features = self._extract_gnn_features(df_cal) # (W, N, 4)
        num_windows, num_nodes, num_feats = features.shape
        
        # Standardize features
        features_flat = einops.rearrange(features, 'w n f -> (w n) f')
        self.gnn_scaler = StandardScaler()
        features_scaled = torch.tensor(self.gnn_scaler.fit_transform(features_flat.numpy()), dtype=torch.float32)
        features_scaled = einops.rearrange(features_scaled, '(w n) f -> w n f', n=num_nodes)
        
        # Create dataset
        data_list = [
            Data(x=features_scaled[i], edge_index=self.edge_index, y=features_scaled[i])
            for i in range(num_windows)
        ]
        
        loader = DataLoader(data_list, batch_size=256, shuffle=True)
        
        # Initialize model
        self.gnn_model = AnomalyLeakDetector(node_in=4, hid_dim=16, num_layers=4, edge_in=None, gnn_layer=GATv2Conv)
        optimizer = torch.optim.AdamW(self.gnn_model.parameters(), lr=0.01, weight_decay=1e-4)
        
        self.gnn_model.train()
        epochs = 15 # Short training runs well for MAE setup
        for epoch in range(epochs):
            for data in loader:
                optimizer.zero_grad()
                out = self.gnn_model(data)
                loss = F.l1_loss(out, data.y)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.gnn_model.parameters(), 1.0)
                optimizer.step()
        print("GNN Training completed.")

    def leak_analysis(self, cor_time_frame):
        """
        Runs the linear regression across all nodes to find error residuals.
        Engineers a flow-to-pressure ratio to help differentiate high usage (demand) vs true leaks.
        """
        N = len(self.nodes)
        T = self.pressures.shape[0]
        
        # P = N x T array
        P = self.pressures.values.T 
        # V = Flow array (assuming PUMP_1 is the input source)
        V = self.flows['PUMP_1'].values

        res = np.zeros((N, T))
        K0 = np.zeros((N, N))
        K1 = np.zeros((N, N))
        Kd = np.zeros((N, N))
        Kr = np.zeros((N, N)) # New learned coefficient for the Ratio term

        print("Fitting regression models with Flow-to-Pressure ratio feature...")

        for i, node in enumerate(self.nodes):
            # Target variable: Specific node's pressure
            y_tr = self.pressures[node].loc[cor_time_frame[0]:cor_time_frame[1]].values.reshape(-1, 1)

            # Iterating through all reference nodes
            for j, node_cor in enumerate(self.nodes):
                if i == j:
                    continue # Ignore self

                # Feature 1: Reference Node Pressure
                p_ref = self.pressures[node_cor].loc[cor_time_frame[0]:cor_time_frame[1]].values.reshape(-1, 1)
                
                # Feature 2: Flow source
                v_tr = self.flows['PUMP_1'].loc[cor_time_frame[0]:cor_time_frame[1]].values.reshape(-1, 1)
                
                # ENGINEERED FEATURE: Flow-to-Pressure ratio (Demand vs Leak differentiator)
                # Adds non-linearity. A hydrant open event shows a massive localized drop relative to systemic flow.
                # Adding 1e-6 to avoid division by zero.
                ratio_tr = v_tr / (p_ref + 1e-6)

                X_tr = np.concatenate([p_ref, v_tr, ratio_tr], axis=1)

                model = LinearRegression()
                model.fit(X_tr, y_tr)

                K0[i, j] = model.intercept_[0]
                K1[i, j] = model.coef_[0][0]
                Kd[i, j] = model.coef_[0][1]
                Kr[i, j] = model.coef_[0][2]

        print("Calculating Error residuals across the time-series...")
        # Calculate error across all T
        np.fill_diagonal(K0, 0)
        np.fill_diagonal(K1, 1)
        np.fill_diagonal(Kd, 0)
        np.fill_diagonal(Kr, 0)

        # Batch prediction over all times t
        # e(i, j, t) = p_i(t) - (K0 + K1*p_j(t) + Kd*v(t) + Kr*(v(t)/p_j(t)))
        for t in range(T):
            P_t = P[:, t] # Vector of length N
            V_t = V[t]

            # Vectorized computation for speed
            # e_t is N x N matrix (Target Node i = row, Reference Node j = col)
            ratio_t = V_t / (P_t + 1e-6)
            
            # Predict P_t using all combinations
            P_pred = K0 + K1 * P_t + Kd * V_t + Kr * ratio_t
            
            # Error (True - Predicted)
            # e_t shape -> (N, N)
            # P_t[:, np.newaxis] broadcasts the true targets column-wise
            e_t = P_t[:, np.newaxis] - P_pred

            # We only care about positive error (pressure drops more than predicted)
            e_t[e_t < 0] = 0
            
            # Thresholding relative size
            e_t = np.clip(e_t, 0, 1)

            # Sum of errors for a given Target Node 'i' across all references 'j'
            node_error_sums = np.sum(e_t, axis=1)
            
            # Find the node that is deviating the most overall
            i_max = np.argmax(node_error_sums)

            # Record the L2 Norm (Frobenius for the slice) of the error for the worst node at time t
            res[i_max, t] = np.linalg.norm(e_t[i_max, :])

        MRE = pd.DataFrame(res.T, index=self.pressures.index, columns=self.nodes)
        return MRE

    def cusum_detect(self, df):
        """
        Runs CUSUM change point detection to find the exact timestamp a leak starts.
        """
        print("Running CUSUM Change Point Detection...")
        ar_mean = np.zeros(df.shape[1])
        ar_sigma = np.zeros(df.shape[1])
        
        for i, col in enumerate(df.columns):
            traj = df[col].replace(0, np.nan).dropna()
            if traj.empty:
                continue
            time_window = traj.index[0] + self.est_length
            ar_mean[i] = traj.loc[:time_window].mean()
            ar_sigma[i] = traj.loc[:time_window].std()

        ar_K = (self.delta / 2) * ar_sigma
        cumsum = np.zeros(df.shape)
        
        # Positive Cusum update
        for i in range(1, df.shape[0]):
            update_val = df.iloc[i, :] - ar_mean + cumsum[i-1, :] - ar_K
            cumsum[i, :] = np.maximum(0, update_val)

        df_cs = pd.DataFrame(cumsum, columns=df.columns, index=df.index)

        leak_det = {}
        for i, pipe in enumerate(df_cs.columns):
            C_thr_abs = self.C_thr * ar_sigma[i]
            alarms = df_cs[pipe] > C_thr_abs
            if alarms.any():
                leak_det[pipe] = df_cs.index[alarms][0]


        return leak_det, df_cs

    def triangulate(self, timestamp, df_cs, network, pressures_df, w_gnn=1.0, w_ent=1.0):
        """
        Calculates the triangulated leak position using Inverse Distance Weighting
        enhanced with GNN reconstruction error and entropy features on the top 3 nodes.
        """
        cusum_at_t = df_cs.loc[timestamp]
        top_sensors = cusum_at_t.nlargest(3)
        total_error = top_sensors.sum()
        
        if total_error == 0:
            return None
            
        gnn_node_errors = None
        if self.gnn_model is not None and self.gnn_scaler is not None:
            window_start = timestamp - pd.Timedelta('10 hours')
            df_window = pressures_df.loc[window_start:timestamp]
            if len(df_window) >= 120:
                features = self._extract_gnn_features(df_window.tail(120))
                if features.shape[0] == 1:
                    num_nodes = features.shape[1]
                    f_flat = einops.rearrange(features, 'w n f -> (w n) f')
                    f_scaled = torch.tensor(self.gnn_scaler.transform(f_flat.numpy()), dtype=torch.float32)
                    f_scaled = einops.rearrange(f_scaled, '(w n) f -> w n f', n=num_nodes)
                    
                    data = Data(x=f_scaled[0], edge_index=self.edge_index, y=f_scaled[0])
                    self.gnn_model.eval()
                    with torch.no_grad():
                        recon = self.gnn_model(data)
                        gnn_node_errors = torch.mean(torch.abs(data.y - recon), dim=1).numpy()

        coords = []
        weights = []
        
        window_start = timestamp - self.est_length

        for node, error_val in top_sensors.items():
            if node in network.node_name_list:
                node_obj = network.get_node(node)
                
                node_idx = self.nodes.index(node)
                node_gnn_error = gnn_node_errors[node_idx] if gnn_node_errors is not None else 0
                
                series = pressures_df.loc[window_start:timestamp, node]
                if len(series) > 10:
                    f_ent = fourier_entropy_1d(series)
                    p_ent = permutation_entropy_1d(series[::3])
                    
                    if np.isnan(f_ent): f_ent = 0
                    if np.isnan(p_ent): p_ent = 0
                    
                    node_weight = (error_val + w_gnn * node_gnn_error + w_ent * f_ent) * (p_ent + 1e-3)
                else:
                    node_weight = error_val + w_gnn * node_gnn_error
                
                coords.append(node_obj.coordinates)
                weights.append(node_weight)
                
        if not coords:
            return None
            
        weights = np.array(weights)
        if np.sum(weights) == 0:
            weights = np.ones_like(weights)
        weights = weights / np.sum(weights)
        
        coords = np.array(coords)
        predicted_coord = np.sum(coords * weights[:, np.newaxis], axis=0)

        return tuple(predicted_coord)

class LILA_Pipeline:
    def __init__(self, data_dir, epanet_file=None):
        self.data_dir = data_dir
        self.epanet_file = epanet_file
        
        self.pressures = None
        self.flows = None
        self.network = None

    def load_data(self):
        print("Loading SCADA Data...")
        pressures_raw = pd.read_csv(
            os.path.join(self.data_dir, 'Pressures.csv'),
            dayfirst=True, sep=';', decimal=','
        )
        pressures_raw.index = pd.to_datetime(pressures_raw['Timestamp'])
        self.pressures = pressures_raw.drop('Timestamp', axis=1)
        
        flows_raw = pd.read_csv(
            os.path.join(self.data_dir, 'Flows.csv'),
            dayfirst=True, sep=';', decimal=','
        )
        flows_raw.index = pd.to_datetime(flows_raw['Timestamp'])
        self.flows = flows_raw.drop('Timestamp', axis=1)
        print(f"Loaded {len(self.pressures)} pressure constraints.")

    def load_network(self):
        if not self.epanet_file: return
        self.network = wntr.network.WaterNetworkModel(self.epanet_file)

    def run(self):
        self.load_data()
        self.load_network()
        
        # Calibration time frame from the original notebook (no-leak period)
        cor_time_frame = ['2019-01-01 00:00', '2019-01-14 23:55']
        
        detector = LeakDetector(self.pressures, self.flows)
        
        # 1. Train GNN on Calibration timeframe
        detector.train_gnn(cor_time_frame)
        
        # 2. Linear regression with flow/pressure ratio
        mre_residuals = detector.leak_analysis(cor_time_frame)
        
        # 3. Extract Leak timestamps using CUSUM
        detected_leaks, computed_df_cs = detector.cusum_detect(mre_residuals)
        
        return detected_leaks, computed_df_cs, detector

def evaluate_accuracy(detected_leaks, computed_df_cs, detector_obj, network, ground_truth_path, w_gnn=1.0, w_ent=1.0):
    try:
        gt_df = pd.read_csv(ground_truth_path, delimiter=';', decimal=',').fillna(0)
    except Exception as e:
        print(f"Ground truth file not found or unreadable. Skipping Evaluation. ({e})")
        return None
        
    if not len(detected_leaks):
        print("No leaks detected to evaluate.")
        return None

    # Find the start timestamps and mapping of actual leaks.
    active_pipes = gt_df.drop('Timestamp', axis=1).max()
    active_pipes = active_pipes[active_pipes > 0].index.tolist()
    
    true_coords = []
    for pipe_id in active_pipes:
        if pipe_id in network.link_name_list:
            link = network.get_link(pipe_id)
            start_coord = np.array(network.get_node(link.start_node_name).coordinates)
            end_coord = np.array(network.get_node(link.end_node_name).coordinates)
            mid_coord = (start_coord + end_coord) / 2
            true_coords.append((pipe_id, mid_coord))
            
    distances = []
    for node, start_time in detected_leaks.items():
        pred_coord = detector_obj.triangulate(start_time, computed_df_cs, network, detector_obj.pressures, w_gnn=0.5, w_ent=2.0)
        if pred_coord is None:
            continue
            
        # Find minimum distance to any known ground truth leak
        min_dist = float('inf')
        for pipe_id, true_coord in true_coords:
            dist = euclidean(pred_coord, true_coord)
            if dist < min_dist:
                min_dist = dist
        
        distances.append(min_dist)
        
    if distances:
        return np.mean(distances)
    return None

if __name__ == "__main__":
    _ROOT = Path(__file__).resolve().parents[2]
    DATA_DIR = str(_ROOT / 'data' / 'SCADA_data' / '2019')
    EPANET_FILE = str(_ROOT / 'data' / 'L-TOWN.inp')
    GROUND_TRUTH_FILE = str(_ROOT / 'data' / 'leak_ground_truth' / '2019_Leakages.csv')
    
    pipeline = LILA_Pipeline(data_dir=DATA_DIR, epanet_file=EPANET_FILE)
    detected_leaks, computed_df_cs, detector = pipeline.run()
    
    print("\n--- Final Pipeline Results ---")
    dist = evaluate_accuracy(detected_leaks, computed_df_cs, detector, pipeline.network, GROUND_TRUTH_FILE, w_gnn=0.5, w_ent=2.0)
    if dist:
        print(f"Final Minimized Localization Error: {dist:.2f} meters")
