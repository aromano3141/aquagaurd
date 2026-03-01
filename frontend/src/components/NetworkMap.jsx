import { useMemo } from 'react'
import Plot from 'react-plotly.js'

export default function NetworkMap({ network, predictions, groundTruth, showGt = true, showPred = true }) {

    const plotData = useMemo(() => {
        if (!network) return []
        const data = []

        // Create node lookup map for faster pipe rendering
        const nodeMap = {}
        for (const n of network.nodes) {
            nodeMap[n.id] = n
        }

        // ── Pipes (batched into single trace) ──
        const pipeX = [], pipeY = [], pipeZ = []
        for (const link of network.links) {
            pipeX.push(link.start_x, link.end_x, null)
            pipeY.push(link.start_y, link.end_y, null)
            pipeZ.push(0, 0, null)
        }
        data.push({
            x: pipeX, y: pipeY, z: pipeZ, mode: 'lines',
            line: { width: 1.5, color: 'rgba(79,172,254,0.30)' },
            hoverinfo: 'none', showlegend: false, type: 'scatter3d', connectgaps: false,
        })

        // ── Junctions ──
        data.push({
            x: network.nodes.map(n => n.x), y: network.nodes.map(n => n.y),
            z: network.nodes.map(() => 0), mode: 'markers',
            marker: { size: 1.5, color: 'rgba(79,172,254,0.4)' },
            text: network.nodes.map(n => n.id), hoverinfo: 'text',
            name: 'Junctions', showlegend: false, type: 'scatter3d',
        })

        // ── Ground Truth Leaks ──
        if (showGt && groundTruth?.leaks?.length) {
            data.push({
                x: groundTruth.leaks.map(l => l.x),
                y: groundTruth.leaks.map(l => l.y),
                z: groundTruth.leaks.map(() => 0.3), mode: 'markers',
                marker: { size: 8, color: '#ff4757', symbol: 'circle', line: { width: 2, color: '#ff6b81' } },
                text: groundTruth.leaks.map(l => `Ground Truth: ${l.pipe_id}`), hoverinfo: 'text',
                name: 'Ground Truth Leaks', type: 'scatter3d',
            })
        }

        // ── Simulation Results / Predictions ──
        if (showPred && predictions?.length) {
            const hx = [], hy = [], hz = [], hColor = [], hSize = [], hText = []
            const pillarX = [], pillarY = [], pillarZ = []

            const validPreds = predictions.filter(p => p.gps_coordinates)

            for (const p of validPreds) {
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
                x: validPreds.map(p => p.gps_coordinates[0]), y: validPreds.map(p => p.gps_coordinates[1]),
                z: validPreds.map(() => 0.5), mode: 'markers',
                marker: { size: 10, color: '#2ed573', symbol: 'diamond', line: { width: 1, color: '#7bed9f' } },
                text: validPreds.map(p =>
                    `Prediction Node: ${p.detected_node}<br>Time: ${p.estimated_start_time}<br>Severity: ${p.estimated_cusum_severity.toFixed(2)}`
                ),
                hoverinfo: 'text', name: 'AI Predictions', type: 'scatter3d',
            })

        }

        return data
    }, [network, predictions, groundTruth, showGt, showPred])

    if (!network) return null

    return (
        <Plot
            data={plotData}
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
            useResizeHandler style={{ width: '100%', height: '100%' }}
        />
    )
}

