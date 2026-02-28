"""
Pydantic schemas for API request/response models.
"""

from pydantic import BaseModel


class LeakResult(BaseModel):
    detected_node: str
    estimated_start_time: str
    gps_coordinates: list[float] | None = None
    estimated_cusum_severity: float


class PipelineMetrics(BaseModel):
    leaks_detected: int
    ground_truth_leaks: int
    mean_localization_error: float | None
    baseline_error: float
    improvement_pct: float | None
    optimal_w_gnn: float
    optimal_w_ent: float


class NetworkData(BaseModel):
    nodes: list[dict]
    links: list[dict]
    num_nodes: int
    num_links: int


class SensorInfo(BaseModel):
    sensor_ids: list[str]


class TimeSeriesPoint(BaseModel):
    timestamp: str
    values: dict[str, float]


class SensorStats(BaseModel):
    sensor_id: str
    mean: float
    std: float
    min: float
    max: float


class SavingsResult(BaseModel):
    total_lost_m3: float
    total_lost_cost: float
    total_saved_m3: float
    total_saved_cost: float
    total_repair_savings: float
    total_combined_savings: float
    roi_pct: float
    num_leaks: int
    avg_duration_days: float
    per_leak: list[dict]
    cumulative_timeline: list[dict]


class SandboxNetwork(BaseModel):
    nodes: list[dict]
    pipes: list[dict]
    sensors: list[str]


class SandboxSimResult(BaseModel):
    predictions: list[dict]
    mean_error: float
    max_error: float
    accuracy_pct: float
