import { useRef, useEffect, useState, useCallback } from 'react'

export default function NetworkMap({ network }) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
    const [hoveredNode, setHoveredNode] = useState(null)
    const isDragging = useRef(false)
    const lastMouse = useRef({ x: 0, y: 0 })

    const getBounds = useCallback(() => {
        if (!network?.nodes?.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (const node of network.nodes) {
            minX = Math.min(minX, node.x)
            maxX = Math.max(maxX, node.x)
            minY = Math.min(minY, node.y)
            maxY = Math.max(maxY, node.y)
        }
        const padX = (maxX - minX) * 0.08 || 1
        const padY = (maxY - minY) * 0.08 || 1
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY }
    }, [network])

    const toCanvas = useCallback((wx, wy, bounds, width, height, tf) => {
        const scaleX = width / (bounds.maxX - bounds.minX)
        const scaleY = height / (bounds.maxY - bounds.minY)
        const s = Math.min(scaleX, scaleY) * 0.85
        const cx = width / 2
        const cy = height / 2
        const mx = (bounds.minX + bounds.maxX) / 2
        const my = (bounds.minY + bounds.maxY) / 2
        return {
            x: (wx - mx) * s * tf.scale + cx + tf.x,
            y: -(wy - my) * s * tf.scale + cy + tf.y,
        }
    }, [])

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

        // Dark background
        ctx.fillStyle = '#050507'
        ctx.fillRect(0, 0, rect.width, rect.height)

        // Subtle radial gradient in center
        const gradient = ctx.createRadialGradient(
            rect.width / 2, rect.height / 2, 0,
            rect.width / 2, rect.height / 2, Math.max(rect.width, rect.height) * 0.6
        )
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.02)')
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, rect.width, rect.height)

        const bounds = getBounds()
        const nodeMap = {}
        for (const node of network.nodes) {
            nodeMap[node.id] = node
        }

        // Draw pipes with subtle gradient
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(90, 90, 130, 0.35)'
        ctx.lineCap = 'round'
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

        // Draw junction nodes
        for (const node of network.nodes) {
            const p = toCanvas(node.x, node.y, bounds, rect.width, rect.height, transform)
            const isHovered = hoveredNode === node.id

            if (node.type === 'reservoir') {
                // Reservoir: bright blue with glow
                if (isHovered) {
                    ctx.shadowColor = '#3b82f6'
                    ctx.shadowBlur = 12
                }
                ctx.fillStyle = '#3b82f6'
                ctx.beginPath()
                ctx.arc(p.x, p.y, isHovered ? 8 : 6, 0, Math.PI * 2)
                ctx.fill()
                ctx.shadowBlur = 0

                // Ring
                ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2)
                ctx.stroke()
            } else if (node.type === 'tank') {
                if (isHovered) {
                    ctx.shadowColor = '#8b5cf6'
                    ctx.shadowBlur = 12
                }
                ctx.fillStyle = '#8b5cf6'
                ctx.beginPath()
                ctx.arc(p.x, p.y, isHovered ? 7 : 5, 0, Math.PI * 2)
                ctx.fill()
                ctx.shadowBlur = 0
            } else {
                // Junction: subtle dot
                ctx.fillStyle = isHovered ? '#06b6d4' : 'rgba(100, 100, 140, 0.5)'
                ctx.beginPath()
                ctx.arc(p.x, p.y, isHovered ? 4.5 : 1.8, 0, Math.PI * 2)
                ctx.fill()

                if (isHovered) {
                    ctx.shadowColor = '#06b6d4'
                    ctx.shadowBlur = 10
                    ctx.fillStyle = '#06b6d4'
                    ctx.beginPath()
                    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.shadowBlur = 0
                }
            }
        }

        // Hovered node tooltip
        if (hoveredNode && nodeMap[hoveredNode]) {
            const node = nodeMap[hoveredNode]
            const p = toCanvas(node.x, node.y, bounds, rect.width, rect.height, transform)

            const label = `${node.id}`
            const detail = `elevation: ${node.elevation?.toFixed(1)}m`

            ctx.font = '600 12px Inter, system-ui, sans-serif'
            const labelWidth = ctx.measureText(label).width
            ctx.font = '400 10px Inter, system-ui, sans-serif'
            const detailWidth = ctx.measureText(detail).width
            const boxWidth = Math.max(labelWidth, detailWidth) + 20
            const boxHeight = 42
            const boxX = p.x + 14
            const boxY = p.y - boxHeight / 2

            // Tooltip background
            ctx.fillStyle = 'rgba(12, 12, 16, 0.92)'
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)'
            ctx.lineWidth = 1
            roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 8)
            ctx.fill()
            ctx.stroke()

            // Tooltip text
            ctx.font = '600 12px Inter, system-ui, sans-serif'
            ctx.fillStyle = '#f0f0f5'
            ctx.textAlign = 'left'
            ctx.fillText(label, boxX + 10, boxY + 17)
            ctx.font = '400 10px Inter, system-ui, sans-serif'
            ctx.fillStyle = '#9898b0'
            ctx.fillText(detail, boxX + 10, boxY + 33)
        }
    }, [network, transform, hoveredNode, getBounds, toCanvas])

    // Helper: rounded rect
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
    }

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

        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const bounds = getBounds()

        let closest = null
        let closestDist = 20

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

    const handleMouseUp = () => { isDragging.current = false }

    const handleWheel = (e) => {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        setTransform(prev => ({
            ...prev,
            scale: Math.max(0.1, Math.min(10, prev.scale * factor)),
        }))
    }

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const observer = new ResizeObserver(() => setTransform(prev => ({ ...prev })))
        observer.observe(container)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={containerRef} className="absolute inset-0">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            />

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
                {[
                    { label: '+', action: () => setTransform(prev => ({ ...prev, scale: prev.scale * 1.3 })) },
                    { label: '−', action: () => setTransform(prev => ({ ...prev, scale: prev.scale * 0.7 })) },
                    { label: '⟲', action: () => setTransform({ x: 0, y: 0, scale: 1 }) },
                ].map(btn => (
                    <button
                        key={btn.label}
                        onClick={btn.action}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium cursor-pointer transition-all duration-200"
                        style={{
                            backgroundColor: 'rgba(12, 12, 16, 0.85)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            backdropFilter: 'blur(8px)',
                        }}
                        onMouseEnter={e => {
                            e.target.style.borderColor = 'var(--color-accent)'
                            e.target.style.color = 'var(--color-accent)'
                        }}
                        onMouseLeave={e => {
                            e.target.style.borderColor = 'var(--color-border)'
                            e.target.style.color = 'var(--color-text-secondary)'
                        }}
                    >{btn.label}</button>
                ))}
            </div>

            {/* Legend */}
            <div className="absolute top-4 right-4 px-4 py-3 rounded-xl glass"
                style={{
                    backgroundColor: 'rgba(12, 12, 16, 0.8)',
                    border: '1px solid var(--color-border-subtle)',
                }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--color-text-muted)' }}>Legend</p>
                <div className="space-y-2">
                    {[
                        { color: 'rgba(100,100,140,0.5)', label: 'Junction', shape: 'circle' },
                        { color: '#3b82f6', label: 'Reservoir', shape: 'circle' },
                        { color: '#8b5cf6', label: 'Tank', shape: 'circle' },
                        { color: null, label: 'Pipe', shape: 'line' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2.5">
                            {item.shape === 'circle' ? (
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                            ) : (
                                <span className="w-4 h-[2px] rounded" style={{ backgroundColor: 'rgba(90,90,130,0.5)' }}></span>
                            )}
                            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Network info overlay */}
            <div className="absolute bottom-4 left-4 px-3 py-2 rounded-lg glass text-[11px]"
                style={{
                    backgroundColor: 'rgba(12, 12, 16, 0.8)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-muted)',
                }}>
                <span className="font-mono">
                    {transform.scale.toFixed(1)}x
                </span>
                <span className="mx-2">·</span>
                <span>{network?.nodes?.length} nodes</span>
                <span className="mx-2">·</span>
                <span>{network?.edges?.length} edges</span>
            </div>
        </div>
    )
}
