import { useQuery } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { getPipelineResults, getPipelineMetrics } from '../api/client'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'

export default function DetectionResults() {
    const { data: results, isLoading } = useQuery({ queryKey: ['pipeline'], queryFn: getPipelineResults })
    const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: getPipelineMetrics })

    if (isLoading) return <div className="animate-pulse text-[var(--color-text-dim)]">Running detection pipeline...</div>

    if (!results?.length) return <div className="text-[var(--color-text-dim)]">No detection results available. Run the pipeline first.</div>

    const sevValues = results.map(r => r.estimated_cusum_severity)
    const q25 = sevValues.sort((a, b) => a - b)[Math.floor(sevValues.length * 0.25)]
    const q75 = sevValues.sort((a, b) => a - b)[Math.floor(sevValues.length * 0.75)]
    const high = sevValues.filter(s => s > q75).length
    const med = sevValues.filter(s => s > q25 && s <= q75).length
    const low = sevValues.filter(s => s <= q25).length

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 gradient-text">📊 Leak Detection Results</h2>

            <div className="grid grid-cols-3 gap-6 mb-8">
                {/* Timeline */}
                <div className="col-span-2">
                    <SectionHeader>Detection Timeline</SectionHeader>
                    <Plot
                        data={[{
                            x: results.map(r => r.estimated_start_time),
                            y: results.map(r => r.estimated_cusum_severity),
                            mode: 'markers',
                            marker: {
                                size: results.map(r => Math.max(8, r.estimated_cusum_severity * 2)),
                                color: results.map(r => r.estimated_cusum_severity),
                                colorscale: 'Turbo',
                            },
                            text: results.map(r => r.detected_node),
                            hoverinfo: 'text+y', type: 'scatter',
                        }]}
                        layout={{
                            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#c8d6e5' },
                            xaxis: { gridcolor: 'rgba(79,172,254,0.08)' },
                            yaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'CUSUM Severity' },
                            height: 350, margin: { l: 50, r: 20, t: 20, b: 40 },
                        }}
                        config={{ responsive: true }}
                        useResizeHandler
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Pie */}
                <div>
                    <SectionHeader>Severity Distribution</SectionHeader>
                    <Plot
                        data={[{
                            labels: ['High', 'Medium', 'Low'],
                            values: [high, med, low],
                            marker: { colors: ['#ff4757', '#ffa502', '#2ed573'] },
                            hole: 0.55, textinfo: 'label+value',
                            textfont: { color: 'white', size: 13 },
                            type: 'pie',
                        }]}
                        layout={{
                            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#c8d6e5' }, showlegend: false,
                            height: 350, margin: { l: 10, r: 10, t: 10, b: 10 },
                        }}
                        config={{ responsive: true }}
                        useResizeHandler
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Maintenance Dispatch Orders (High Severity only) */}
            <SectionHeader>Maintenance Dispatch Orders</SectionHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {results.filter(r => r.estimated_cusum_severity > q75).slice(0, 6).map((p, i) => (
                    <div key={i} className="bg-[rgba(10,14,39,0.7)] border border-[rgba(255,71,87,0.3)] rounded-xl p-4 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff4757] opacity-[0.05] rounded-bl-full" />
                        <div className="text-[#ff4757] font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4757] animate-pulse"></span>
                            Priority Leak Action
                        </div>
                        <h4 className="text-xl font-bold mb-3 tracking-wide">Target: {p.work_order?.dispatch_target || `Node ${p.detected_node}`}</h4>

                        <div className="space-y-2 text-sm text-[var(--color-text-dim)] flex-grow">
                            <div className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-1">
                                <span>AI Confidence:</span>
                                <span className="text-white font-mono">{p.work_order?.confidence_score ?? '--'}%</span>
                            </div>
                            <div className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-1">
                                <span>Est. Water Loss:</span>
                                <span className="text-[#ffa502] font-mono">{p.work_order?.gallons_lost_per_hour ?? '--'} gal/hr</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Economic Impact:</span>
                                <span className="text-[#ff4757] font-mono">${p.work_order?.cost_per_hour ?? '--'}/hr</span>
                            </div>
                        </div>

                        <button className="mt-4 w-full py-2.5 bg-[rgba(255,71,87,0.1)] hover:bg-[rgba(255,71,87,0.2)] text-[#ff4757] font-semibold text-sm rounded-lg transition-colors border border-[rgba(255,71,87,0.3)] hover:border-[#ff4757]">
                            Dispatch Repair Team
                        </button>
                    </div>
                ))}
            </div>

            {/* Results Table */}
            <SectionHeader>Detailed Detection Log</SectionHeader>
            <div className="rounded-xl border border-[var(--color-border-subtle)] overflow-hidden mb-8"
                style={{ background: 'rgba(8,10,24,0.6)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--color-border)]">
                            <th className="text-left px-4 py-3 text-[var(--color-text-dim)] font-medium">Node</th>
                            <th className="text-left px-4 py-3 text-[var(--color-text-dim)] font-medium">Start Time</th>
                            <th className="text-left px-4 py-3 text-[var(--color-text-dim)] font-medium">Severity</th>
                            <th className="text-left px-4 py-3 text-[var(--color-text-dim)] font-medium">Rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => {
                            const sev = r.estimated_cusum_severity
                            const rating = sev > q75 ? '🔴 High' : sev > q25 ? '🟡 Medium' : '🟢 Low'
                            return (
                                <tr key={i} className="border-b border-[var(--color-border-subtle)] hover:bg-[rgba(79,172,254,0.03)]">
                                    <td className="px-4 py-2.5 font-mono">{r.detected_node}</td>
                                    <td className="px-4 py-2.5">{r.estimated_start_time}</td>
                                    <td className="px-4 py-2.5">{sev.toFixed(1)}</td>
                                    <td className="px-4 py-2.5">{rating}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Accuracy */}
            <SectionHeader>Localization Accuracy</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
                <MetricCard value={metrics?.mean_localization_error ? `${metrics.mean_localization_error}m` : '—'}
                    label="Mean Distance Error" sublabel="With GNN + Entropy Optimization" gradient="green" />
                <MetricCard value={`${metrics?.baseline_error ?? 151.03}m`}
                    label="Baseline Error" sublabel="Without GNN / Entropy Weighting" />
            </div>
        </div>
    )
}
