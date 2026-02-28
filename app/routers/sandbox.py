"""City sandbox API endpoints."""

from fastapi import APIRouter, Query
from pydantic import BaseModel
import numpy as np

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


@router.get("/generate")
async def generate_network(
    rows: int = Query(6, ge=3, le=15),
    cols: int = Query(8, ge=3, le=15),
    sensors: int = Query(5, ge=2, le=20),
    density: float = Query(0.3, ge=0.0, le=1.0),
):
    """Procedurally generate a grid-based water network."""
    rng = np.random.RandomState(rows * 100 + cols * 10 + sensors)
    spacing = 100.0

    nodes = []
    node_ids = []
    for r in range(rows):
        for c in range(cols):
            nid = f"J-{r}-{c}"
            jx = rng.uniform(-spacing * 0.15, spacing * 0.15)
            jy = rng.uniform(-spacing * 0.15, spacing * 0.15)
            nodes.append({
                "id": nid,
                "x": float(c * spacing + jx),
                "y": float(r * spacing + jy),
            })
            node_ids.append(nid)

    pipes = []
    pid_counter = 0
    for r in range(rows):
        for c in range(cols):
            nid = f"J-{r}-{c}"
            if c + 1 < cols:
                pipes.append({"id": f"P-{pid_counter}", "start": nid, "end": f"J-{r}-{c+1}"})
                pid_counter += 1
            if r + 1 < rows:
                pipes.append({"id": f"P-{pid_counter}", "start": nid, "end": f"J-{r+1}-{c}"})
                pid_counter += 1
            if r + 1 < rows and c + 1 < cols and rng.random() < density:
                pipes.append({"id": f"P-{pid_counter}", "start": nid, "end": f"J-{r+1}-{c+1}"})
                pid_counter += 1

    sensor_indices = rng.choice(len(node_ids), size=min(sensors, len(node_ids)), replace=False)
    sensor_list = [node_ids[i] for i in sensor_indices]

    return {"nodes": nodes, "pipes": pipes, "sensors": sensor_list}


class SimulateRequest(BaseModel):
    leak_pipes: list[str]
    rows: int = 6
    cols: int = 8
    sensors: int = 5
    density: float = 0.3


@router.post("/simulate")
async def simulate(req: SimulateRequest):
    """Simulate leak detection on a generated network."""
    # Regenerate the same network
    gen = await generate_network(req.rows, req.cols, req.sensors, req.density)
    node_map = {n["id"]: np.array([n["x"], n["y"]]) for n in gen["nodes"]}
    pipe_map = {p["id"]: p for p in gen["pipes"]}
    sensor_coords = {s: node_map[s] for s in gen["sensors"]}

    rng = np.random.RandomState(42)

    predictions = []
    errors = []

    for lpid in req.leak_pipes:
        if lpid not in pipe_map:
            continue
        pipe = pipe_map[lpid]
        true_coord = (node_map[pipe["start"]] + node_map[pipe["end"]]) / 2

        weights = []
        coords_list = []
        for sn, sc in sensor_coords.items():
            dist = np.linalg.norm(true_coord - sc) + 1e-6
            noise_scale = dist * 0.05
            noisy_sc = sc + rng.normal(0, noise_scale, size=2)
            w = 1.0 / (dist ** 2)
            weights.append(w)
            coords_list.append(noisy_sc)

        top_idx = np.argsort(weights)[-3:]
        top_w = np.array([weights[i] for i in top_idx])
        top_c = np.array([coords_list[i] for i in top_idx])
        top_w_norm = top_w / top_w.sum()
        pred_coord = np.sum(top_c * top_w_norm[:, None], axis=0)

        err = float(np.linalg.norm(pred_coord - true_coord))
        errors.append(err)
        predictions.append({
            "pipe": lpid,
            "true_x": float(true_coord[0]),
            "true_y": float(true_coord[1]),
            "pred_x": float(pred_coord[0]),
            "pred_y": float(pred_coord[1]),
            "error": round(err, 2),
            "rating": "excellent" if err < 30 else ("good" if err < 80 else "fair"),
        })

    mean_error = float(np.mean(errors)) if errors else 0
    max_error = float(np.max(errors)) if errors else 0
    accuracy = (sum(1 for e in errors if e < 50) / len(errors) * 100) if errors else 0

    return {
        "predictions": predictions,
        "mean_error": round(mean_error, 1),
        "max_error": round(max_error, 1),
        "accuracy_pct": round(accuracy, 0),
    }
