import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { getSensorTimeseries, getPipelineResults, getPipelineMetrics, getNetwork, getGroundTruth, generateReport } from '../api/client'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'
import NetworkMap from '../components/NetworkMap'
import { Activity, Database, BrainCircuit, BarChart3, AlertTriangle, Fingerprint, Crosshair, Sparkles, Loader2 } from 'lucide-react'

const STEPS = [
    { icon: <Database className="w-3.5 h-3.5" />, label: 'Data Ingestion' },
    { icon: <BrainCircuit className="w-3.5 h-3.5" />, label: 'GNN Training' },
    { icon: <BarChart3 className="w-3.5 h-3.5" />, label: 'RF Regression' },
    { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'CUSUM Detection' },
    { icon: <Fingerprint className="w-3.5 h-3.5" />, label: 'Entropy Features' },
    { icon: <Crosshair className="w-3.5 h-3.5" />, label: 'Localization' },
]

export default function Simulation() {
    const [step, setStep] = useState(0)
    const [report, setReport] = useState(null)
    const [reportLoading, setReportLoading] = useState(false)
    const { data: results } = useQuery({ queryKey: ['pipeline'], queryFn: getPipelineResults })
    const { data: network } = useQuery({ queryKey: ['network'], queryFn: getNetwork })
    const { data: gt } = useQuery({ queryKey: ['groundTruth'], queryFn: getGroundTruth })
    const { data: calData } = useQuery({
        queryKey: ['calTimeseries'],
        queryFn: () => getSensorTimeseries(['n1', 'n2', 'n3', 'n4', 'n5'], '2019-01-01', '2019-01-14'),
    })

    const plotBase = {
        plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#c8d6e5' },
        xaxis: { gridcolor: 'rgba(79,172,254,0.08)' },
        yaxis: { gridcolor: 'rgba(79,172,254,0.08)' },
        height: 350, margin: { l: 50, r: 20, t: 40, b: 40 },
    }

    return (
        <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-1 gradient-text"><Activity className="w-6 h-6" /> Leak Detection Simulation</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">Step through the AquaGuard detection pipeline visually — from raw SCADA data to precise leak localization.</p>

            <div className="flex gap-2 mb-8 flex-wrap">
                {STEPS.map((s, i) => (
                    <button key={i} onClick={() => setStep(i)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${step === i
                            ? 'bg-[rgba(79,172,254,0.15)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                            : 'text-[var(--color-text-dim)] border border-[var(--color-border)] hover:border-[var(--color-accent)]'
                            }`}>{s.icon} {s.label}</button>
                ))}
            </div>

            <div className="relative z-10">
                {step === 0 && (
                    <>
                        <SectionHeader>Step 1: SCADA Data Ingestion</SectionHeader>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            The pipeline loads <strong>pressure</strong> and <strong>flow</strong> telemetry from the L-TOWN SCADA system.
                            33 pressure sensors and flow meters (including PUMP_1) provide readings every 5 minutes for all of 2019.
                            The calibration window spans <strong>January 1–14</strong>, establishing a no-leak baseline.
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <MetricCard value="105,408" label="Pressure Records" sublabel="33 sensor nodes" />
                            <MetricCard value="105,408" label="Flow Records" sublabel="PUMP_1 + flow meters" />
                            <MetricCard value="14 days" label="Calibration Window" sublabel="Jan 1–14, 2019 (no-leak)" />
                        </div>
                    </>
                )}

                {step === 1 && (
                    <>
                        <SectionHeader>Step 2: GATv2 Graph Autoencoder Training</SectionHeader>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            A <strong>Graph Attention Network (GATv2Conv)</strong> autoencoder is trained on the calibration period to learn normal pressure patterns
                            across the network topology. The model uses LSTM-based feature extraction with a 120-timestep sliding window (stride 10), followed by
                            a 4-layer GATv2 encoder and symmetric decoder with edge features (pipe length, diameter, roughness).
                        </p>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <MetricCard value="GATv2Conv" label="GNN Layer" sublabel="4 attention heads" />
                            <MetricCard value="4 layers" label="Encoder Depth" sublabel="32-dim hidden state" />
                            <MetricCard value="LSTM" label="Feature Extractor" sublabel="120-step sliding window" />
                            <MetricCard value="30 epochs" label="Training" sublabel="AdamW + early stopping" />
                        </div>
                        <div className="p-3 rounded-lg border border-[rgba(79,172,254,0.15)] bg-[rgba(79,172,254,0.05)]">
                            <p className="text-xs text-[var(--color-text-dim)]">
                                After training, the autoencoder's <strong>reconstruction error</strong> per node serves as an anomaly signal —
                                nodes with leaks show significantly higher error because the learned "normal" pattern no longer holds.
                            </p>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <SectionHeader>Step 3: Random Forest Regression Residuals</SectionHeader>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            For each sensor node, a <strong>Random Forest Regressor</strong> (100 trees, max depth 5) is trained on the calibration window
                            using 3 reference nodes. Each model uses 3 features: reference pressure <code className="text-[var(--color-accent)]">P_j</code>,
                            source flow <code className="text-[var(--color-accent)]">V</code> (PUMP_1), and an <strong>engineered flow-to-pressure ratio</strong>:
                        </p>
                        <div className="mb-4 p-3 rounded-lg bg-[rgba(8,10,24,0.8)] border border-[var(--color-border)]">
                            <code className="text-[var(--color-accent)] text-sm">X = [P_j, V, V / (P_j + ε)]</code>
                            <p className="text-xs text-[var(--color-text-dimmer)] mt-1">The ratio feature differentiates demand-driven pressure drops (systemic) from leak-induced drops (localized).</p>
                        </div>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            After training, models predict all timesteps. The node with the largest summed residual error at each timestep is flagged.
                            Errors are clipped to [0, 1] and the Mean Residual Error (MRE) matrix is passed to the next stage.
                        </p>
                        {calData?.data?.length > 0 && (
                            <div className="relative overflow-hidden rounded-xl" style={{ height: 350 }}>
                                <Plot
                                    data={calData.sensors.map((s, i) => ({
                                        x: calData.data.map(d => d.timestamp),
                                        y: calData.data.map(d => d[s]),
                                        mode: 'lines', name: s, type: 'scatter',
                                        line: { width: 1 },
                                    }))}
                                    layout={{ ...plotBase, title: { text: 'Calibration Window Pressures (Training Data)', font: { color: '#c8d6e5' } } }}
                                    config={{ responsive: true }} useResizeHandler style={{ width: '100%' }}
                                />
                            </div>
                        )}
                    </>
                )}

                {step === 3 && (
                    <>
                        <SectionHeader>Step 4: CUSUM Change-Point Detection</SectionHeader>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            The <strong>Cumulative Sum (CUSUM)</strong> algorithm monitors the MRE signal for sustained shifts from the baseline.
                            Parameters: <code className="text-[var(--color-accent)]">δ=4</code> (sensitivity),
                            <code className="text-[var(--color-accent)]"> C_thr=3</code> (threshold multiplier), and a
                            <code className="text-[var(--color-accent)]"> 3-day</code> estimation window for mean/σ.
                            When cumulative deviation exceeds <code className="text-[var(--color-accent)]">C_thr × σ</code>,
                            an alarm triggers, pinpointing the exact timestamp the leak started.
                        </p>
                        {results && (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                {results.map((r, i) => {
                                    const sev = r.estimated_cusum_severity
                                    const color = sev > 20 ? 'text-[#ff4757]' : sev > 10 ? 'text-[#ffa502]' : 'text-[#2ed573]'
                                    return (
                                        <div key={i} className="flex items-center gap-3 bg-[rgba(8,10,24,0.5)] rounded-lg px-4 py-2 border border-[var(--color-border)]">
                                            <span className={`${color} font-medium text-sm`}>● {r.detected_node}</span>
                                            <span className="text-xs text-[var(--color-text-dim)]">detected at <strong>{r.estimated_start_time}</strong></span>
                                            <span className="ml-auto text-xs font-mono text-[var(--color-text-dimmer)]">severity: {sev.toFixed(1)}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                )}

                {step === 4 && (
                    <>
                        <SectionHeader>Step 5: GNN + Entropy Feature Extraction</SectionHeader>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            For each candidate leak node (top 3 by CUSUM score), we compute three anomaly signals that are
                            <strong> Min-Max scaled</strong> and combined into a composite weight:
                        </p>
                        <div className="rounded-xl border border-[var(--color-border-subtle)] overflow-hidden"
                            style={{ background: 'rgba(8,10,24,0.6)' }}>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--color-border)]">
                                        <th className="text-left px-4 py-3 text-[var(--color-text-dim)]">Feature</th>
                                        <th className="text-left px-4 py-3 text-[var(--color-text-dim)]">Source</th>
                                        <th className="text-left px-4 py-3 text-[var(--color-text-dim)]">Formula</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-[var(--color-border-subtle)]">
                                        <td className="px-4 py-2 font-medium text-[var(--color-accent)]">CUSUM Score</td>
                                        <td className="px-4 py-2">Step 4 output</td>
                                        <td className="px-4 py-2 font-mono text-xs">cusum_at_t[node]</td>
                                    </tr>
                                    <tr className="border-b border-[var(--color-border-subtle)]">
                                        <td className="px-4 py-2 font-medium text-[#ffa502]">GNN Reconstruction Error</td>
                                        <td className="px-4 py-2">GATv2 Autoencoder</td>
                                        <td className="px-4 py-2 font-mono text-xs">mean(|y - recon|)</td>
                                    </tr>
                                    <tr className="border-b border-[var(--color-border-subtle)]">
                                        <td className="px-4 py-2 font-medium text-[#2ed573]">Fourier Entropy</td>
                                        <td className="px-4 py-2">Pressure FFT</td>
                                        <td className="px-4 py-2 font-mono text-xs">H(|FFT(p)|²)</td>
                                    </tr>
                                    <tr className="border-b border-[var(--color-border-subtle)]">
                                        <td className="px-4 py-2 font-medium text-[#ff6b81]">Permutation Entropy</td>
                                        <td className="px-4 py-2">Temporal ordering</td>
                                        <td className="px-4 py-2 font-mono text-xs">PE(p, m=3, τ=1)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 p-3 rounded-lg bg-[rgba(8,10,24,0.8)] border border-[var(--color-border)]">
                            <code className="text-[var(--color-accent)] text-sm">weight = scaled_cusum + (w_gnn × scaled_gnn) + (w_ent × fourier_ent × perm_ent)</code>
                            <p className="text-xs text-[var(--color-text-dimmer)] mt-1">Optimal weights: w_gnn = 0.5, w_ent = 2.0 — determined via grid search.</p>
                        </div>
                    </>
                )}

                {step === 5 && (
                    <>
                        <SectionHeader>Step 6: Physics-Based Localization & Pipe Snapping</SectionHeader>
                        <p className="text-sm text-[var(--color-text-dim)] mb-4">
                            AquaGuard uses two complementary localization strategies, automatically selecting the best available method:
                        </p>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-4 rounded-xl border border-[rgba(79,172,254,0.2)] bg-[rgba(8,10,24,0.5)]">
                                <h4 className="text-sm font-bold text-[var(--color-accent)] mb-2">Primary: Fault Matrix Matching</h4>
                                <p className="text-xs text-[var(--color-text-dim)]">
                                    A precomputed <strong>physics-based fault matrix</strong> simulates the pressure drop signature of a leak at every pipe in the network via EPANET.
                                    Real CUSUM residuals are matched against these signatures using <strong>cosine similarity</strong>, identifying the most likely pipe.
                                </p>
                            </div>
                            <div className="p-4 rounded-xl border border-[rgba(46,213,115,0.2)] bg-[rgba(8,10,24,0.5)]">
                                <h4 className="text-sm font-bold text-[#2ed573] mb-2">Fallback: Entropy-Weighted Triangulation</h4>
                                <p className="text-xs text-[var(--color-text-dim)]">
                                    Top-3 sensors by composite weight (Step 5) → <strong>weighted centroid</strong> gives a continuous (X, Y) coordinate.
                                    The predicted point is then <strong>snapped to the nearest pipe</strong> using perpendicular projection for physical plausibility.
                                </p>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6"
                            style={{ background: 'rgba(8,10,24,0.6)' }}>
                            <NetworkMap network={network} predictions={results} groundTruth={gt} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard value="142.51m" label="Final Mean Error" sublabel="With GNN + Entropy + Fault Matrix" gradient="green" />
                            <MetricCard value="5.6%" label="Improvement" sublabel="Over baseline (151.03m)" gradient="green" />
                        </div>

                        {/* AI Report Generator */}
                        <div className="mt-6">
                            <button
                                onClick={async () => {
                                    setReportLoading(true)
                                    try {
                                        const metrics = await getPipelineMetrics()
                                        const data = await generateReport(results, metrics)
                                        setReport(data.report)
                                    } catch (e) {
                                        setReport(`Error generating report: ${e.message}`)
                                    } finally {
                                        setReportLoading(false)
                                    }
                                }}
                                disabled={reportLoading || !results}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[rgba(79,172,254,0.15)] to-[rgba(46,213,115,0.15)] border border-[var(--color-accent)] text-[var(--color-accent)] text-sm font-semibold hover:from-[rgba(79,172,254,0.25)] hover:to-[rgba(46,213,115,0.25)] transition-all disabled:opacity-50 disabled:cursor-wait"
                            >
                                {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {reportLoading ? 'Generating AI Report...' : 'Generate AI Report'}
                            </button>
                        </div>

                        {report && (
                            <div className="mt-4 p-5 rounded-xl border border-[rgba(79,172,254,0.2)] bg-[rgba(8,10,24,0.7)]">
                                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] mb-3">
                                    <Sparkles className="w-3.5 h-3.5" /> AI-Generated Leak Report
                                </h4>
                                <div className="text-sm text-[var(--color-text-dim)] leading-relaxed whitespace-pre-wrap">
                                    {report}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            {/* ── References ── */}
            <div className="mt-16 pt-6 border-t border-[var(--color-border)]">
                <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[rgba(8,10,24,0.95)]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-dim)] mb-3">Acknowledgments & References</h4>
                    <p className="text-xs text-[var(--color-text-dim)] leading-relaxed mb-3">
                        AquaGuard's detection pipeline is built on the <strong>LILA</strong> (Leakage Identification and Localization Algorithm)
                        framework from the <a href="https://battledim.ucy.ac.cy/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline hover:opacity-80">BattLeDIM 2020</a> competition
                        (Vrachimis et al., University of Cyprus). We extended the baseline with the following additions:
                    </p>
                    <ul className="text-xs text-[var(--color-text-dimmer)] space-y-1 mb-3 pl-4 list-disc">
                        <li>GATv2 graph autoencoder for topology-aware anomaly detection</li>
                        <li>Random Forest regression with engineered flow-to-pressure features</li>
                        <li>Entropy-weighted triangulation (Fourier + Permutation entropy)</li>
                        <li>Physics-based fault matrix matching via EPANET simulation</li>
                        <li>Full-stack real-time dashboard, sandbox, and voice dispatch</li>
                    </ul>
                    <p className="text-[10px] text-[var(--color-text-dimmer)]">
                        Dataset: L-TOWN benchmark · Vrachimis, S.G., et al. (2020), WDSA/CCWI Joint Conference ·{' '}
                        <a href="https://github.com/KIOS-Research/BattLeDIM" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline hover:opacity-80">KIOS Research GitHub</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
