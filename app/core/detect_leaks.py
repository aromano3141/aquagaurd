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
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from torch_geometric.data import Data
from torch_geometric.loader import DataLoader
from torch_geometric.nn import GATv2Conv

from tqdm import tqdm
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
        self.edge_attr = None
        
        # Device detection
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"LeakDetector initialized using device: {self.device}")

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
        
        # Extract edge features: Length, Diameter, Roughness
        # Assuming the CSV has these columns. If not, we fall back to None.
        if 'Length' in edges_df.columns and 'Diameter' in edges_df.columns and 'Roughness' in edges_df.columns:
            feats = edges_df[['Length', 'Diameter', 'Roughness']].values
            # Scale features
            scaler = StandardScaler()
            feats_scaled = scaler.fit_transform(feats)
            
            # Duplicate for reversed edges
            edge_attr = np.vstack([feats_scaled, feats_scaled])
            return torch.tensor(edge_index, dtype=torch.long), torch.tensor(edge_attr, dtype=torch.float32)
        else:
            return torch.tensor(edge_index, dtype=torch.long), None

    def _extract_gnn_features(self, df):
        # Extract raw sequences for the LSTM layer
        # df shape: (T, N)
        window_size = 120
        stride = 10
        
        # We need a tensor of shape (T, N)
        tensor_data = torch.tensor(df.values, dtype=torch.float32)
        # Unfold to get windows: (num_windows, N, window_size)
        windows = tensor_data.unfold(0, window_size, stride).float()
        
        # Transpose to (num_windows, N, window_size) - already in this shape
        # Return raw window features instead of min/max aggregation
        # LSTM needs sequence length, so we keep window_size
        return windows
        
    def train_gnn(self, cor_time_frame):
        print("Training GNN AnomalyLeakDetector on calibration period...")
        df_cal = self.pressures.loc[cor_time_frame[0]:cor_time_frame[1]]
        
        edge_data = self._load_edge_index()
        if edge_data is None:
            print("Warning: GNN edge_index not found. Skipping GNN.")
            return
            
        self.edge_index, self.edge_attr = edge_data
        edge_dim = self.edge_attr.shape[1] if self.edge_attr is not None else None

        features = self._extract_gnn_features(df_cal) # (W, N, 4)
        num_windows, num_nodes, num_feats = features.shape
        
        # Standardize features
        features_flat = einops.rearrange(features, 'w n f -> (w n) f')
        self.gnn_scaler = StandardScaler()
        features_scaled = torch.tensor(self.gnn_scaler.fit_transform(features_flat.numpy()), dtype=torch.float32)
        features_scaled = einops.rearrange(features_scaled, '(w n) f -> w n f', n=num_nodes)
        
        # Train/Val Split (80/20)
        split_idx = int(0.8 * num_windows)
        
        train_data_list = [
            Data(x=features_scaled[i], edge_index=self.edge_index, edge_attr=self.edge_attr, y=features_scaled[i])
            for i in range(split_idx)
        ]
        val_data_list = [
            Data(x=features_scaled[i], edge_index=self.edge_index, edge_attr=self.edge_attr, y=features_scaled[i])
            for i in range(split_idx, num_windows)
        ]
        
        train_loader = DataLoader(train_data_list, batch_size=256, shuffle=True)
        val_loader = DataLoader(val_data_list, batch_size=256, shuffle=False)
        
        # Initialize model with LSTM
        self.gnn_model = AnomalyLeakDetector(
            node_in=num_feats, 
            hid_dim=32, 
            num_layers=4, 
            edge_in=edge_dim, 
            gnn_layer=GATv2Conv,
            lstm_layers=1,
            window_size=num_feats
        ).to(self.device)
        optimizer = torch.optim.AdamW(self.gnn_model.parameters(), lr=0.01, weight_decay=1e-4)
        
        epochs = 30
        best_val_loss = float('inf')
        patience = 5
        patience_counter = 0
        
        for epoch in range(epochs):
            self.gnn_model.train()
            train_loss = 0
            for data in train_loader:
                data = data.to(self.device)
                optimizer.zero_grad()
                out = self.gnn_model(data)
                loss = F.mse_loss(out, data.y)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.gnn_model.parameters(), 1.0)
                optimizer.step()
                train_loss += loss.item()
                
            self.gnn_model.eval()
            val_loss = 0
            with torch.no_grad():
                for data in val_loader:
                    data = data.to(self.device)
                    out = self.gnn_model(data)
                    val_loss += F.mse_loss(out, data.y).item()
                    
            val_loss /= len(val_loader)
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"Early stopping at epoch {epoch}. Best Val Loss: {best_val_loss:.4f}")
                    break
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
        
        # Store models since we cannot extract linear coefficients
        # models[(i, j)] = trained RandomForestRegressor
        models = {}

        print("Fitting regression models with Flow-to-Pressure ratio feature...")

        for i, node in tqdm(enumerate(self.nodes), total=N, desc="Fitting RF Models"):
            # Target variable: Specific node's pressure
            y_tr = self.pressures[node].loc[cor_time_frame[0]:cor_time_frame[1]].values.reshape(-1, 1)

            # Iterating through a subset of reference nodes to save time with RFs.
            # E.g., just taking the previous, next, and one other node in the list.
            ref_indices = [(i-1)%N, (i+1)%N, (i+N//2)%N]
            
            # Using a sub-progress bar for reference sensors if needed, 
            # but wrapping the main outer loop is better for visibility.
            for j in ref_indices:
                if i == j:
                    continue # Ignore self
                
                node_cor = self.nodes[j]

                # Feature 1: Reference Node Pressure
                p_ref = self.pressures[node_cor].loc[cor_time_frame[0]:cor_time_frame[1]].values.reshape(-1, 1)
                
                # Feature 2: Flow source
                v_tr = self.flows['PUMP_1'].loc[cor_time_frame[0]:cor_time_frame[1]].values.reshape(-1, 1)
                
                # ENGINEERED FEATURE: Flow-to-Pressure ratio (Demand vs Leak differentiator)
                # Adds non-linearity. A hydrant open event shows a massive localized drop relative to systemic flow.
                # Adding 1e-6 to avoid division by zero.
                ratio_tr = v_tr / (p_ref + 1e-6)

                X_tr = np.concatenate([p_ref, v_tr, ratio_tr], axis=1)

                model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)
                model.fit(X_tr, y_tr.ravel())

                # Save the trained model
                models[(i, j)] = model

        # Calculate error across all T
        print("Calculating residuals with batched inference...")
        
        # Precompute features for all t
        # P is (N, T), ratio is (N, T)
        ratio = V / (P + 1e-6)
        
        P_pred_full = np.zeros((N, N, T))
        # Default prediction for any node i using reference j is just P[i, t] (zero error)
        # This covers self-prediction and any j that isn't in our sampled subset.
        for i in range(N):
            P_pred_full[i, :, :] = P[i, :]

        # Batch prediction over all models
        for (i, j), m in tqdm(models.items(), desc="RF Analysis Batch Predict"):
            # Features for all t for this specific (i, j) model
            # ref_pressure: P[j, :] (T,), source_flow: V (T,), ratio: ratio[j, :] (T,)
            X_all = np.stack([P[j, :], V, ratio[j, :]], axis=1) # (T, 3)
            P_pred_full[i, j, :] = m.predict(X_all) # (T,)

        # Vectorized Error calculation
        # E[i, j, t] = P[i, t] - P_pred_full[i, j, t]
        # P[:, np.newaxis, :] is (N, 1, T)
        E = P[:, np.newaxis, :] - P_pred_full
        E[E < 0] = 0
        E = np.clip(E, 0, 1)

        # Sum of errors for a given Target Node 'i' across all references 'j'
        node_error_sums = np.sum(E, axis=1) # (N, T)
        
        # Find the node that is deviating the most overall for each timestamp
        i_max_per_t = np.argmax(node_error_sums, axis=0) # (T,)

        res = np.zeros((N, T))
        for t in range(T):
            im = i_max_per_t[t]
            # Record the norm of the error vector for the worst node at time t
            res[im, t] = np.linalg.norm(E[im, :, t])

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
        Uses Min-Max scaling to ensure fair weighting between metrics.
        """
        cusum_at_t = df_cs.loc[timestamp]
        top_sensors = cusum_at_t.nlargest(3)
        total_error = top_sensors.sum()
        
        if total_error == 0:
            return None
            
        gnn_node_errors = None
        if self.gnn_model is not None and self.gnn_scaler is not None:
            window_start = timestamp - pd.Timedelta('20 hours')
            df_window = pressures_df.loc[window_start:timestamp]
            if len(df_window) >= 120:
                features = self._extract_gnn_features(df_window.tail(120))
                if features.shape[0] == 1:
                    num_nodes = features.shape[1]
                    f_flat = einops.rearrange(features, 'w n f -> (w n) f')
                    f_scaled = torch.tensor(self.gnn_scaler.transform(f_flat.numpy()), dtype=torch.float32)
                    f_scaled = einops.rearrange(f_scaled, '(w n) f -> w n f', n=num_nodes)
                    
                    data = Data(x=f_scaled[0], edge_index=self.edge_index, edge_attr=self.edge_attr, y=f_scaled[0])
                    data = data.to(self.device)
                    self.gnn_model.eval()
                    with torch.no_grad():
                        recon = self.gnn_model(data)
                        # Mean over the sequence window (dim=1 in reconstructed [N, W])
                        gnn_node_errors = torch.mean(torch.abs(data.y - recon), dim=1).cpu().numpy()

        coords = []
        node_names = []
        
        # Collect raw components
        raw_cusums = []
        raw_gnns = []
        raw_ents = []
        
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
                    
                    combined_ent = f_ent * (p_ent + 1e-3)
                else:
                    combined_ent = 0
                
                coords.append(node_obj.coordinates)
                node_names.append(node)
                
                raw_cusums.append(error_val)
                raw_gnns.append(node_gnn_error)
                raw_ents.append(combined_ent)
                
        if not coords:
            return None, None, None, None
            
        def minmax_scale(arr):
            arr = np.array(arr)
            ptp = np.ptp(arr)
            if ptp == 0:
                return np.ones_like(arr) / len(arr) if len(arr) > 0 else arr
            return (arr - np.min(arr)) / ptp
            
        scaled_cusums = minmax_scale(raw_cusums)
        scaled_gnns = minmax_scale(raw_gnns)
        scaled_ents = minmax_scale(raw_ents)
        
        weights = scaled_cusums + (w_gnn * scaled_gnns) + (w_ent * scaled_ents)
            
        weights = np.array(weights)
        if np.sum(weights) == 0:
            weights = np.ones_like(weights)
        weights = weights / np.sum(weights)
        
        coords = np.array(coords)
        predicted_coord = np.sum(coords * weights[:, np.newaxis], axis=0)

        return tuple(predicted_coord), coords.tolist(), weights.tolist(), node_names

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
        res = detector_obj.triangulate(start_time, computed_df_cs, network, detector_obj.pressures, w_gnn=0.5, w_ent=2.0)
        if res[0] is None:
            continue
        pred_coord = res[0]
            
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
