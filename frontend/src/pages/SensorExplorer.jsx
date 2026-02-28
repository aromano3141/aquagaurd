import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { getSensors, getSensorTimeseries, getSensorStats, getPipelineResults } from '../api/client'
import SectionHeader from '../components/SectionHeader'

const COLORS = ['#4facfe', '#ff4757', '#2ed573', '#ffa502', '#a29bfe', '#fd79a8', '#00f2fe', '#fdcb6e']

export default function SensorExplorer() {
    const { data: sensorData } = useQuery({ queryKey: ['sensors'], queryFn: getSensors })
    const { data: pipeline } = useQuery({ queryKey: ['pipeline'], queryFn: getPipelineResults })

    const [selected, setSelected] = useState([])
    const [startDate, setStartDate] = useState('2019-01-01')
    const [endDate, setEndDate] = useState('2019-02-15')

    const { data: timeseries } = useQuery({
        queryKey: ['timeseries', selected, startDate, endDate],
        queryFn: () => getSensorTimeseries(selected, startDate, endDate),
        enabled: selected.length > 0,
    })
    const { data: stats } = useQuery({
        queryKey: ['stats', selected, startDate, endDate],
        queryFn: () => getSensorStats(selected, startDate, endDate),
        enabled: selected.length > 0,
    })

    const sensors = sensorData?.sensor_ids || []

    const handleToggle = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-1 gradient-text">📈 Pressure Sensor Explorer</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">Explore raw pressure time-series data from any sensor node.</p>

            {/* Sensor Select */}
            <div className="mb-4">
                <label className="text-sm text-[var(--color-text-dim)] mb-2 block">Select Sensors</label>
                <div className="flex flex-wrap gap-2">
                    {sensors.map(s => (
                        <button key={s} onClick={() => handleToggle(s)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${selected.includes(s)
                                    ? 'bg-[rgba(79,172,254,0.15)] text-[var(--color-accent)] border-[var(--color-accent)]'
                                    : 'bg-transparent text-[var(--color-text-dim)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
                                }`}
                        >{s}</button>
                    ))}
                </div>
            </div>

            {/* Date Range */}
            <div className="flex gap-4 mb-6">
                <div>
                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="bg-[rgba(8,10,24,0.9)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)]" />
                </div>
                <div>
                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        className="bg-[rgba(8,10,24,0.9)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)]" />
                </div>
            </div>

            {selected.length > 0 && timeseries?.data?.length > 0 && (
                <>
                    <Plot
                        data={selected.map((s, i) => ({
                            x: timeseries.data.map(d => d.timestamp),
                            y: timeseries.data.map(d => d[s]),
                            mode: 'lines', name: s,
                            line: { width: 1.5, color: COLORS[i % COLORS.length] },
                            type: 'scatter',
                        }))}
                        layout={{
                            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#c8d6e5', size: 11 },
                            xaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'Time' },
                            yaxis: { gridcolor: 'rgba(79,172,254,0.08)', title: 'Pressure (m)' },
                            legend: { bgcolor: 'rgba(10,14,39,0.8)', bordercolor: 'rgba(79,172,254,0.2)', borderwidth: 1 },
                            height: 500, margin: { l: 50, r: 20, t: 20, b: 40 },
                            shapes: pipeline
                                ?.filter(r => selected.includes(r.detected_node))
                                .map(r => ({
                                    type: 'line', x0: r.estimated_start_time, x1: r.estimated_start_time,
                                    y0: 0, y1: 1, yref: 'paper',
                                    line: { color: '#ff4757', width: 1.5, dash: 'dash' },
                                })) || [],
                        }}
                        config={{ responsive: true }}
                        useResizeHandler
                        style={{ width: '100%' }}
                    />

                    {/* Stats Table */}
                    {stats?.stats?.length > 0 && (
                        <div className="mt-6">
                            <SectionHeader>Sensor Statistics</SectionHeader>
                            <div className="rounded-xl border border-[var(--color-border-subtle)] overflow-hidden"
                                style={{ background: 'rgba(8,10,24,0.6)' }}>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <th className="text-left px-4 py-3 text-[var(--color-text-dim)]">Sensor</th>
                                            <th className="text-right px-4 py-3 text-[var(--color-text-dim)]">Mean</th>
                                            <th className="text-right px-4 py-3 text-[var(--color-text-dim)]">Std Dev</th>
                                            <th className="text-right px-4 py-3 text-[var(--color-text-dim)]">Min</th>
                                            <th className="text-right px-4 py-3 text-[var(--color-text-dim)]">Max</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.stats.map(s => (
                                            <tr key={s.sensor_id} className="border-b border-[var(--color-border-subtle)]">
                                                <td className="px-4 py-2 font-mono">{s.sensor_id}</td>
                                                <td className="px-4 py-2 text-right">{s.mean}</td>
                                                <td className="px-4 py-2 text-right">{s.std}</td>
                                                <td className="px-4 py-2 text-right">{s.min}</td>
                                                <td className="px-4 py-2 text-right">{s.max}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {selected.length === 0 && (
                <div className="text-center py-16 text-[var(--color-text-dim)]">Select at least one sensor node above to begin exploring.</div>
            )}
        </div>
    )
}
