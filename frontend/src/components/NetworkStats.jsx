export default function NetworkStats({ network }) {
    if (!network) return null

    const { metadata, nodes, edges } = network

    const stats = [
        { label: 'Junctions', value: metadata.num_junctions, color: '#71717a' },
        { label: 'Pipes', value: metadata.num_pipes, color: '#71717a' },
        { label: 'Reservoirs', value: metadata.num_reservoirs, color: '#3b82f6' },
        { label: 'Tanks', value: metadata.num_tanks, color: '#8b5cf6' },
        { label: 'Pumps', value: metadata.num_pumps, color: '#f59e0b' },
        { label: 'Valves', value: metadata.num_valves, color: '#ef4444' },
    ]

    // Compute basic network metrics
    const elevations = nodes
        .filter(n => n.type === 'junction')
        .map(n => n.elevation)
    const avgElevation = elevations.length
        ? (elevations.reduce((a, b) => a + b, 0) / elevations.length).toFixed(1)
        : 'N/A'
    const maxElevation = elevations.length ? Math.max(...elevations).toFixed(1) : 'N/A'
    const minElevation = elevations.length ? Math.min(...elevations).toFixed(1) : 'N/A'

    const pipeLengths = edges.filter(e => e.length > 0).map(e => e.length)
    const totalPipeLength = pipeLengths.reduce((a, b) => a + b, 0)
    const avgPipeLength = pipeLengths.length
        ? (totalPipeLength / pipeLengths.length).toFixed(1)
        : 'N/A'

    return (
        <div className="p-5 space-y-6">
            <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Network Components
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {stats.map(stat => (
                        <div key={stat.label} className="px-3 py-2.5 rounded-lg"
                            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                            <p className="text-lg font-semibold mt-0.5" style={{ color: stat.color }}>
                                {stat.value.toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Elevation Profile
                </h3>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}>Min</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{minElevation} m</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}>Average</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{avgElevation} m</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}>Max</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{maxElevation} m</span>
                    </div>
                </div>
            </div>

            <div className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Pipe Network
                </h3>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}>Total Length</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                            {(totalPipeLength / 1000).toFixed(1)} km
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}>Avg Pipe Length</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{avgPipeLength} m</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--color-text-muted)' }}>Diameters</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                            {edges.length > 0
                                ? `${(Math.min(...edges.filter(e => e.diameter > 0).map(e => e.diameter)) * 1000).toFixed(0)}–${(Math.max(...edges.filter(e => e.diameter > 0).map(e => e.diameter)) * 1000).toFixed(0)} mm`
                                : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Detection status placeholder */}
            <div className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Detection Status
                </h3>
                <div className="px-4 py-6 rounded-lg text-center"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        No detection run yet
                    </p>
                    <button
                        className="mt-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                            color: '#fff',
                        }}
                    >
                        Run Detection
                    </button>
                </div>
            </div>
        </div>
    )
}
