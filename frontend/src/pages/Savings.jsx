import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { getSavings } from '../api/client'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'
import { PiggyBank, Lightbulb } from 'lucide-react'

export default function Savings() {
    const [waterCost, setWaterCost] = useState(2.5)
    const [repairCost, setRepairCost] = useState(8500)
    const [speedup, setSpeedup] = useState(7)

    const { data, isLoading } = useQuery({
        queryKey: ['savings', waterCost, repairCost, speedup],
        queryFn: () => getSavings(waterCost, repairCost, speedup),
    })

    return (
        <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-1 gradient-text"><PiggyBank className="w-6 h-6" /> City Water Savings Calculator</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">Quantify the economic impact of early leak detection.</p>

            {/* Controls */}
            <SectionHeader>Cost Parameters</SectionHeader>
            <div className="grid grid-cols-3 gap-6 mb-8">
                <div>
                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Water Cost ($/m³)</label>
                    <input type="number" value={waterCost} step={0.25} min={0.5} max={20}
                        onChange={e => setWaterCost(Number(e.target.value))}
                        className="w-full bg-[rgba(8,10,24,0.9)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)]" />
                </div>
                <div>
                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Avg Repair Cost ($/leak)</label>
                    <input type="number" value={repairCost} step={500} min={1000} max={100000}
                        onChange={e => setRepairCost(Number(e.target.value))}
                        className="w-full bg-[rgba(8,10,24,0.9)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)]" />
                </div>
                <div>
                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Early Detection (days): {speedup}</label>
                    <input type="range" min={1} max={30} value={speedup}
                        onChange={e => setSpeedup(Number(e.target.value))}
                        className="w-full accent-[var(--color-accent)] mt-2" />
                </div>
            </div>

            {isLoading && <div className="animate-pulse text-[var(--color-text-dim)]">Computing savings...</div>}

            {data && (
                <>
                    {/* Hero Metrics */}
                    <SectionHeader>Annual Impact Summary (2019)</SectionHeader>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <MetricCard value={`${data.total_lost_m3.toLocaleString()}`} label="Water Lost (m³)"
                            sublabel={`$${data.total_lost_cost.toLocaleString()} total cost`} gradient="red" />
                        <MetricCard value={`${data.total_saved_m3.toLocaleString()}`} label="Water Saved (m³)"
                            sublabel={`With ${speedup}-day early detection`} gradient="green" />
                        <MetricCard value={`$${data.total_saved_cost.toLocaleString()}`} label="Water Cost Saved"
                            sublabel={`At $${waterCost.toFixed(2)}/m³`} gradient="green" />
                        <MetricCard value={`$${data.total_combined_savings.toLocaleString()}`} label="Total Savings"
                            sublabel="Water + reduced repair costs" gradient="orange" />
                    </div>

                    {/* ROI Row */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <MetricCard value={data.num_leaks} label="Leaks Detected" sublabel="Across L-TOWN network" />
                        <MetricCard value={`${data.avg_duration_days} days`} label="Avg Leak Duration" sublabel="Without early detection" />
                        <MetricCard value={`${data.roi_pct}%`} label="ROI" sublabel="Return on $50K system investment" />
                    </div>

                    {/* Cumulative Timeline */}
                    <SectionHeader>Cumulative Water Loss Over Time</SectionHeader>
                    <Plot
                        data={[{
                            x: data.cumulative_timeline.map(d => d.timestamp),
                            y: data.cumulative_timeline.map(d => d.cumulative_m3),
                            mode: 'lines', fill: 'tozeroy',
                            line: { color: '#ff4757', width: 2 },
                            fillcolor: 'rgba(255,71,87,0.15)',
                            name: 'Water Lost (m³)', type: 'scatter',
                        }]}
                        layout={{
                            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#c0c8d4' },
                            xaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'Date' },
                            yaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'Cumulative Water Lost (m³)' },
                            height: 400, margin: { l: 60, r: 20, t: 20, b: 40 },
                            shapes: [{
                                type: 'line', x0: data.cumulative_timeline[0]?.timestamp,
                                x1: data.cumulative_timeline.at(-1)?.timestamp,
                                y0: data.cumulative_timeline.at(-1)?.cumulative_m3 - data.total_saved_m3,
                                y1: data.cumulative_timeline.at(-1)?.cumulative_m3 - data.total_saved_m3,
                                line: { color: '#2ed573', width: 2, dash: 'dash' },
                            }],
                        }}
                        config={{ responsive: true }} useResizeHandler style={{ width: '100%' }}
                    />

                    {/* Per-Leak Bar Chart */}
                    <div className="mt-8">
                        <SectionHeader>Per-Leak Cost Breakdown</SectionHeader>
                        <Plot
                            data={[
                                {
                                    x: data.per_leak.map(l => l.pipe), y: data.per_leak.map(l => l.total_m3),
                                    name: 'Volume Lost', marker: { color: '#ff4757' }, type: 'bar'
                                },
                                {
                                    x: data.per_leak.map(l => l.pipe), y: data.per_leak.map(l => l.saved_m3),
                                    name: 'Volume Saved', marker: { color: '#2ed573' }, type: 'bar'
                                },
                            ]}
                            layout={{
                                barmode: 'group',
                                plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                                font: { color: '#c0c8d4' },
                                xaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'Pipe', tickangle: -45 },
                                yaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'Volume (m³)' },
                                height: 400, margin: { l: 60, r: 20, t: 20, b: 80 },
                                legend: { bgcolor: 'rgba(10,14,39,0.8)', bordercolor: 'rgba(79,172,254,0.1)', borderwidth: 1 },
                            }}
                            config={{ responsive: true }} useResizeHandler style={{ width: '100%' }}
                        />
                    </div>

                    {/* Key Insight */}
                    <div className="mt-8 p-4 rounded-xl border border-[rgba(79,172,254,0.15)] bg-[rgba(79,172,254,0.05)]">
                        <p className="flex text-sm leading-relaxed">
                            <Lightbulb className="w-5 h-5 mr-2 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <span>
                                <strong>Key Finding:</strong> By detecting leaks just <strong>{speedup} days earlier</strong>,
                                the city could save <strong>{data.total_saved_m3.toLocaleString()} m³</strong> of water
                                (<strong>{((data.total_saved_m3 / data.total_lost_m3) * 100).toFixed(1)}%</strong> of total losses),
                                worth <strong>${data.total_saved_cost.toLocaleString()}</strong> annually.
                                Combined with reduced repair costs, total savings reach <strong>${data.total_combined_savings.toLocaleString()}</strong> —
                                a <strong>{data.roi_pct}% ROI</strong> on the system investment.
                            </span>
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
