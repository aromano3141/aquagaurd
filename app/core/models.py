"""
GNN Models for AquaGuard Leak Detection.

Extracted from the GNNLeakDetection module — only the components
actually used by the detection pipeline (AnomalyLeakDetector + FirstLayer).
"""

import torch
import torch.nn as nn
from torch_geometric.nn import GATv2Conv, BatchNorm


class FirstLayer(nn.Module):
    """First encoder layer supporting either LSTM or GNN input processing."""

    def __init__(self, node_in, window_size, hidden_size, lstm_layers=None, edge_in=None, gnn_layer=GATv2Conv):
        super(FirstLayer, self).__init__()

        self.window_size = window_size
        self.lstm_layers = lstm_layers
        if lstm_layers is not None:
            self.layer = nn.LSTM(
                input_size=node_in // window_size,
                hidden_size=hidden_size * 4,
                num_layers=lstm_layers,
                batch_first=True,
            )
        else:
            self.layer = gnn_layer(node_in, hidden_size, heads=4, edge_dim=edge_in)

    def forward(self, x, edge_index, edge_attr):
        if self.lstm_layers is not None:
            x = x.view(x.shape[0], self.window_size, -1)
            out = self.layer(x)
            lstm_out, (h_n, c_n) = out
            out = h_n[-1, :, :]
        else:
            out = self.layer(x, edge_index, edge_attr)
        return out


class AnomalyLeakDetector(torch.nn.Module):
    """
    Graph Autoencoder for anomaly-based leak detection.

    Encodes node features via GATv2Conv layers and reconstructs them.
    High reconstruction error indicates anomalous (leaking) nodes.
    """

    def __init__(
        self,
        node_in,
        hid_dim=None,
        num_layers=4,
        hidden_dims=None,
        edge_in=None,
        decoder_dims=None,
        lstm_layers=None,
        window_size=None,
        gnn_layer=GATv2Conv,
        **kwargs,
    ):
        super().__init__()
        self.edge_in = edge_in

        if hid_dim is not None and hidden_dims is not None:
            raise ValueError("Cannot specify both hid_dim and hidden_dims")

        if hidden_dims is None:
            hidden_dims = [hid_dim] * num_layers

        decoder_dims = decoder_dims or hidden_dims[::-1]

        # Encoder
        self.encoder = torch.nn.ModuleList()
        self.encoder.append(
            FirstLayer(
                node_in=node_in,
                hidden_size=hidden_dims[0],
                edge_in=edge_in,
                window_size=window_size,
                lstm_layers=lstm_layers,
            )
        )
        self.encoder.append(BatchNorm(hidden_dims[0] * 4))

        for i in range(1, len(hidden_dims)):
            self.encoder.append(gnn_layer(hidden_dims[i - 1] * 4, hidden_dims[i], heads=4, edge_dim=edge_in))
            self.encoder.append(BatchNorm(hidden_dims[i] * 4))

        self.encoder.append(gnn_layer(hidden_dims[-1] * 4, hidden_dims[-1], heads=1, edge_dim=edge_in))

        # Decoder
        self.decoder = torch.nn.ModuleList()
        for i in range(len(decoder_dims[:-1])):
            self.decoder.append(gnn_layer(decoder_dims[i], decoder_dims[i + 1], edge_dim=edge_in))
            self.decoder.append(BatchNorm(decoder_dims[i + 1]))

        self.decoder.append(gnn_layer(decoder_dims[-1], node_in, edge_dim=edge_in))

        self.dropout = torch.nn.Dropout(0.2)

    def forward(self, data):
        x, edge_index, batch = data.x, data.edge_index, data.batch
        edge_attr = data.edge_attr if self.edge_in else None

        for layer in self.encoder:
            if isinstance(layer, BatchNorm):
                x = layer(x)
            else:
                x = layer(x, edge_index, edge_attr)
                x = torch.relu(x)
                x = self.dropout(x)

        x_recon = x
        for i, layer in enumerate(self.decoder[:-1]):
            if isinstance(layer, BatchNorm):
                x_recon = layer(x_recon)
            else:
                x_recon = torch.relu(layer(x_recon, edge_index, edge_attr))

        return self.decoder[-1](x_recon, edge_index, edge_attr)
