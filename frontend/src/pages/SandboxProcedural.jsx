import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import Plot from 'react-plotly.js'
import { generateSandbox, simulateSandbox, loadInpNetwork, uploadNetwork, dispatchAudio } from '../api/client'
import MetricCard from '../components/MetricCard'
import { Blocks, Globe, Settings2, Droplets, Upload, Play, Loader2, Volume2, DollarSign, TrendingUp, Lightbulb } from 'lucide-react'

const SAMPLE_NETWORKS = ['Net1.inp', 'Net2.inp', 'Net3.inp', 'Anytown.inp', 'Net6.inp']

export default function SandboxProcedural() {
    // ── Mode: 'procedural' or 'real' ──
    const [mode, setMode] = useState('procedural')

    // Procedural params
    const [rows, setRows] = useState(6)
    const [cols, setCols] = useState(8)
    const [nSensors, setNSensors] = useState(5)
    const [density, setDensity] = useState(0.3)

    // Real network params
    const [selectedFile, setSelectedFile] = useState('Net3.inp')
    const [realSensors, setRealSensors] = useState(8)
    const [uploading, setUploading] = useState(false)

    // Shared
    const [selectedLeaks, setSelectedLeaks] = useState([])
    const [dispatching, setDispatching] = useState({})

    // Savings estimator params
    const [savWaterCost, setSavWaterCost] = useState(3.50)
    const [savRepairCost, setSavRepairCost] = useState(8500)
    const [savSpeedup, setSavSpeedup] = useState(7)

    const handleDispatch = async (nodeId) => {
        try {
            setDispatching(prev => ({ ...prev, [nodeId]: true }))
            const audioUrl = await dispatchAudio(nodeId)
            const audio = new Audio(audioUrl)

            audio.onended = () => {
                URL.revokeObjectURL(audioUrl)
                setDispatching(prev => ({ ...prev, [nodeId]: false }))
            }
            audio.onerror = () => {
                setDispatching(prev => ({ ...prev, [nodeId]: false }))
            }

            await audio.play()
        } catch (err) {
            console.error("Audio playback failed:", err)
            alert("Dispatch failed: " + err.message)
            setDispatching(prev => ({ ...prev, [nodeId]: false }))
        }
    }

    // ── Queries ──
    const proceduralQuery = useQuery({
        queryKey: ['sandbox', rows, cols, nSensors, density],
        queryFn: () => generateSandbox(rows, cols, nSensors, density),
        enabled: mode === 'procedural',
    })

    const realQuery = useQuery({
        queryKey: ['sandbox-inp', selectedFile, realSensors],
        queryFn: () => loadInpNetwork(selectedFile, realSensors),
        enabled: mode === 'real',
    })

    const network = mode === 'procedural' ? proceduralQuery.data : realQuery.data

    const simMutation = useMutation({
        mutationFn: () => simulateSandbox({
            leak_pipes: selectedLeaks,
            rows, cols, sensors: mode === 'procedural' ? nSensors : realSensors, density,
            ...(mode === 'real' ? { filename: selectedFile } : {}),
        }),
    })

    const nodeMap = {}
    network?.nodes?.forEach(n => { nodeMap[n.id] = n })

    const toggleLeak = (pid) => {
        setSelectedLeaks(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])
        simMutation.reset()
    }

    const switchMode = (newMode) => {
        setMode(newMode)
        setSelectedLeaks([])
        simMutation.reset()
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setUploading(true)
            const res = await uploadNetwork(file)
            setSelectedFile(res.filename)
            setMode('real')
            setSelectedLeaks([])
            simMutation.reset()
        } catch (err) {
            alert('Failed to upload: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    const buildFigData = () => {
        if (!network) return []
        const data = []

        // ── Pipes (batched into single trace) ──
        const pipeX = [], pipeY = [], pipeZ = []
        for (const pipe of network.pipes) {
            const n1 = nodeMap[pipe.start], n2 = nodeMap[pipe.end]
            if (!n1 || !n2) continue
            const isLeak = selectedLeaks.includes(pipe.id)
            if (isLeak) {
                data.push({
                    x: [n1.x, n2.x], y: [n1.y, n2.y], z: [0, 0], mode: 'lines',
                    line: { width: 6, color: '#ff4757' },
                    hoverinfo: 'text', text: pipe.id, showlegend: false, type: 'scatter3d',
                })
            } else {
                pipeX.push(n1.x, n2.x, null)
                pipeY.push(n1.y, n2.y, null)
                pipeZ.push(0, 0, null)
            }
        }
        data.push({
            x: pipeX, y: pipeY, z: pipeZ, mode: 'lines',
            line: { width: 2.5, color: 'rgba(79,172,254,0.35)' },
            hoverinfo: 'none', showlegend: false, type: 'scatter3d', connectgaps: false,
        })

        // ── Junctions ──
        data.push({
            x: network.nodes.map(n => n.x), y: network.nodes.map(n => n.y),
            z: network.nodes.map(() => 0), mode: 'markers',
            marker: { size: 2.5, color: 'rgba(79,172,254,0.4)' },
            text: network.nodes.map(n => n.id), hoverinfo: 'text',
            name: 'Junctions', type: 'scatter3d',
        })

        // ── Sensors ──
        const sCoords = network.sensors.map(s => nodeMap[s]).filter(Boolean)
        data.push({
            x: sCoords.map(n => n.x), y: sCoords.map(n => n.y),
            z: sCoords.map(() => 0.15), mode: 'markers',
            marker: { size: 5, color: '#00f2fe', symbol: 'diamond', line: { width: 1, color: '#4facfe' } },
            text: network.sensors.map(s => `Sensor: ${s}`), hoverinfo: 'text',
            name: 'Sensors', type: 'scatter3d',
        })

        // ── Placed Leak Markers ──
        if (selectedLeaks.length > 0) {
            const leakCoords = selectedLeaks.map(pid => {
                const p = network.pipes.find(pp => pp.id === pid)
                if (!p) return null
                const n1 = nodeMap[p.start], n2 = nodeMap[p.end]
                return n1 && n2 ? { id: pid, x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 } : null
            }).filter(Boolean)
            data.push({
                x: leakCoords.map(l => l.x), y: leakCoords.map(l => l.y),
                z: leakCoords.map(() => 0.3), mode: 'markers',
                marker: { size: 10, color: '#ff4757', symbol: 'circle', line: { width: 2, color: '#ff6b81' } },
                text: leakCoords.map(l => `Leak: ${l.id}`), hoverinfo: 'text',
                name: 'Placed Leaks', type: 'scatter3d',
            })
        }

        // ── Simulation Results ──
        if (simMutation.data?.predictions) {
            const preds = simMutation.data.predictions
            const hx = [], hy = [], hz = [], hColor = [], hSize = [], hText = []
            const pillarX = [], pillarY = [], pillarZ = []

            for (const p of preds) {
                if (p.heatmap) {
                    p.heatmap.forEach(h => {
                        const zHeight = h.weight * 6
                        hx.push(h.x); hy.push(h.y); hz.push(zHeight)
                        hColor.push(h.weight)
                        hSize.push((h.weight * 25) + 8)
                        hText.push(`IDW Probability: ${(h.weight * 100).toFixed(1)}%`)
                        pillarX.push(h.x, h.x, null)
                        pillarY.push(h.y, h.y, null)
                        pillarZ.push(0, zHeight, null)
                    })
                }
            }

            if (hx.length > 0) {
                data.push({
                    x: pillarX, y: pillarY, z: pillarZ, mode: 'lines',
                    line: { width: 3, color: 'rgba(79,172,254,0.15)' },
                    showlegend: false, hoverinfo: 'none', type: 'scatter3d', connectgaps: false,
                })
                data.push({
                    x: hx, y: hy, z: hz, mode: 'markers',
                    marker: {
                        size: hSize, color: hColor,
                        colorscale: 'Turbo', cmin: 0, cmax: 1,
                        showscale: true,
                        colorbar: {
                            title: { text: 'Probability', font: { color: '#c8d6e5', size: 12 } },
                            tickfont: { color: '#c8d6e5', size: 10 },
                            len: 0.5, thickness: 12, x: 1.02,
                            bgcolor: 'rgba(0,0,0,0.3)',
                            bordercolor: 'rgba(79,172,254,0.2)', borderwidth: 1,
                        },
                        line: { width: 0 }, opacity: 0.9,
                    },
                    hoverinfo: 'text', text: hText,
                    name: 'Leak Probability', showlegend: false, type: 'scatter3d',
                })
            }

            // Prediction stars
            data.push({
                x: preds.map(p => p.pred_x), y: preds.map(p => p.pred_y),
                z: preds.map(() => 0.5), mode: 'markers',
                marker: { size: 10, color: '#2ed573', symbol: 'diamond', line: { width: 1, color: '#7bed9f' } },
                text: preds.map(p => `Prediction: ${p.pipe}\nError: ${p.error}m`),
                hoverinfo: 'text', name: 'AI Predictions', type: 'scatter3d',
            })

            const errX = [], errY = [], errZ = []
            for (const p of preds) {
                errX.push(p.true_x, p.pred_x, null)
                errY.push(p.true_y, p.pred_y, null)
                errZ.push(0.2, 0.5, null)
            }
            data.push({
                x: errX, y: errY, z: errZ, mode: 'lines',
                line: { width: 3, color: '#ffa502', dash: 'dash' },
                showlegend: false, hoverinfo: 'none', type: 'scatter3d', connectgaps: false,
            })
        }

        return data
    }

    const sliders = [
        ['Grid Rows', rows, setRows, 3, 15],
        ['Grid Columns', cols, setCols, 3, 15],
        ['Sensors', nSensors, setNSensors, 2, 50],
    ]

    return (
        <div className="flex gap-6">
            {/* ── Left Control Panel ── */}
            <div className="w-72 flex-shrink-0 space-y-4">
                {/* Mode Toggle */}
                <div className="flex bg-[rgba(10,14,39,0.8)] border border-[var(--color-border)] rounded-lg p-1">
                    <button onClick={() => switchMode('procedural')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-md transition-all ${mode === 'procedural'
                            ? 'bg-[var(--color-accent)] text-white shadow-md'
                            : 'text-[var(--color-text-dim)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}`}>
                        <Blocks className="w-4 h-4" /> Procedural
                    </button>
                    <button onClick={() => switchMode('real')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-md transition-all ${mode === 'real'
                            ? 'bg-[var(--color-accent)] text-white shadow-md'
                            : 'text-[var(--color-text-dim)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}`}>
                        <Globe className="w-4 h-4" /> Real Network
                    </button>
                </div>

                {/* Mode-specific controls */}
                {mode === 'procedural' ? (
                    <div className="bg-[rgba(10,14,39,0.6)] border border-[var(--color-border)] rounded-xl p-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] mb-3"><Settings2 className="w-4 h-4" /> Network Parameters</h3>
                        <div className="space-y-3">
                            {sliders.map(([label, val, setter, min, max]) => (
                                <div key={label}>
                                    <div className="flex justify-between text-xs text-[var(--color-text-dim)] mb-1">
                                        <span>{label}</span><span className="font-mono text-white">{val}</span>
                                    </div>
                                    <input type="range" min={min} max={max} value={val} onChange={e => setter(Number(e.target.value))}
                                        className="w-full accent-[var(--color-accent)] h-1" />
                                </div>
                            ))}
                            <div>
                                <div className="flex justify-between text-xs text-[var(--color-text-dim)] mb-1">
                                    <span>Pipe Density</span><span className="font-mono text-white">{(density * 100).toFixed(0)}%</span>
                                </div>
                                <input type="range" min={0} max={1} step={0.1} value={density} onChange={e => setDensity(Number(e.target.value))}
                                    className="w-full accent-[var(--color-accent)] h-1" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[rgba(10,14,39,0.6)] border border-[var(--color-border)] rounded-xl p-4">
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] mb-3"><Globe className="w-4 h-4" /> Real Network</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-[var(--color-text-dim)] block mb-1">Sample City</label>
                                <select value={selectedFile} onChange={e => { setSelectedFile(e.target.value); setSelectedLeaks([]); simMutation.reset() }}
                                    className="w-full bg-[rgba(8,10,24,0.8)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors">
                                    {SAMPLE_NETWORKS.map(net => <option key={net} value={net}>{net}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-[var(--color-text-dim)] mb-1">
                                    <span>Sensors</span><span className="font-mono text-white">{realSensors}</span>
                                </div>
                                <input type="range" min={2} max={30} value={realSensors} onChange={e => setRealSensors(Number(e.target.value))}
                                    className="w-full accent-[var(--color-accent)] h-1" />
                            </div>

                            <div className="flex items-center gap-2 py-1">
                                <div className="h-px bg-[rgba(255,255,255,0.1)] flex-grow"></div>
                                <span className="text-[var(--color-text-dimmer)] text-[10px] uppercase font-bold tracking-wider">or</span>
                                <div className="h-px bg-[rgba(255,255,255,0.1)] flex-grow"></div>
                            </div>

                            <label className="flex items-center justify-center gap-2 w-full h-12 border border-dashed border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:bg-[rgba(79,172,254,0.05)] cursor-pointer transition-colors text-xs text-[var(--color-text-dim)]">
                                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload .inp File</>}
                                <input type="file" accept=".inp" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                            </label>
                        </div>
                    </div>
                )}

                {/* Leak Placement */}
                <div className="bg-[rgba(10,14,39,0.6)] border border-[var(--color-border)] rounded-xl p-4">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#ff4757] mb-3"><Droplets className="w-4 h-4" /> Place Leaks</h3>
                    <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                        {network?.pipes?.map(p => (
                            <button key={p.id} onClick={() => toggleLeak(p.id)}
                                className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${selectedLeaks.includes(p.id)
                                    ? 'bg-[rgba(255,71,87,0.25)] text-[#ff4757] border border-[#ff4757] font-bold'
                                    : 'text-[var(--color-text-dimmer)] border border-[var(--color-border)] hover:border-[var(--color-accent)]'
                                    }`}>{p.id}</button>
                        ))}
                    </div>
                    {realQuery.isLoading && mode === 'real' && (
                        <div className="text-xs text-[var(--color-text-dim)] mt-2 animate-pulse">Loading network...</div>
                    )}
                </div>

                {/* Quick Metrics */}
                <div className="space-y-2">
                    <MetricCard value={network?.nodes?.length ?? 0} label="Junctions"
                        sublabel={mode === 'procedural' ? `${rows}×${cols} grid` : selectedFile} />
                    <MetricCard value={network?.pipes?.length ?? 0} label="Pipes" />
                    <MetricCard value={selectedLeaks.length} label="Active Leaks" sublabel="Placed by user"
                        gradient={selectedLeaks.length > 0 ? 'red' : undefined} />
                </div>

                {/* Run Button */}
                <button onClick={() => simMutation.mutate()}
                    disabled={selectedLeaks.length === 0 || simMutation.isPending}
                    className="w-full flex justify-center items-center gap-2 py-3.5 rounded-xl font-bold text-white transition-all text-sm
                       bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-end)]
                       hover:shadow-[0_4px_25px_rgba(79,172,254,0.4)]
                       disabled:opacity-30 disabled:cursor-not-allowed">
                    {simMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</> : <><Play className="w-5 h-5 fill-current" /> Run Detection</>}
                </button>
            </div>

            {/* ── Right: 3D Map + Results ── */}
            <div className="flex-1 min-w-0 space-y-5">
                <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden"
                    style={{ background: '#000000' }}>
                    <Plot
                        data={buildFigData()}
                        layout={{
                            plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#c0c8d4', size: 11 },
                            scene: {
                                bgcolor: '#000000',
                                xaxis: { showgrid: true, gridcolor: 'rgba(79,172,254,0.06)', zeroline: false, showticklabels: false, title: '' },
                                yaxis: { showgrid: true, gridcolor: 'rgba(79,172,254,0.06)', zeroline: false, showticklabels: false, title: '' },
                                zaxis: { showgrid: false, zeroline: false, visible: false, range: [0, 7] },
                                camera: { eye: { x: 1.4, y: -1.4, z: 0.9 }, center: { x: 0, y: 0, z: -0.15 } },
                                aspectmode: 'manual', aspectratio: { x: 1.2, y: 1, z: 0.5 },
                            },
                            height: 700, margin: { l: 0, r: 0, t: 0, b: 0 },
                            legend: {
                                bgcolor: 'rgba(10,14,39,0.85)', bordercolor: 'rgba(79,172,254,0.15)',
                                borderwidth: 1, x: 0.01, y: 0.99,
                                font: { size: 10, color: '#c8d6e5' },
                            },
                        }}
                        config={{ scrollZoom: true, responsive: true, displayModeBar: false }}
                        useResizeHandler style={{ width: '100%' }}
                    />
                </div>

                {/* Results */}
                {simMutation.data && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-3 gap-4 mb-5">
                            <MetricCard value={`${simMutation.data.mean_error}m`} label="Mean Error"
                                gradient={simMutation.data.mean_error < 50 ? 'green' : simMutation.data.mean_error < 100 ? 'orange' : 'red'} />
                            <MetricCard value={`${simMutation.data.max_error}m`} label="Max Error" />
                            <MetricCard value={`${simMutation.data.accuracy_pct}%`} label="Accuracy" sublabel="Within 50m threshold" />
                        </div>

                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#ff4757] mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#ff4757] animate-pulse"></span>
                            Maintenance Dispatch Orders
                        </h3>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {simMutation.data.predictions.map((p, i) => (
                                <div key={i} className="bg-[rgba(10,14,39,0.7)] border border-[rgba(255,71,87,0.3)] rounded-xl p-4 flex flex-col relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-[#ff4757] opacity-[0.04] rounded-bl-full" />
                                    <h4 className="text-lg font-bold mb-2 tracking-wide">Target: {p.work_order?.dispatch_target || `Pipe ${p.pipe}`}</h4>
                                    <div className="space-y-1.5 text-sm text-[var(--color-text-dim)] flex-grow">
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
                                    <button
                                        onClick={() => handleDispatch(p.work_order?.dispatch_target || p.pipe)}
                                        disabled={dispatching[p.work_order?.dispatch_target || p.pipe]}
                                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-[rgba(255,71,87,0.1)] hover:bg-[rgba(255,71,87,0.2)] text-[#ff4757] font-semibold text-xs rounded-lg transition-colors border border-[rgba(255,71,87,0.3)] hover:border-[#ff4757] disabled:opacity-50 disabled:cursor-wait">
                                        {dispatching[p.work_order?.dispatch_target || p.pipe] ? (
                                            <>
                                                <Volume2 className="w-4 h-4 animate-pulse" />
                                                Generating & Playing Dispatch...
                                            </>
                                        ) : (
                                            <>
                                                <Volume2 className="w-4 h-4" />
                                                Voice Dispatch Repair Team →
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* ── Savings Estimator ── */}
                        <div className="mt-8 bg-[rgba(10,14,39,0.6)] border border-[rgba(46,213,115,0.25)] rounded-2xl p-6">
                            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2ed573] mb-4">
                                <DollarSign className="w-4 h-4" /> Savings Estimator
                            </h3>

                            {/* Tweakable Parameters */}
                            <div className="grid grid-cols-3 gap-4 mb-5">
                                <div>
                                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Water Cost ($/m³)</label>
                                    <input type="number" value={savWaterCost} step={0.25} min={0.5} max={20}
                                        onChange={e => setSavWaterCost(Number(e.target.value))}
                                        className="w-full bg-[rgba(8,10,24,0.9)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ed573] transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Avg Repair Cost ($/leak)</label>
                                    <input type="number" value={savRepairCost} step={500} min={1000} max={100000}
                                        onChange={e => setSavRepairCost(Number(e.target.value))}
                                        className="w-full bg-[rgba(8,10,24,0.9)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2ed573] transition-colors" />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-dim)] block mb-1">Early Detection: {savSpeedup} days</label>
                                    <input type="range" min={1} max={30} value={savSpeedup}
                                        onChange={e => setSavSpeedup(Number(e.target.value))}
                                        className="w-full accent-[#2ed573] mt-2" />
                                </div>
                            </div>

                            {/* Computed Savings */}
                            {(() => {
                                const preds = simMutation.data.predictions
                                const numLeaks = preds.length
                                const avgGalPerHr = preds.reduce((s, p) => s + (p.work_order?.gallons_lost_per_hour || 50), 0) / Math.max(numLeaks, 1)
                                const totalGalSaved = avgGalPerHr * 24 * savSpeedup * numLeaks
                                const totalM3Saved = (totalGalSaved * 0.00378541).toFixed(0)
                                const waterCostSaved = (totalM3Saved * savWaterCost).toFixed(0)
                                const repairSavings = (numLeaks * savRepairCost * 0.15).toFixed(0)
                                const totalSavings = (Number(waterCostSaved) + Number(repairSavings)).toLocaleString()

                                return (
                                    <>
                                        <div className="grid grid-cols-4 gap-3 mb-4">
                                            <MetricCard value={numLeaks} label="Leaks Detected" sublabel="In this simulation" />
                                            <MetricCard value={`${Number(totalM3Saved).toLocaleString()} m³`} label="Water Saved" sublabel={`${savSpeedup}-day early detection`} gradient="green" />
                                            <MetricCard value={`$${Number(waterCostSaved).toLocaleString()}`} label="Water Cost Saved" sublabel={`At $${savWaterCost}/m³`} gradient="green" />
                                            <MetricCard value={`$${totalSavings}`} label="Total Estimated Savings" sublabel="Water + reduced repair" gradient="orange" />
                                        </div>

                                        {/* Per-leak breakdown */}
                                        <div className="space-y-2">
                                            {preds.map((p, i) => {
                                                const galHr = p.work_order?.gallons_lost_per_hour || 50
                                                const galSaved = galHr * 24 * savSpeedup
                                                const m3Saved = (galSaved * 0.00378541).toFixed(1)
                                                const costSaved = (m3Saved * savWaterCost).toFixed(0)
                                                return (
                                                    <div key={i} className="flex items-center justify-between bg-[rgba(8,10,24,0.5)] rounded-lg px-4 py-2.5 border border-[rgba(46,213,115,0.1)]">
                                                        <div className="flex items-center gap-3">
                                                            <TrendingUp className="w-4 h-4 text-[#2ed573]" />
                                                            <span className="text-sm font-medium">{p.work_order?.dispatch_target || `Pipe ${p.pipe}`}</span>
                                                        </div>
                                                        <div className="flex items-center gap-6 text-xs text-[var(--color-text-dim)]">
                                                            <span>{galHr} gal/hr loss</span>
                                                            <span className="text-[#2ed573] font-mono font-semibold">{Number(m3Saved).toLocaleString()} m³ saved</span>
                                                            <span className="text-[#ffa502] font-mono font-semibold">${Number(costSaved).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        <div className="mt-4 p-3 rounded-lg border border-[rgba(79,172,254,0.15)] bg-[rgba(79,172,254,0.05)]">
                                            <p className="flex text-xs text-[var(--color-text-dim)] leading-relaxed">
                                                <Lightbulb className="w-4 h-4 mr-2 text-yellow-400 flex-shrink-0 mt-0.5" />
                                                <span>Detecting these {numLeaks} leak(s) <strong>{savSpeedup} days earlier</strong> could save <strong>{Number(totalM3Saved).toLocaleString()} m³</strong> of water worth <strong>${Number(waterCostSaved).toLocaleString()}</strong>, plus <strong>${Number(repairSavings).toLocaleString()}</strong> in reduced emergency repair costs.</span>
                                            </p>
                                        </div>
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
