import { useQuery } from '@tanstack/react-query'
import { getNetwork, getGroundTruth, getPipelineResults } from '../api/client'
import MetricCard from '../components/MetricCard'
import NetworkMap from '../components/NetworkMap'

export default function NetworkOverview() {
    const { data: network, isLoading: netLoading } = useQuery({ queryKey: ['network'], queryFn: getNetwork })
    const { data: gt } = useQuery({ queryKey: ['groundTruth'], queryFn: getGroundTruth })
    const { data: predictions } = useQuery({ queryKey: ['pipeline'], queryFn: getPipelineResults })

    if (netLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-[var(--color-text-dim)] animate-pulse text-lg">Loading water network data...</div>
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-1 gradient-text">🗺️ L-TOWN Water Network</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-6">
                Interactive visualization of the water distribution network with detected and ground-truth leaks overlaid.
            </p>

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard value={network?.num_nodes ?? '—'} label="Network Nodes" sublabel="Junctions + Reservoirs" />
                <MetricCard value={network?.num_links ?? '—'} label="Pipe Segments" sublabel="Pipes + Pumps + Valves" />
                <MetricCard value={predictions?.length ?? '—'} label="Leaks Detected" sublabel="CUSUM + Entropy Weighted" />
                <MetricCard value={gt?.count ?? '—'} label="Ground Truth" sublabel="Known Active Leaks" />
            </div>

            {/* Network Map */}
            <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden"
                style={{ background: 'rgba(8,10,24,0.6)' }}>
                <NetworkMap network={network} predictions={predictions} groundTruth={gt} />
            </div>
        </div>
    )
}
