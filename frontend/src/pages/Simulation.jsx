import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { getSensorTimeseries, getPipelineResults, getNetwork, getGroundTruth } from '../api/client'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'
import NetworkMap from '../components/NetworkMap'

const STEPS = [
    '1️⃣ Data Ingestion',
    '2️⃣ Regression Training',
    '3️⃣ Error Residuals',
    '4️⃣ CUSUM Detection',
    '5️⃣ Entropy Weighting',
    '6️⃣ Triangulation',
]

export default function Simulation() {
    const [step, setStep] = useState(0)
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
            <h2 className="text-2xl font-bold mb-1 gradient-text">🎯 Leak Detection Simulation</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">Step through the detection pipeline visually.</p>

            <div className="flex gap-2 mb-8">
                {STEPS.map((s, i) => (
                    <button key={i} onClick={() => setStep(i)}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${step === i
                                ? 'bg-[rgba(79,172,254,0.15)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                                : 'text-[var(--color-text-dim)] border border-[var(--color-border)] hover:border-[var(--color-accent)]'
                            }`}>{s}</button>
                ))}
            </div>

            {step === 0 && (
                <>
                    <SectionHeader>Step 1: SCADA Data Ingestion</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-4">
                        The pipeline loads <strong>pressure</strong> and <strong>flow</strong> telemetry from the L-TOWN SCADA system.
                        33 pressure sensors and 3 flow meters provide readings every 5 minutes for all of 2019.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <MetricCard value="105,408" label="Pressure Records" sublabel="33 sensor nodes" />
                        <MetricCard value="105,408" label="Flow Records" sublabel="3 flow meters + 1 pump" />
                    </div>
                </>
            )}

            {step === 1 && (
                <>
                    <SectionHeader>Step 2: Pairwise Linear Regression</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-4">
                        For each pair of sensors (i, j), we train a model during the calibration window (Jan 1–14, 2019):
                        <br /><code className="text-[var(--color-accent)]">P_i = K0 + K1·P_j + Kd·V + Kr·(V/P_j)</code>
                    </p>
                    {calData?.data?.length > 0 && (
                        <Plot
                            data={calData.sensors.map((s, i) => ({
                                x: calData.data.map(d => d.timestamp),
                                y: calData.data.map(d => d[s]),
                                mode: 'lines', name: s, type: 'scatter',
                                line: { width: 1 },
                            }))}
                            layout={{ ...plotBase, title: { text: 'Calibration Window Pressures', font: { color: '#c8d6e5' } } }}
                            config={{ responsive: true }} useResizeHandler style={{ width: '100%' }}
                        />
                    )}
                </>
            )}

            {step === 2 && (
                <>
                    <SectionHeader>Step 3: Mean Residual Error (MRE)</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-4">
                        After training, we apply the model over the entire year. At each timestep, the node with the
                        largest prediction error is flagged. A sustained spike = possible leak.
                    </p>
                </>
            )}

            {step === 3 && (
                <>
                    <SectionHeader>Step 4: CUSUM Change-Point Detection</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-4">
                        The CUSUM algorithm monitors MRE for sustained shifts. When cumulative deviation exceeds C_thr × σ,
                        an alarm triggers, pinpointing the exact timestamp the leak started.
                    </p>
                    {results && (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                            {results.map((r, i) => {
                                const sev = r.estimated_cusum_severity
                                const color = sev > 20 ? 'text-[#ff4757]' : sev > 10 ? 'text-[#ffa502]' : 'text-[#2ed573]'
                                return (
                                    <div key={i} className="text-sm">
                                        <span className={`${color} font-medium`}>● {r.detected_node}</span>
                                        {' '}detected at <strong>{r.estimated_start_time}</strong> (severity: {sev.toFixed(1)})
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {step === 4 && (
                <>
                    <SectionHeader>Step 5: GNN-Inspired Entropy Features</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-4">
                        We compute <strong>Fourier Entropy</strong> (spectral complexity) and <strong>Permutation Entropy</strong> (temporal
                        irregularity) for each candidate node. Combined with GNN reconstruction error into a composite weight.
                    </p>
                    <div className="rounded-xl border border-[var(--color-border-subtle)] overflow-hidden"
                        style={{ background: 'rgba(8,10,24,0.6)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--color-border)]">
                                    <th className="text-left px-4 py-3 text-[var(--color-text-dim)]">Feature</th>
                                    <th className="text-right px-4 py-3 text-[var(--color-accent)]">Node A (Leak Source)</th>
                                    <th className="text-right px-4 py-3 text-[var(--color-text-dim)]">Node B (Propagated)</th>
                                    <th className="text-right px-4 py-3 text-[var(--color-text-dimmer)]">Node C (Normal)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[['CUSUM Error', 4.2, 3.8, 1.1], ['Fourier Entropy', 6.8, 3.2, 2.5],
                                ['Permutation Entropy', 2.1, 1.4, 0.9], ['Composite Weight', 23.1, 9.8, 3.2]].map(([f, a, b, c]) => (
                                    <tr key={f} className="border-b border-[var(--color-border-subtle)]">
                                        <td className="px-4 py-2 font-medium">{f}</td>
                                        <td className="px-4 py-2 text-right text-[var(--color-accent)]">{a}</td>
                                        <td className="px-4 py-2 text-right">{b}</td>
                                        <td className="px-4 py-2 text-right text-[var(--color-text-dimmer)]">{c}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {step === 5 && (
                <>
                    <SectionHeader>Step 6: Entropy-Weighted Triangulation</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-4">
                        Top-3 sensors by composite weight → weighted centroid gives a continuous (X, Y) leak coordinate.
                    </p>
                    <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6"
                        style={{ background: 'rgba(8,10,24,0.6)' }}>
                        <NetworkMap network={network} predictions={results} groundTruth={gt} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <MetricCard value="142.51m" label="Final Mean Error" sublabel="With GNN + Entropy Optimization" gradient="green" />
                        <MetricCard value="5.6%" label="Improvement" sublabel="Over baseline (151.03m)" gradient="green" />
                    </div>
                </>
            )}
        </div>
    )
}
