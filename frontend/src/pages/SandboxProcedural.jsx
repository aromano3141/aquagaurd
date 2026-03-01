import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { generateSandbox, simulateSandbox } from '../api/client'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'

export default function SandboxProcedural() {
    const [rows, setRows] = useState(6)
    const [cols, setCols] = useState(8)
    const [nSensors, setNSensors] = useState(5)
    const [density, setDensity] = useState(0.3)
    const [selectedLeaks, setSelectedLeaks] = useState([])

    const { data: network } = useQuery({
        queryKey: ['sandbox', rows, cols, nSensors, density],
        queryFn: () => generateSandbox(rows, cols, nSensors, density),
    })

    const simMutation = useMutation({
        mutationFn: () => simulateSandbox({ leak_pipes: selectedLeaks, rows, cols, sensors: nSensors, density }),
    })

    const nodeMap = {}
    network?.nodes?.forEach(n => { nodeMap[n.id] = n })

    const toggleLeak = (pid) => {
        setSelectedLeaks(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])
        simMutation.reset()
    }

    const buildFigData = () => {
        if (!network) return []
        const data = []

        // Pipes
        for (const pipe of network.pipes) {
            const n1 = nodeMap[pipe.start], n2 = nodeMap[pipe.end]
            if (!n1 || !n2) continue
            const isLeak = selectedLeaks.includes(pipe.id)
            data.push({
                x: [n1.x, n2.x], y: [n1.y, n2.y], mode: 'lines',
                line: { width: isLeak ? 3 : 1.2, color: isLeak ? '#ff4757' : 'rgba(79,172,254,0.3)' },
                hoverinfo: 'text', text: pipe.id, showlegend: false, type: 'scatter',
            })
        }

        // Nodes
        data.push({
            x: network.nodes.map(n => n.x), y: network.nodes.map(n => n.y), mode: 'markers',
            marker: { size: 6, color: 'rgba(79,172,254,0.5)' },
            text: network.nodes.map(n => n.id), hoverinfo: 'text', name: 'Junctions', type: 'scatter',
        })

        // Sensors
        const sCoords = network.sensors.map(s => nodeMap[s]).filter(Boolean)
        data.push({
            x: sCoords.map(n => n.x), y: sCoords.map(n => n.y), mode: 'markers',
            marker: { size: 14, color: '#00f2fe', symbol: 'diamond', line: { width: 2, color: '#4facfe' } },
            text: network.sensors.map(s => `Sensor: ${s}`), hoverinfo: 'text', name: 'Sensors', type: 'scatter',
        })

        // Leak markers
        if (selectedLeaks.length > 0) {
            const leakCoords = selectedLeaks.map(pid => {
                const p = network.pipes.find(pp => pp.id === pid)
                if (!p) return null
                const n1 = nodeMap[p.start], n2 = nodeMap[p.end]
                return n1 && n2 ? { id: pid, x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 } : null
            }).filter(Boolean)
            data.push({
                x: leakCoords.map(l => l.x), y: leakCoords.map(l => l.y), mode: 'markers',
                marker: { size: 16, color: '#ff4757', symbol: 'x', line: { width: 2, color: '#ff6b81' } },
                text: leakCoords.map(l => `Leak: ${l.id}`), hoverinfo: 'text', name: 'Placed Leaks', type: 'scatter',
            })
        }

        // Simulation predictions
        if (simMutation.data?.predictions) {
            const preds = simMutation.data.predictions

            // 1. Heatmap layer (draw first so it renders underneath)
            for (const p of preds) {
                if (p.heatmap) {
                    p.heatmap.forEach(h => {
                        data.push({
                            x: [h.x], y: [h.y], mode: 'markers',
                            marker: {
                                size: (h.weight * 120) + 30, // Dynamic radius based on probability
                                color: `rgba(255, 71, 87, ${h.weight * 0.4})`, // Opacity scales with probability
                                line: { width: 0 }
                            },
                            hoverinfo: 'text', text: `IDW Probability: ${(h.weight * 100).toFixed(1)}%`,
                            name: 'Probability Heatmap', showlegend: false, type: 'scatter'
                        })
                    })
                }
            }

            // 2. Prediction markers and error lines
            data.push({
                x: preds.map(p => p.pred_x), y: preds.map(p => p.pred_y), mode: 'markers',
                marker: { size: 18, color: '#2ed573', symbol: 'star', line: { width: 2, color: '#7bed9f' } },
                text: preds.map(p => `Prediction: ${p.pipe}<br>Error: ${p.error}m`),
                hoverinfo: 'text', name: 'Predicted Locations', type: 'scatter',
            })
            for (const p of preds) {
                data.push({
                    x: [p.true_x, p.pred_x], y: [p.true_y, p.pred_y], mode: 'lines',
                    line: { width: 1.5, color: '#ffa502', dash: 'dash' },
                    showlegend: false, hoverinfo: 'none', type: 'scatter',
                })
            }
        }

        return data
    }

    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold mb-1 gradient-text">🏗️ Procedural Generator & Leak Sandbox</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">Generate a grid network, playfully place leaks, and see how the IDW model reacts.</p>

            {/* Controls */}
            <SectionHeader>Network Parameters</SectionHeader>
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[['Grid Rows', rows, setRows, 3, 15], ['Grid Columns', cols, setCols, 3, 15],
                ['Sensors', nSensors, setNSensors, 2, 50]].map(([label, val, setter, min, max]) => (
                    <div key={label}>
                        <label className="text-xs text-[var(--color-text-dim)] block mb-1">{label}: {val}</label>
                        <input type="range" min={min} max={max} value={val} onChange={e => setter(Number(e.target.value))}
                            className="w-full accent-[var(--color-accent)]" />
                    </div>
                ))}
                <div>
                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Pipe Density: {density}</label>
                    <input type="range" min={0} max={1} step={0.1} value={density} onChange={e => setDensity(Number(e.target.value))}
                        className="w-full accent-[var(--color-accent)]" />
                </div>
            </div>

            {/* Leak Placement */}
            <SectionHeader>Place Leaks</SectionHeader>
            <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto">
                {network?.pipes?.map(p => (
                    <button key={p.id} onClick={() => toggleLeak(p.id)}
                        className={`px-2 py-0.5 rounded text-xs transition-all ${selectedLeaks.includes(p.id)
                            ? 'bg-[rgba(255,71,87,0.2)] text-[#ff4757] border border-[#ff4757]'
                            : 'text-[var(--color-text-dimmer)] border border-[var(--color-border)] hover:border-[var(--color-accent)]'
                            }`}>{p.id}</button>
                ))}
            </div>

            {/* Metrics + Map */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <MetricCard value={network?.nodes?.length ?? 0} label="Junctions" sublabel={`${rows}×${cols} grid`} />
                <MetricCard value={network?.pipes?.length ?? 0} label="Pipes" sublabel={`Density: ${(density * 100).toFixed(0)}%`} />
                <MetricCard value={selectedLeaks.length} label="Active Leaks" sublabel="Placed by user" />
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6"
                style={{ background: 'rgba(8,10,24,0.6)' }}>
                <Plot
                    data={buildFigData()}
                    layout={{
                        plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                        font: { color: '#c0c8d4', size: 11 },
                        xaxis: { showgrid: false, zeroline: false, visible: false, scaleanchor: 'y' },
                        yaxis: { showgrid: false, zeroline: false, visible: false },
                        height: 550, margin: { l: 10, r: 10, t: 10, b: 10 },
                        legend: { bgcolor: 'rgba(10,14,39,0.8)', bordercolor: 'rgba(79,172,254,0.1)', borderwidth: 1, x: 0.01, y: 0.99 },
                        dragmode: 'pan',
                    }}
                    config={{ scrollZoom: true, responsive: true }}
                    useResizeHandler style={{ width: '100%' }}
                />
            </div>

            {/* Run Simulation */}
            <button onClick={() => simMutation.mutate()}
                disabled={selectedLeaks.length === 0 || simMutation.isPending}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all
                   bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-end)]
                   hover:shadow-[0_4px_20px_rgba(79,172,254,0.3)]
                   disabled:opacity-40 disabled:cursor-not-allowed">
                {simMutation.isPending ? '⏳ Running...' : '🚀 Run Detection Simulation'}
            </button>

            {/* Results */}
            {simMutation.data && (
                <div className="mt-6">
                    <SectionHeader>Simulation Accuracy</SectionHeader>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <MetricCard value={`${simMutation.data.mean_error}m`} label="Mean Error"
                            gradient={simMutation.data.mean_error < 50 ? 'green' : simMutation.data.mean_error < 100 ? 'orange' : 'red'} />
                        <MetricCard value={`${simMutation.data.max_error}m`} label="Max Error" />
                        <MetricCard value={`${simMutation.data.accuracy_pct}%`} label="Accuracy" sublabel="Within 50m threshold" />
                    </div>

                    <SectionHeader>Maintenance Dispatch Orders</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {simMutation.data.predictions.map((p, i) => (
                            <div key={i} className="bg-[rgba(10,14,39,0.7)] border border-[rgba(255,71,87,0.3)] rounded-xl p-4 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-[#ff4757] opacity-[0.05] rounded-bl-full" />
                                <div className="text-[#ff4757] font-bold mb-1 text-[10px] uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4757] animate-pulse"></span>
                                    High Priority Leak
                                </div>
                                <h4 className="text-xl font-bold mb-3 tracking-wide">Target: {p.work_order?.dispatch_target || `Pipe ${p.pipe}`}</h4>

                                <div className="space-y-2 text-sm text-[var(--color-text-dim)] flex-grow">
                                    <div className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-1">
                                        <span>AI Confidence:</span>
                                        <span className="text-white font-mono">{p.work_order?.confidence_score}%</span>
                                    </div>
                                    <div className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-1">
                                        <span>Est. Water Loss:</span>
                                        <span className="text-[#ffa502] font-mono">{p.work_order?.gallons_lost_per_hour} gal/hr</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Economic Impact:</span>
                                        <span className="text-[#ff4757] font-mono">${p.work_order?.cost_per_hour}/hr</span>
                                    </div>
                                </div>

                                <button className="mt-4 w-full py-2.5 bg-[rgba(255,71,87,0.1)] hover:bg-[rgba(255,71,87,0.2)] text-[#ff4757] font-semibold text-sm rounded-lg transition-colors border border-[rgba(255,71,87,0.3)] hover:border-[#ff4757]">
                                    Dispatch Repair Team
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
