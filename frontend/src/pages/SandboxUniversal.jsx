import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { uploadNetwork, detectZones } from '../api/client'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'

const SAMPLE_NETWORKS = [
    'Net1.inp', 'Net2.inp', 'Net3.inp', 'Anytown.inp', 'Net6.inp'
]

export default function SandboxUniversal() {
    const [selectedNetwork, setSelectedNetwork] = useState('Net3.inp')
    const [uploading, setUploading] = useState(false)

    const detectMutation = useMutation({
        mutationFn: () => detectZones(selectedNetwork),
    })

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploading(true)
            const res = await uploadNetwork(file)
            setSelectedNetwork(res.filename)
            // Auto run detection after upload
            detectMutation.mutate()
        } catch (err) {
            alert('Failed to upload network file', err)
        } finally {
            setUploading(false)
        }
    }

    const buildFigData = () => {
        if (!detectMutation.data) return []
        const data = []
        const { nodes, links, zones, injected_leak } = detectMutation.data

        // 1. Links (Pipes)
        for (const link of links) {
            data.push({
                x: [link.start_x, link.end_x], y: [link.start_y, link.end_y], mode: 'lines',
                line: { width: 1.2, color: 'rgba(79,172,254,0.3)' },
                hoverinfo: 'none', showlegend: false, type: 'scatter',
            })
        }

        // 2. Base Nodes
        data.push({
            x: nodes.map(n => n.x), y: nodes.map(n => n.y), mode: 'markers',
            marker: { size: 6, color: 'rgba(79,172,254,0.3)' },
            text: nodes.map(n => n.id), hoverinfo: 'text', name: 'Junctions', type: 'scatter',
        })

        // 3. Heatmap Layer for high probability zones
        const suspectNodes = nodes.filter(n => n.probability > 0.1)
        for (const n of suspectNodes) {
            data.push({
                x: [n.x], y: [n.y], mode: 'markers',
                marker: {
                    size: (n.probability * 100) + 20,
                    color: `rgba(255, 71, 87, ${n.probability * 0.5})`,
                    line: { width: 0 }
                },
                hoverinfo: 'text', text: `Zone Probability: ${(n.probability * 100).toFixed(1)}%`,
                name: 'Probability Heatmap', showlegend: false, type: 'scatter'
            })
        }

        // 4. Injected True Leak location (for demo verification)
        const trueLeak = nodes.find(n => n.id === injected_leak)
        if (trueLeak) {
            data.push({
                x: [trueLeak.x], y: [trueLeak.y], mode: 'markers',
                marker: { size: 16, color: '#f1c40f', symbol: 'star', line: { width: 2, color: '#f39c12' } },
                text: [`Actual Leak: ${injected_leak}`], hoverinfo: 'text', name: 'Actual Leak', type: 'scatter',
            })
        }

        return data
    }

    return (
        <div className="animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold mb-1 gradient-text">🌍 Universal SaaS Dashboard</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">Upload any city's water network (.inp) or use a sample, and the Universal GNN will identify leak zones instantly.</p>

            <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Controls */}
                <div className="bg-[rgba(10,14,39,0.5)] border border-[var(--color-border)] p-6 rounded-2xl">
                    <SectionHeader>1. Select City Topology</SectionHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-[var(--color-text-dim)] block mb-2">Use Built-in Sample City</label>
                            <select
                                className="w-full bg-[rgba(8,10,24,0.8)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                                value={selectedNetwork}
                                onChange={(e) => setSelectedNetwork(e.target.value)}
                            >
                                {SAMPLE_NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-px bg-[rgba(255,255,255,0.1)] flex-grow"></div>
                            <span className="text-[var(--color-text-dimmer)] text-xs uppercase font-bold tracking-wider">OR</span>
                            <div className="h-px bg-[rgba(255,255,255,0.1)] flex-grow"></div>
                        </div>

                        <div>
                            <label className="text-sm text-[var(--color-text-dim)] block mb-2">Upload Custom City (.inp)</label>
                            <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:bg-[rgba(79,172,254,0.05)] cursor-pointer transition-colors">
                                <span className="text-[var(--color-text-dim)]">{uploading ? 'Uploading...' : 'Click to Upload .inp File'}</span>
                                <input type="file" accept=".inp" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Execution */}
                <div className="bg-[rgba(10,14,39,0.5)] border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-center">
                    <SectionHeader>2. Run Universal GNN</SectionHeader>
                    <p className="text-sm text-[var(--color-text-dim)] mb-6">
                        The model will simulate the hydraulic baseline, compare it against live sensor readings, and output a topological probability heatmap.
                    </p>

                    <button onClick={() => detectMutation.mutate()}
                        disabled={detectMutation.isPending || uploading}
                        className="w-full py-4 rounded-xl font-bold text-white transition-all text-lg
                           bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-end)]
                           hover:shadow-[0_4px_25px_rgba(79,172,254,0.4)]
                           disabled:opacity-40 disabled:cursor-not-allowed">
                        {detectMutation.isPending ? '⏳ Analyzing Topology...' : '🚀 Detect Leak Zones'}
                    </button>
                    <div className="text-center mt-3 text-xs text-[var(--color-text-dimmer)]">
                        Selected Target: <span className="font-mono text-[var(--color-accent)]">{selectedNetwork}</span>
                    </div>
                </div>
            </div>

            {/* Results */}
            {detectMutation.data && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <MetricCard value={detectMutation.data.stats.total_nodes} label="Total Network Nodes" />
                        <MetricCard value={`${detectMutation.data.stats.clear_pct}%`} label="City Area Cleared" sublabel="No leaks detected" gradient="green" />
                        <MetricCard value={detectMutation.data.stats.suspect_nodes} label="Suspect Nodes" sublabel="In high-prob zone" gradient="orange" />
                    </div>

                    <div className="grid grid-cols-3 gap-8 mb-8">
                        {/* Map */}
                        <div className="col-span-2 rounded-2xl border border-[var(--color-border)] overflow-hidden"
                            style={{ background: 'rgba(8,10,24,0.6)', height: '600px' }}>
                            <Plot
                                data={buildFigData()}
                                layout={{
                                    plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                                    font: { color: '#c0c8d4', size: 11 },
                                    xaxis: { showgrid: false, zeroline: false, visible: false, scaleanchor: 'y' },
                                    yaxis: { showgrid: false, zeroline: false, visible: false },
                                    margin: { l: 0, r: 0, t: 0, b: 0 },
                                    showlegend: false,
                                    dragmode: 'pan',
                                }}
                                config={{ scrollZoom: true, responsive: true, displayModeBar: false }}
                                useResizeHandler style={{ width: '100%', height: '100%' }}
                            />
                        </div>

                        {/* Dispatch Orders */}
                        <div className="flex flex-col gap-4">
                            <SectionHeader>Maintenance Dispatch</SectionHeader>
                            {detectMutation.data.work_order ? (
                                <div className="bg-[rgba(10,14,39,0.7)] border border-[rgba(255,71,87,0.4)] rounded-xl p-5 shadow-[0_0_30px_rgba(255,71,87,0.1)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff4757] opacity-[0.05] rounded-bl-full" />

                                    <div className="text-[#ff4757] font-bold mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-[#ff4757] animate-pulse"></span>
                                        Dispatch Order Generated
                                    </div>

                                    <h4 className="text-2xl font-bold mb-4 tracking-wide text-white">Zone ID: {detectMutation.data.work_order.dispatch_target}</h4>

                                    <div className="space-y-3 text-base text-[var(--color-text-dim)] flex-grow">
                                        <div className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-2">
                                            <span>AI Zone Confidence:</span>
                                            <span className="text-white font-mono">{detectMutation.data.work_order.confidence_score}%</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[rgba(255,255,255,0.05)] pb-2">
                                            <span>Est. Water Loss:</span>
                                            <span className="text-[#ffa502] font-mono">{detectMutation.data.work_order.gallons_lost_per_hour} gal/hr</span>
                                        </div>
                                        <div className="flex justify-between font-medium">
                                            <span>Economic Impact:</span>
                                            <span className="text-[#ff4757] font-mono">${detectMutation.data.work_order.cost_per_hour}/hr</span>
                                        </div>
                                    </div>

                                    <button className="mt-6 w-full py-3 bg-[rgba(255,71,87,0.15)] hover:bg-[rgba(255,71,87,0.25)] text-[#ff4757] font-bold rounded-lg transition-all border border-[rgba(255,71,87,0.4)] hover:border-[#ff4757] shadow-lg">
                                        Dispatch Repair Team →
                                    </button>
                                </div>
                            ) : (
                                <div className="text-[var(--color-text-dim)] italic p-4 bg-[rgba(255,255,255,0.02)] rounded-lg">
                                    No clear suspect zones identified with &gt;50% confidence. System healthy.
                                </div>
                            )}

                            <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.05)] text-xs text-[var(--color-text-dimmer)]">
                                Demo Details: The model injected a synthetic leak at node <span className="text-[#f1c40f] font-bold">{detectMutation.data.injected_leak}</span> behind the scenes to demonstrate detection capabilities.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
