"""
Data Pipeline

Handles loading and parsing EPANET .inp files, running hydraulic simulations
via WNTR, and generating synthetic leak scenarios for GNN training.
Extracts both pressure and flow data from simulations.
"""

import wntr
import numpy as np
import pandas as pd
from pathlib import Path


def load_network(inp_path: str) -> wntr.network.WaterNetworkModel:
    """Load an EPANET .inp file into a WNTR WaterNetworkModel."""
    return wntr.network.WaterNetworkModel(inp_path)


def extract_topology(wn: wntr.network.WaterNetworkModel) -> dict:
    """
    Extract the graph topology from a WNTR network model.

    Returns:
        Dictionary with:
        - junction_names: list of junction IDs
        - junction_coords: dict mapping junction ID to (x, y)
        - junction_elevations: dict mapping junction ID to elevation
        - pipe_list: list of (start_node, end_node, pipe_name) tuples
        - pipe_properties: dict mapping pipe name to {length, diameter, roughness}
    """
    junction_names = wn.junction_name_list
    junction_coords = {}
    junction_elevations = {}

    for name in junction_names:
        node = wn.get_node(name)
        junction_coords[name] = node.coordinates
        junction_elevations[name] = node.elevation

    pipe_list = []
    pipe_properties = {}
    for name, pipe in wn.pipes():
        pipe_list.append((pipe.start_node_name, pipe.end_node_name, name))
        pipe_properties[name] = {
            "length": pipe.length,
            "diameter": pipe.diameter,
            "roughness": pipe.roughness,
        }

    return {
        "junction_names": junction_names,
        "junction_coords": junction_coords,
        "junction_elevations": junction_elevations,
        "pipe_list": pipe_list,
        "pipe_properties": pipe_properties,
    }


def run_hydraulic_simulation(
    wn: wntr.network.WaterNetworkModel,
    duration_hours: int = 336,
    timestep_minutes: int = 5,
) -> dict:
    """
    Run a hydraulic simulation and return pressure + flow time-series.

    Args:
        wn: The WNTR network model.
        duration_hours: Simulation duration in hours (default: 14 days).
        timestep_minutes: Reporting timestep in minutes.

    Returns:
        Dictionary with:
        - pressures: DataFrame (time x junctions) of pressure values
        - flows: DataFrame (time x pipes) of flowrate values
        - demands: DataFrame (time x junctions) of demand values
        - head: DataFrame (time x junctions) of head values
        - velocity: DataFrame (time x pipes) of velocity values
    """
    wn.options.time.duration = duration_hours * 3600
    wn.options.time.hydraulic_timestep = timestep_minutes * 60
    wn.options.time.report_timestep = timestep_minutes * 60

    sim = wntr.sim.EpanetSimulator(wn)
    results = sim.run_sim()

    junction_names = wn.junction_name_list
    pipe_names = wn.pipe_name_list

    return {
        "pressures": results.node["pressure"][junction_names],
        "demands": results.node["demand"][junction_names],
        "head": results.node["head"][junction_names],
        "flows": results.link["flowrate"][pipe_names],
        "velocity": results.link["velocity"][pipe_names],
    }


def compute_flow_pressure_ratio(sim_results: dict) -> pd.DataFrame:
    """
    Compute flow-to-pressure ratio at each junction by averaging
    the absolute flow of adjacent pipes and dividing by pressure.
    A deviation from baseline ratio indicates a potential leak.

    Args:
        sim_results: Output from run_hydraulic_simulation.

    Returns:
        DataFrame of flow-pressure ratios (time x junctions).
    """
    pressures = sim_results["pressures"]
    flows = sim_results["flows"]

    # Use mean absolute flow as a proxy for junction-level flow
    mean_flow = flows.abs().mean(axis=1)
    # Broadcast and divide (avoid div by zero)
    ratio = pressures.apply(lambda col: mean_flow / col.replace(0, np.nan))
    return ratio.fillna(0)


def inject_leak(
    wn: wntr.network.WaterNetworkModel,
    junction_name: str,
    leak_diameter: float = 0.01,
    start_time: int = 0,
    end_time: int = None,
) -> wntr.network.WaterNetworkModel:
    """
    Inject a leak at a specified junction by adding an emitter.

    Args:
        wn: The WNTR network model (will be modified in place).
        junction_name: Junction to add leak at.
        leak_diameter: Equivalent leak orifice diameter in meters.
        start_time: Leak start time in seconds.
        end_time: Leak end time in seconds (None = until end of simulation).

    Returns:
        Modified network model with leak injected.
    """
    junction = wn.get_node(junction_name)
    leak_area = np.pi * (leak_diameter / 2) ** 2
    cd = 0.75  # Discharge coefficient for orifice flow
    emitter_coeff = cd * leak_area * np.sqrt(2 * 9.81)
    junction.emitter_coefficient = emitter_coeff
    return wn


def generate_synthetic_dataset(
    inp_path: str,
    num_leak_scenarios: int = 50,
    baseline_hours: int = 336,
    leak_duration_hours: int = 48,
    seed: int = 42,
) -> dict:
    """
    Generate a synthetic training dataset with normal and leak scenarios.
    Includes both pressure and flow data for each scenario.

    Args:
        inp_path: Path to the base .inp file.
        num_leak_scenarios: Number of leak scenarios to generate.
        baseline_hours: Duration for baseline (no-leak) simulation.
        leak_duration_hours: Duration for each leak simulation.
        seed: Random seed for reproducibility.

    Returns:
        Dictionary with:
        - baseline: dict of pressure/flow/demand DataFrames under normal conditions
        - leak_scenarios: list of dicts with simulation results + leak metadata
        - topology: network topology info
    """
    rng = np.random.default_rng(seed)

    # Generate baseline
    wn_baseline = load_network(inp_path)
    topology = extract_topology(wn_baseline)
    baseline = run_hydraulic_simulation(wn_baseline, duration_hours=baseline_hours)

    junction_names = wn_baseline.junction_name_list
    leak_scenarios = []

    for i in range(num_leak_scenarios):
        wn_leak = load_network(inp_path)

        # Random leak parameters
        leak_junction = rng.choice(junction_names)
        leak_diameter = rng.uniform(0.005, 0.05)  # 5mm to 50mm

        inject_leak(wn_leak, leak_junction, leak_diameter)

        try:
            sim_results = run_hydraulic_simulation(
                wn_leak, duration_hours=leak_duration_hours
            )
            leak_scenarios.append({
                "pressures": sim_results["pressures"],
                "flows": sim_results["flows"],
                "demands": sim_results["demands"],
                "leak_junction": leak_junction,
                "leak_diameter": leak_diameter,
                "leak_rate_estimate": 0.75 * np.pi * (leak_diameter / 2) ** 2 * np.sqrt(2 * 9.81 * 30),
                "scenario_id": i,
            })
        except Exception as e:
            print(f"Scenario {i} failed (junction={leak_junction}, d={leak_diameter:.4f}): {e}")
            continue

    return {
        "baseline": baseline,
        "leak_scenarios": leak_scenarios,
        "topology": topology,
    }
