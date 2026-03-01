import { useMemo } from 'react'
import Plot from 'react-plotly.js'

const PLOT_LAYOUT = {
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 0, r: 0, t: 0, b: 0 },
    height: 600,
    dragmode: 'pan',
    xaxis: { showgrid: false, zeroline: false, showticklabels: false, scaleanchor: 'y' },
    yaxis: { showgrid: false, zeroline: false, showticklabels: false },
    legend: {
        font: { color: '#c8d6e5', size: 11 },
        bgcolor: 'rgba(10,14,39,0.8)',
        bordercolor: 'rgba(79,172,254,0.2)',
        borderwidth: 1,
        x: 0.01, y: 0.99,
    },
    uirevision: 'true',
}

export default function NetworkMap({ network, predictions, groundTruth, showGt = true, showPred = true }) {

    const { plotData, plotShapes } = useMemo(() => {
        if (!network) return { plotData: [], plotShapes: [] }

        const data = []
        const shapes = []

        // Pipes using layout shapes (highly performant for static SVG lines)
        for (const link of network.links) {
            shapes.push({
                type: 'line',
                x0: link.start_x,
                y0: link.start_y,
                x1: link.end_x,
                y1: link.end_y,
                line: {
                    color: 'rgba(0,0,150,0.4)',
                    width: 1.0
                }
            })
        }

        // Nodes using standard scatter (SVG)
        data.push({
            x: network.nodes.map(n => n.x),
            y: network.nodes.map(n => n.y),
            mode: 'markers',
            marker: { size: 3, color: 'rgba(0,0,150,0.4)' },
            text: network.nodes.map(n => n.id),
            hoverinfo: 'text', name: 'Network Nodes', showlegend: true, type: 'scatter',
        })

        // Ground truth leaks
        if (showGt && groundTruth?.leaks?.length) {
            data.push({
                x: groundTruth.leaks.map(l => l.x),
                y: groundTruth.leaks.map(l => l.y),
                mode: 'markers',
                marker: { size: 12, color: '#ff4757', symbol: 'x', line: { width: 2, color: '#ff6b81' } },
                text: groundTruth.leaks.map(l => `Ground Truth: ${l.pipe_id}`),
                hoverinfo: 'text', name: 'Ground Truth Leaks', showlegend: true, type: 'scatter',
            })
        }

        // Predicted leaks
        if (showPred && predictions?.length) {
            const validPreds = predictions.filter(p => p.gps_coordinates)

            // 1. Heatmap layer (draw first so it renders underneath)
            for (const p of validPreds) {
                if (p.heatmap) {
                    p.heatmap.forEach(h => {
                        data.push({
                            x: [h.x], y: [h.y], mode: 'markers',
                            marker: {
                                size: (h.weight * 120) + 30,
                                color: [h.weight],
                                colorscale: 'Turbo',
                                cmin: 0, cmax: 1,
                                line: { width: 0 },
                                opacity: 0.8
                            },
                            hoverinfo: 'text', text: `IDW Probability: ${(h.weight * 100).toFixed(1)}%`,
                            name: 'Probability Heatmap', showlegend: false, type: 'scatter'
                        })
                    })
                }
            }

            const maxSev = Math.max(...validPreds.map(p => p.estimated_cusum_severity), 1)
            data.push({
                x: validPreds.map(p => p.gps_coordinates[0]),
                y: validPreds.map(p => p.gps_coordinates[1]),
                mode: 'markers',
                marker: {
                    size: validPreds.map(p => Math.max(10, (p.estimated_cusum_severity / maxSev) * 28)),
                    color: validPreds.map(p => p.estimated_cusum_severity),
                    colorscale: 'Turbo',
                    cmin: 0, cmax: maxSev,
                    showscale: true,
                    colorbar: { title: 'Severity', tickfont: { color: '#c8d6e5' }, titlefont: { color: '#c8d6e5' } },
                    line: { width: 1.5, color: 'rgba(255,255,255,0.3)' },
                    opacity: 0.9,
                },
                text: validPreds.map(p =>
                    `Node: ${p.detected_node}<br>Time: ${p.estimated_start_time}<br>Severity: ${p.estimated_cusum_severity.toFixed(2)}`
                ),
                hoverinfo: 'text', name: 'Predicted Leaks', showlegend: true, type: 'scatter',
            })
        }

        return { plotData: data, plotShapes: shapes }
    }, [network, predictions, groundTruth, showGt, showPred])

    if (!network) return null

    return (
        <Plot
            data={plotData}
            layout={{ ...PLOT_LAYOUT, shapes: plotShapes }}
            config={{ scrollZoom: true, responsive: true, displayModeBar: false }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
        />
    )
}
