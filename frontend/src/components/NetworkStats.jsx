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

    const elevations = nodes.filter(n => n.type === 'junction').map(n => n.elevation)
    const avgElev = elevations.length
        ? (elevations.reduce((a, b) => a + b, 0) / elevations.length).toFixed(1) : '—'
    const maxElev = elevations.length ? Math.max(...elevations).toFixed(1) : '—'
    const minElev = elevations.length ? Math.min(...elevations).toFixed(1) : '—'

    const pipeLengths = edges.filter(e => e.length > 0).map(e => e.length)
    const totalLength = pipeLengths.reduce((a, b) => a + b, 0)

    return (
        <div className="p-5 space-y-5">
            {/* Components */}
            <Section title="Components">
                <div className="grid grid-cols-2 gap-2">
                    {stats.map(stat => (
                        <div key={stat.label} className="px-3 py-3 rounded-xl"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border-subtle)',
                            }}>
                            <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                {stat.label}
                            </p>
                            <p className="text-xl font-semibold mt-0.5" style={{ color: stat.color }}>
                                {stat.value.toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Elevation */}
            <Section title="Elevation">
                <Row label="Min" value={`${minElev} m`} />
                <Row label="Avg" value={`${avgElev} m`} />
                <Row label="Max" value={`${maxElev} m`} />
            </Section>

            {/* Pipes */}
            <Section title="Pipe Network">
                <Row label="Total Length" value={`${(totalLength / 1000).toFixed(1)} km`} accent />
                <Row label="Avg Length" value={`${pipeLengths.length ? (totalLength / pipeLengths.length).toFixed(1) : '—'} m`} />
            </Section>

            {/* Detection */}
            <Section title="Leak Detection">
                <div className="px-4 py-6 rounded-xl text-center"
                    style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}>
                    <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        Ready to scan for leaks
                    </p>
                    <button className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', border: 'none' }}>
                        Run Detection
                    </button>
                </div>
            </Section>
        </div>
    )
}

function Section({ title, children }) {
    return (
        <div className="pb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--color-text-muted)' }}>
                {title}
            </h3>
            {children}
        </div>
    )
}

function Row({ label, value, accent }) {
    return (
        <div className="flex justify-between items-center text-xs py-1">
            <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <span className="font-mono font-medium"
                style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                {value}
            </span>
        </div>
    )
}
