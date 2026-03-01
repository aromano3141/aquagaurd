const API_BASE = '/api';

export async function fetchApi(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

/* ── Pipeline ──────────────────────────────────────────────────────────── */
export const getPipelineResults = () => fetchApi('/pipeline/run');
export const getPipelineMetrics = () => fetchApi('/pipeline/metrics');

/* ── Sensors ───────────────────────────────────────────────────────────── */
export const getSensors = () => fetchApi('/sensors');
export const getSensorTimeseries = (sensors, startDate, endDate) => {
    const params = new URLSearchParams({ sensors: sensors.join(',') });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return fetchApi(`/sensors/timeseries?${params}`);
};
export const getSensorStats = (sensors, startDate, endDate) => {
    const params = new URLSearchParams({ sensors: sensors.join(',') });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return fetchApi(`/sensors/stats?${params}`);
};

/* ── Network ───────────────────────────────────────────────────────────── */
export const getNetwork = () => fetchApi('/network');
export const getGroundTruth = () => fetchApi('/network/ground-truth');

/* ── Savings ───────────────────────────────────────────────────────────── */
export const getSavings = (waterCost, repairCost, speedup) =>
    fetchApi(`/savings/compute?water_cost=${waterCost}&repair_cost=${repairCost}&detection_speedup=${speedup}`);

/* ── Sandbox ───────────────────────────────────────────────────────────── */
export const generateSandbox = (rows, cols, sensors, density) =>
    fetchApi(`/sandbox/generate?rows=${rows}&cols=${cols}&sensors=${sensors}&density=${density}`);

export const simulateSandbox = (body) =>
    fetchApi('/sandbox/simulate', { method: 'POST', body: JSON.stringify(body) });

/* ── Universal Model ───────────────────────────────────────────────────── */
export const uploadNetwork = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/sandbox/upload-network`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
};

export const detectZones = (filename) =>
    fetchApi(`/sandbox/detect-zones?filename=${encodeURIComponent(filename)}`, { method: 'POST' });
