"""City sandbox API endpoints."""

import os
from pathlib import Path
from fastapi import APIRouter, Query, UploadFile, File, HTTPException
from pydantic import BaseModel
import numpy as np

from app.core.zone_inference import detect_zones

import wntr

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])


@router.get("/generate")
async def generate_network(
    rows: int = Query(6, ge=3, le=15),
    cols: int = Query(8, ge=3, le=15),
    sensors: int = Query(5, ge=2, le=50),
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


SAMPLE_INP_FILES = ['Net1.inp', 'Net2.inp', 'Net3.inp', 'Anytown.inp', 'Net6.inp']


@router.get("/sample-networks")
async def list_sample_networks():
    """List available sample .inp files."""
    return {"networks": SAMPLE_INP_FILES}


@router.get("/load-inp")
async def load_inp_network(
    filename: str = Query(...),
    sensors: int = Query(8, ge=2, le=50),
):
    """Parse a .inp file and return {nodes, pipes, sensors} in the same format as generate_network."""
    file_path = Path("data/uploaded_networks") / filename
    if not file_path.exists():
        file_path = Path("data/sample_networks") / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {filename}")

    try:
        wn = wntr.network.WaterNetworkModel(str(file_path))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse .inp file: {e}")

    # Extract ALL nodes (junctions, tanks, reservoirs)
    nodes = []
    node_ids = []
    for name in wn.node_name_list:
        node = wn.get_node(name)
        coords = node.coordinates
        nodes.append({"id": name, "x": float(coords[0]), "y": float(coords[1])})
        node_ids.append(name)

    # Extract pipes
    pipes = []
    for name in wn.pipe_name_list:
        link = wn.get_link(name)
        pipes.append({"id": name, "start": link.start_node_name, "end": link.end_node_name})

    # Randomly select sensors from junctions
    rng = np.random.RandomState(len(nodes))
    n_sensors = min(sensors, len(node_ids))
    sensor_indices = rng.choice(len(node_ids), size=n_sensors, replace=False)
    sensor_list = [node_ids[i] for i in sensor_indices]

    return {"nodes": nodes, "pipes": pipes, "sensors": sensor_list}


class SimulateRequest(BaseModel):
    leak_pipes: list[str]
    rows: int = 6
    cols: int = 8
    sensors: int = 5
    density: float = 0.3
    filename: str | None = None  # Optional: if set, load network from .inp file


@router.post("/simulate")
async def simulate(req: SimulateRequest):
    """Simulate leak detection on a generated or real network."""
    rng = np.random.RandomState(42)
    predictions = []
    errors = []

    if req.filename:
        # ── REAL NETWORK: PHYSICS-BASED SIMULATION ──
        file_path = Path("data/uploaded_networks") / req.filename
        if not file_path.exists():
            file_path = Path("data/sample_networks") / req.filename
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"Network file not found: {req.filename}")

        # Need the node/pipe data for coordinates
        gen = await load_inp_network(req.filename, req.sensors)
        node_map = {n["id"]: np.array([n["x"], n["y"]]) for n in gen["nodes"]}
        pipe_map = {p["id"]: p for p in gen["pipes"]}
        sensor_list = gen["sensors"]

        # Run Baseline Simulation
        wn_base = wntr.network.WaterNetworkModel(str(file_path))
        sim_base = wntr.sim.EpanetSimulator(wn_base)
        results_base = sim_base.run_sim()
        base_pressures = results_base.node["pressure"].iloc[-1]

        for lpid in req.leak_pipes:
            if lpid not in pipe_map:
                continue
            pipe = pipe_map[lpid]
            true_coord = (node_map[pipe["start"]] + node_map[pipe["end"]]) / 2

            # Run Leak Simulation
            wn_leak = wntr.network.WaterNetworkModel(str(file_path))
            leak_node = wn_leak.get_node(pipe["start"])
            
            # Inject leak: area = pi * r^2. Let's say a 1.5 cm radius hole.
            leak_area = np.pi * (0.015) ** 2
            leak_node.emitter_coefficient = 0.75 * leak_area * np.sqrt(2 * 9.81)

            sim_leak = wntr.sim.EpanetSimulator(wn_leak)
            try:
                results_leak = sim_leak.run_sim()
                leak_pressures = results_leak.node["pressure"].iloc[-1]
            except Exception:
                continue # Skip if simulation fails
            
            # Calculate absolute pressure residuals at sensors
            sensor_residuals = {}
            for s in sensor_list:
                if s in base_pressures and s in leak_pressures:
                    residual = abs(base_pressures[s] - leak_pressures[s])
                    # Add tiny noise to avoid perfect ties
                    residual += rng.uniform(0, 0.001)
                    sensor_residuals[s] = residual

            if not sensor_residuals:
                continue

            # Sort sensors by highest pressure drop (most likely near leak)
            sorted_sensors = sorted(sensor_residuals.items(), key=lambda x: x[1], reverse=True)
            top_k = min(5, len(sorted_sensors))
            top_sensors = sorted_sensors[:top_k]
            
            top_w = np.array([float(s[1]) for s in top_sensors]) + 1e-6 # Weights = pressure drop
            top_nodes = [s[0] for s in top_sensors]
            top_c = np.array([node_map[n] for n in top_nodes])
            
            top_w_norm = top_w / top_w.sum()
            pred_coord = np.sum(top_c * top_w_norm[:, None], axis=0)

            err = float(np.linalg.norm(pred_coord - true_coord))
            errors.append(err)

            heatmap = []
            for i in range(len(top_nodes)):
                heatmap.append({
                    "x": float(top_c[i][0]),
                    "y": float(top_c[i][1]),
                    "weight": float(top_w_norm[i]),
                    "node": top_nodes[i]
                })

            gallons_lost = int(rng.uniform(1000, 5000))
            cost_per_hour = round(gallons_lost * rng.uniform(0.01, 0.05), 2)

            predictions.append({
                "pipe": lpid,
                "true_x": float(true_coord[0]),
                "true_y": float(true_coord[1]),
                "pred_x": float(pred_coord[0]),
                "pred_y": float(pred_coord[1]),
                "error": round(err, 2),
                "rating": "excellent" if err < 50 else ("good" if err < 150 else "poor"),
                "heatmap": heatmap,
                "work_order": {
                    "dispatch_target": top_nodes[0],
                    "gallons_lost_per_hour": gallons_lost,
                    "cost_per_hour": cost_per_hour,
                    "confidence_score": round(float(top_w_norm[0]) * 100, 1)
                }
            })

    else:
        # ── PROCEDURAL GRID: GEOMETRIC SIMULATION ──
        gen = await generate_network(req.rows, req.cols, req.sensors, req.density)
        node_map = {n["id"]: np.array([n["x"], n["y"]]) for n in gen["nodes"]}
        pipe_map = {p["id"]: p for p in gen["pipes"]}
        sensor_coords = {s: node_map[s] for s in gen["sensors"]}

        for lpid in req.leak_pipes:
            if lpid not in pipe_map:
                continue
            pipe = pipe_map[lpid]
            true_coord = (node_map[pipe["start"]] + node_map[pipe["end"]]) / 2

            weights = []
            coords_list = []
            node_names = []
            for sn, sc in sensor_coords.items():
                dist = np.linalg.norm(true_coord - sc) + 1e-6
                noise_scale = dist * 0.05
                noisy_sc = sc + rng.normal(0, noise_scale, size=2)
                w = 1.0 / (dist ** 2)
                weights.append(w)
                coords_list.append(noisy_sc)
                node_names.append(sn)

            top_idx = np.argsort(weights)[-5:]
            top_w = np.array([weights[i] for i in top_idx])
            top_c = np.array([coords_list[i] for i in top_idx])
            top_nodes = [node_names[i] for i in top_idx]

            top_w_norm = top_w / top_w.sum()
            pred_coord = np.sum(top_c * top_w_norm[:, None], axis=0)

            err = float(np.linalg.norm(pred_coord - true_coord))
            errors.append(err)

            heatmap = []
            for i in range(len(top_idx)):
                heatmap.append({
                    "x": float(top_c[i][0]),
                    "y": float(top_c[i][1]),
                    "weight": float(top_w_norm[i]),
                    "node": top_nodes[i]
                })

            gallons_lost = int(rng.uniform(500, 3000))
            cost_per_hour = round(gallons_lost * rng.uniform(0.01, 0.05), 2)

            predictions.append({
                "pipe": lpid,
                "true_x": float(true_coord[0]),
                "true_y": float(true_coord[1]),
                "pred_x": float(pred_coord[0]),
                "pred_y": float(pred_coord[1]),
                "error": round(err, 2),
                "rating": "excellent" if err < 30 else ("good" if err < 80 else "poor"),
                "heatmap": heatmap,
                "work_order": {
                    "dispatch_target": top_nodes[-1],
                    "gallons_lost_per_hour": gallons_lost,
                    "cost_per_hour": cost_per_hour,
                    "confidence_score": round(float(top_w_norm[-1]) * 100, 1)
                }
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


@router.post("/upload-network")
async def upload_network(file: UploadFile = File(...)):
    """Upload a custom .inp water network file."""
    if not file.filename.endswith(".inp"):
        raise HTTPException(status_code=400, detail="Only .inp files are supported")
        
    upload_dir = Path("data/uploaded_networks")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    return {"filename": file.filename, "status": "success"}


@router.post("/detect-zones")
async def run_zone_detection(filename: str):
    """Run the universal zone-level leak detection model on an uploaded network."""
    file_path = Path("data/uploaded_networks") / filename
    if not file_path.exists():
        # Fallback to sample networks
        file_path = Path("data/sample_networks") / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")
            
    try:
        results = detect_zones(str(file_path), top_k_zones=10)
        
        # Add work order info to the top zone for the UI
        top_zone = results["zones"][0] if results["zones"] else None
        if top_zone:
            gallons_lost = int(top_zone["probability"] * 1000 + 500)
            cost_per_hour = round(gallons_lost * 0.03, 2)
            results["work_order"] = {
                "dispatch_target": top_zone["id"],
                "gallons_lost_per_hour": gallons_lost,
                "cost_per_hour": cost_per_hour,
                "confidence_score": round(top_zone["probability"] * 100, 1)
            }
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
