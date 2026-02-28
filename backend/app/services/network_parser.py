"""
Network Parser Service

Parses EPANET .inp files using WNTR and extracts the full water distribution
network topology: junctions, pipes, pumps, valves, reservoirs, tanks,
demand patterns, curves, and all associated properties.
"""

import wntr


def parse_inp_file(inp_path: str) -> dict:
    """
    Parse an EPANET .inp file and return a comprehensive JSON-serializable
    dictionary containing the complete network topology and metadata.

    Args:
        inp_path: Path to the .inp file on disk.

    Returns:
        Dictionary with keys: nodes, edges, metadata, patterns
    """
    wn = wntr.network.WaterNetworkModel(inp_path)

    nodes = []
    edges = []

    # ── Junctions ──
    for name, junction in wn.junctions():
        coords = wn.get_node(name).coordinates
        nodes.append({
            "id": name,
            "type": "junction",
            "x": coords[0],
            "y": coords[1],
            "elevation": junction.elevation,
            "base_demand": junction.base_demand,
            "demand_pattern": junction.demand_timeseries_list[0].pattern_name if junction.demand_timeseries_list else None,
            "emitter_coefficient": junction.emitter_coefficient,
            "initial_quality": junction.initial_quality,
        })

    # ── Reservoirs ──
    for name, reservoir in wn.reservoirs():
        coords = wn.get_node(name).coordinates
        nodes.append({
            "id": name,
            "type": "reservoir",
            "x": coords[0],
            "y": coords[1],
            "elevation": reservoir.base_head,
            "base_demand": 0,
            "head_pattern": reservoir.head_pattern_name,
            "initial_quality": reservoir.initial_quality,
        })

    # ── Tanks ──
    for name, tank in wn.tanks():
        coords = wn.get_node(name).coordinates
        nodes.append({
            "id": name,
            "type": "tank",
            "x": coords[0],
            "y": coords[1],
            "elevation": tank.elevation,
            "base_demand": 0,
            "init_level": tank.init_level,
            "min_level": tank.min_level,
            "max_level": tank.max_level,
            "diameter": tank.diameter,
            "min_vol": tank.min_vol,
            "vol_curve": tank.vol_curve_name,
            "initial_quality": tank.initial_quality,
        })

    # ── Pipes ──
    for name, pipe in wn.pipes():
        edges.append({
            "id": name,
            "type": "pipe",
            "start_node": pipe.start_node_name,
            "end_node": pipe.end_node_name,
            "length": pipe.length,
            "diameter": pipe.diameter,
            "roughness": pipe.roughness,
            "minor_loss": pipe.minor_loss,
            "status": str(pipe.status),
            "bulk_coeff": pipe.bulk_coeff,
            "wall_coeff": pipe.wall_coeff,
        })

    # ── Pumps ──
    for name, pump in wn.pumps():
        try:
            speed = pump.speed_timeseries.base_value
        except Exception:
            speed = 1.0
        try:
            speed_pat = pump.speed_timeseries.pattern_name
        except Exception:
            speed_pat = None
        try:
            pump_curve = pump.pump_curve_name
        except Exception:
            pump_curve = None
        try:
            power = float(pump.power)
        except Exception:
            power = None

        pump_data = {
            "id": name,
            "type": "pump",
            "start_node": pump.start_node_name,
            "end_node": pump.end_node_name,
            "length": 0,
            "diameter": 0,
            "roughness": 0,
            "status": str(pump.status),
            "pump_type": str(pump.pump_type),
            "speed": speed,
            "speed_pattern": speed_pat,
            "power": power,
            "pump_curve": pump_curve,
        }
        edges.append(pump_data)

    # ── Valves ──
    for name, valve in wn.valves():
        edges.append({
            "id": name,
            "type": "valve",
            "start_node": valve.start_node_name,
            "end_node": valve.end_node_name,
            "length": 0,
            "diameter": valve.diameter,
            "roughness": 0,
            "valve_type": str(valve.valve_type),
            "setting": valve.setting,
            "minor_loss": valve.minor_loss,
            "status": str(valve.status),
        })

    # ── Demand Patterns ──
    patterns = {}
    for name in wn.pattern_name_list:
        pattern = wn.get_pattern(name)
        patterns[name] = pattern.multipliers.tolist()

    # ── Curves ──
    curves = {}
    for name in wn.curve_name_list:
        curve = wn.get_curve(name)
        curves[name] = {
            "curve_type": str(curve.curve_type),
            "points": [[p[0], p[1]] for p in curve.points],
        }

    # ── Network Options ──
    options = {
        "hydraulic_timestep": wn.options.time.hydraulic_timestep,
        "duration": wn.options.time.duration,
        "headloss_formula": str(wn.options.hydraulic.headloss),
        "demand_model": str(wn.options.hydraulic.demand_model),
        "units": str(wn.options.hydraulic.inpfile_units) if hasattr(wn.options.hydraulic, 'inpfile_units') else 'Unknown',
    }

    # ── Metadata ──
    metadata = {
        "num_junctions": wn.num_junctions,
        "num_pipes": wn.num_pipes,
        "num_reservoirs": wn.num_reservoirs,
        "num_tanks": wn.num_tanks,
        "num_pumps": wn.num_pumps,
        "num_valves": wn.num_valves,
        "num_patterns": len(wn.pattern_name_list),
        "num_curves": len(wn.curve_name_list),
    }

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": metadata,
        "patterns": patterns,
        "curves": curves,
        "options": options,
    }
