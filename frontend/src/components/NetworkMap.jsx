import { useRef, useEffect, useState, useCallback } from 'react'

export default function NetworkMap({ network }) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
    const [hoveredNode, setHoveredNode] = useState(null)
    const isDragging = useRef(false)
    const lastMouse = useRef({ x: 0, y: 0 })

    // Compute bounds from network data
    const getBounds = useCallback(() => {
        if (!network?.nodes?.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const node of network.nodes) {
            minX = Math.min(minX, node.x)
            maxX = Math.max(maxX, node.x)
            minY = Math.min(minY, node.y)
            maxY = Math.max(maxY, node.y)
        }
        const padX = (maxX - minX) * 0.05 || 1
        const padY = (maxY - minY) * 0.05 || 1
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY }
    }, [network])

    // World coords to canvas coords
    const toCanvas = useCallback((wx, wy, bounds, width, height, tf) => {
        const scaleX = width / (bounds.maxX - bounds.minX)
        const scaleY = height / (bounds.maxY - bounds.minY)
        const s = Math.min(scaleX, scaleY) * 0.9
        const cx = width / 2
        const cy = height / 2
        const mx = (bounds.minX + bounds.maxX) / 2
        const my = (bounds.minY + bounds.maxY) / 2

        return {
            x: (wx - mx) * s * tf.scale + cx + tf.x,
            y: -(wy - my) * s * tf.scale + cy + tf.y,  // flip Y
        }
    }, [])

    // Draw the network
    useEffect(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container || !network) return

        const rect = container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`

        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, rect.width, rect.height)

        const bounds = getBounds()
        const nodeMap = {}
        for (const node of network.nodes) {
            nodeMap[node.id] = node
        }

        // Draw edges (pipes)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#3f3f46'
        ctx.beginPath()
        for (const edge of network.edges) {
            const start = nodeMap[edge.start_node]
            const end = nodeMap[edge.end_node]
            if (!start || !end) continue

            const p1 = toCanvas(start.x, start.y, bounds, rect.width, rect.height, transform)
            const p2 = toCanvas(end.x, end.y, bounds, rect.width, rect.height, transform)
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
        }
        ctx.stroke()

        // Draw nodes
        for (const node of network.nodes) {
            const p = toCanvas(node.x, node.y, bounds, rect.width, rect.height, transform)
            const isHovered = hoveredNode === node.id

            if (node.type === 'reservoir') {
                ctx.fillStyle = '#3b82f6'
                ctx.beginPath()
                ctx.arc(p.x, p.y, isHovered ? 8 : 6, 0, Math.PI * 2)
                ctx.fill()
            } else if (node.type === 'tank') {
                ctx.fillStyle = '#8b5cf6'
                ctx.beginPath()
                ctx.arc(p.x, p.y, isHovered ? 7 : 5, 0, Math.PI * 2)
                ctx.fill()
            } else {
                ctx.fillStyle = isHovered ? '#06b6d4' : '#52525b'
                ctx.beginPath()
                ctx.arc(p.x, p.y, isHovered ? 4 : 2, 0, Math.PI * 2)
                ctx.fill()
            }
        }

        // Draw hovered node label
        if (hoveredNode) {
            const node = nodeMap[hoveredNode]
            if (node) {
                const p = toCanvas(node.x, node.y, bounds, rect.width, rect.height, transform)
                ctx.font = '11px Inter, system-ui, sans-serif'
                ctx.fillStyle = '#fafafa'
                ctx.textAlign = 'left'
                ctx.fillText(`${node.id} (elev: ${node.elevation?.toFixed(1)}m)`, p.x + 10, p.y - 5)
            }
        }
    }, [network, transform, hoveredNode, getBounds, toCanvas])

    // Mouse handlers for pan and hover
    const handleMouseDown = (e) => {
        isDragging.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current
        if (!canvas || !network) return

        if (isDragging.current) {
            const dx = e.clientX - lastMouse.current.x
            const dy = e.clientY - lastMouse.current.y
            lastMouse.current = { x: e.clientX, y: e.clientY }
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
            return
        }

        // Hit test for hover
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const bounds = getBounds()

        let closest = null
        let closestDist = 20 // max distance in pixels

        for (const node of network.nodes) {
            const p = toCanvas(node.x, node.y, bounds, rect.width, rect.height, transform)
            const dist = Math.hypot(p.x - mx, p.y - my)
            if (dist < closestDist) {
                closest = node.id
                closestDist = dist
            }
        }
        setHoveredNode(closest)
    }

    const handleMouseUp = () => {
        isDragging.current = false
    }

    const handleWheel = (e) => {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        setTransform(prev => ({
            ...prev,
            scale: Math.max(0.1, Math.min(10, prev.scale * factor)),
        }))
    }

    // Resize observer
    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const observer = new ResizeObserver(() => {
            setTransform(prev => ({ ...prev })) // trigger re-render
        })
        observer.observe(container)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={containerRef} className="absolute inset-0"
            style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            />

            {/* Map controls overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <button
                    onClick={() => setTransform(prev => ({ ...prev, scale: prev.scale * 1.3 }))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold cursor-pointer border transition-colors"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                    }}
                >+</button>
                <button
                    onClick={() => setTransform(prev => ({ ...prev, scale: prev.scale * 0.7 }))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold cursor-pointer border transition-colors"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                    }}
                >−</button>
                <button
                    onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer border transition-colors"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                    }}
                >⟲</button>
            </div>

            {/* Legend */}
            <div className="absolute top-4 right-4 px-4 py-3 rounded-xl border"
                style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Legend</p>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-zinc-500"></span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Junction</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Reservoir</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-violet-500"></span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Tank</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-0.5 bg-zinc-600 rounded"></span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Pipe</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
