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
export const getSensorTimeseries = (sensors, startDate, endDate) => {
    const params = new URLSearchParams({ sensors: sensors.join(',') });
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    return fetchApi(`/sensors/timeseries?${params}`);
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

/* ── Real Network (.inp) ───────────────────────────────────────────────── */
export const loadInpNetwork = (filename, sensors = 8) =>
    fetchApi(`/sandbox/load-inp?filename=${encodeURIComponent(filename)}&sensors=${sensors}`);

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

/* ── Dispatch ──────────────────────────────────────────────────────────── */
export const dispatchAudio = async (nodeId) => {
    const res = await fetch(`${API_BASE}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId }),
    });
    if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
};

/* ── AI Report ─────────────────────────────────────────────────────────── */
export const generateReport = (leaks, metrics) =>
    fetchApi('/report', { method: 'POST', body: JSON.stringify({ leaks, metrics }) });
