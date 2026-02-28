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
                                colorscale: [[0, '#2ed573'], [0.5, '#ffa502'], [1, '#ff4757']],
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
