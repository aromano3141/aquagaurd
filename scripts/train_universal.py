"""
Training script for the universal zone-level leak detection model.
Generates synthetic data from .inp files, trains GraphSAGE, saves checkpoint.

Usage:
    uv run python scripts/train_universal.py
"""

import os
import sys
import time

import torch
import torch.nn.functional as F
from torch_geometric.loader import DataLoader

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.data_generator import generate_full_dataset
from app.core.zone_model import ZoneLeakDetector


def train():
    print("=" * 60)
    print("🌊 AquaGuard Universal Model Training")
    print("=" * 60)

    # ── Step 1: Generate or load data ──
    data_path = "data/models/training_data.pt"
    if os.path.exists(data_path):
        print(f"\n📂 Loading cached training data from {data_path}...")
        dataset = torch.load(data_path, weights_only=False)
        print(f"   Loaded {len(dataset)} samples")
    else:
        print("\n🔬 Generating synthetic training data...")
        dataset = generate_full_dataset(
            inp_dir="data/sample_networks",
            n_scenarios_per_network=30,
            zone_radius=2,
            save_path=data_path,
        )

    if len(dataset) < 5:
        print("❌ Not enough training data. Need at least 5 samples.")
        return

    # ── Step 2: Train/val split ──
    n_train = int(len(dataset) * 0.8)
    train_data = dataset[:n_train]
    val_data = dataset[n_train:]

    print(f"\n📊 Split: {len(train_data)} train / {len(val_data)} val")

    train_loader = DataLoader(train_data, batch_size=8, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=8)

    # ── Step 3: Model setup ──
    in_channels = dataset[0].x.shape[1]
    model = ZoneLeakDetector(in_channels=in_channels, hidden_channels=64, dropout=0.3)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)

    print(f"\n🧠 Model: ZoneLeakDetector (in={in_channels}, hidden=64)")
    print(f"   Parameters: {sum(p.numel() for p in model.parameters()):,}")

    # ── Step 4: Training loop ──
    best_val_acc = -1.0
    model_path = "data/models/universal_zone_model.pt"
    os.makedirs("data/models", exist_ok=True)

    print(f"\n🏋️ Training for 80 epochs...\n")
    start_time = time.time()

    for epoch in range(1, 81):
        # Train
        model.train()
        total_loss = 0
        for batch in train_loader:
            optimizer.zero_grad()

            logits = model(batch)
            labels = batch.y

            # Class-weighted BCE (leak zones are rare)
            pos_weight = torch.tensor([(labels == 0).sum() / max((labels == 1).sum(), 1)])
            loss = F.binary_cross_entropy_with_logits(logits, labels, pos_weight=pos_weight)

            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(train_loader)

        # Validate
        if epoch % 5 == 0 or epoch == 1:
            model.eval()
            correct = 0
            total = 0
            zone_correct = 0
            zone_total = 0

            with torch.no_grad():
                for batch in val_loader:
                    probs = torch.sigmoid(model(batch))
                    preds = (probs > 0.5).float()
                    labels = batch.y

                    correct += (preds == labels).sum().item()
                    total += labels.numel()

                    # Zone accuracy: of nodes labeled as leak zone, how many did we catch?
                    zone_mask = labels == 1
                    if zone_mask.sum() > 0:
                        zone_correct += (preds[zone_mask] == 1).sum().item()
                        zone_total += zone_mask.sum().item()

            overall_acc = correct / total * 100
            zone_acc = (zone_correct / zone_total * 100) if zone_total > 0 else 0

            elapsed = time.time() - start_time
            print(f"  Epoch {epoch:3d} | Loss: {avg_loss:.4f} | Acc: {overall_acc:.1f}% | Zone Acc: {zone_acc:.1f}% | {elapsed:.0f}s")

            if zone_acc > best_val_acc:
                best_val_acc = zone_acc
                torch.save({
                    'model_state_dict': model.state_dict(),
                    'in_channels': in_channels,
                    'hidden_channels': 64,
                    'best_zone_accuracy': best_val_acc,
                }, model_path)

    elapsed = time.time() - start_time
    print(f"\n✅ Training complete in {elapsed:.0f}s")
    print(f"🏆 Best zone accuracy: {best_val_acc:.1f}%")
    print(f"💾 Model saved to {model_path}")


if __name__ == "__main__":
    train()
