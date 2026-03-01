"""
Zone-level leak detection model using GraphSAGE.
Topology-agnostic: works on any water network graph.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv, global_mean_pool


class ZoneLeakDetector(nn.Module):
    """
    GraphSAGE-based model for zone-level leak detection.
    
    Input: Per-node features (8 dims: baseline + residual pressures/flows)
    Output: Per-node probability of being in a leak zone (sigmoid)
    """

    def __init__(self, in_channels=8, hidden_channels=64, out_channels=1, dropout=0.3):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, hidden_channels)
        self.conv3 = SAGEConv(hidden_channels, hidden_channels // 2)
        self.head = nn.Linear(hidden_channels // 2, out_channels)
        self.dropout = dropout

    def forward(self, data):
        x, edge_index = data.x, data.edge_index

        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)

        x = self.conv2(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=self.dropout, training=self.training)

        x = self.conv3(x, edge_index)
        x = F.relu(x)

        x = self.head(x)
        return x.squeeze(-1)  # [num_nodes] logits

    def predict_proba(self, data):
        """Return per-node probabilities (0-1)."""
        self.eval()
        with torch.no_grad():
            logits = self.forward(data)
            return torch.sigmoid(logits)
