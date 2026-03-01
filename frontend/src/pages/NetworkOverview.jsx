import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getNetwork, getGroundTruth, getPipelineResults, getPipelineMetrics, generateReport } from '../api/client'
import MetricCard from '../components/MetricCard'
import NetworkMap from '../components/NetworkMap'
import { Map, Sparkles, Loader2 } from 'lucide-react'

export default function NetworkOverview() {
    const { data: network, isLoading: netLoading } = useQuery({ queryKey: ['network'], queryFn: getNetwork })
    const { data: gt, isLoading: gtLoading } = useQuery({ queryKey: ['groundTruth'], queryFn: getGroundTruth })
    const { data: predictions, isLoading: predLoading } = useQuery({ queryKey: ['pipeline'], queryFn: getPipelineResults })

    const [report, setReport] = useState(null)
    const [reportLoading, setReportLoading] = useState(false)
    const [reportError, setReportError] = useState(null)

    const handleGenerateReport = async () => {
        setReportLoading(true)
        setReportError(null)
        console.log("Starting report generation...")
        try {
            console.log("Fetching metrics...")
            const metrics = await getPipelineMetrics()
            console.log("Metrics fetched:", metrics)

            // Strip out massive heatmap arrays to keep payload small
            const simplifiedLeaks = predictions.map(p => ({
                detected_node: p.detected_node,
                estimated_start_time: p.estimated_start_time,
                estimated_cusum_severity: p.estimated_cusum_severity,
                work_order: p.work_order
            }))

            console.log("Sending to Gemini:", simplifiedLeaks.length, "leaks")
            const data = await generateReport(simplifiedLeaks, metrics)
            console.log("Report generated successfully!")
            setReport(data.report)
        } catch (e) {
            console.error("Report generation failed:", e)
            setReportError(e.message)
        } finally {
            setReportLoading(false)
        }
    }

    if (netLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-[var(--color-text-dim)] animate-pulse text-lg">Loading water network data...</div>
            </div>
        )
    }

    const anyLoading = gtLoading || predLoading

    return (
        <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold mb-1 gradient-text"><Map className="w-6 h-6" /> L-TOWN Water Network</h2>
            <p className="text-sm text-[var(--color-text-dim)] mb-4">
                Interactive visualization of the water distribution network with detected and ground-truth leaks overlaid.
            </p>

            {/* Data loading status */}
            {anyLoading && (
                <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg bg-[rgba(79,172,254,0.08)] border border-[rgba(79,172,254,0.15)]">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                    <span className="text-xs text-[var(--color-text-dim)]">
                        {predLoading && gtLoading ? 'Running leak detection pipeline & loading ground truth...'
                            : predLoading ? 'Running leak detection pipeline (this may take a minute on first load)...'
                                : 'Loading ground truth data...'}
                    </span>
                </div>
            )}

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <MetricCard value={network?.num_nodes ?? '—'} label="Network Nodes" sublabel="Junctions + Reservoirs" />
                <MetricCard value={network?.num_links ?? '—'} label="Pipe Segments" sublabel="Pipes + Pumps + Valves" />
                <MetricCard value={predictions?.length ?? '—'} label="Leaks Detected" sublabel="CUSUM + Entropy Weighted" />
                <MetricCard value={gt?.count ?? '—'} label="Ground Truth" sublabel="Known Active Leaks" />
            </div>

            {/* Network Map */}
            <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6"
                style={{ background: 'rgba(8,10,24,0.6)' }}>
                <NetworkMap network={network} predictions={predictions} groundTruth={gt} />
            </div>

            {/* AI Report Section */}
            <div className="rounded-2xl border border-[var(--color-border)] p-6" style={{ background: 'rgba(8,10,24,0.5)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                            <Sparkles className="w-5 h-5 text-[var(--color-accent)]" /> AI Leak Analysis
                        </h3>
                        <p className="text-xs text-[var(--color-text-dim)] mt-1">
                            Generate a professional incident report using Gemini AI based on detected leaks.
                        </p>
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={reportLoading || !predictions}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[rgba(79,172,254,0.15)] to-[rgba(46,213,115,0.15)] border border-[var(--color-accent)] text-[var(--color-accent)] text-sm font-semibold hover:from-[rgba(79,172,254,0.25)] hover:to-[rgba(46,213,115,0.25)] transition-all disabled:opacity-50 disabled:cursor-wait"
                    >
                        {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {reportLoading ? 'Generating...' : 'Generate Report'}
                    </button>
                </div>

                {reportError && (
                    <div className="p-3 rounded-lg bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] text-sm text-[#ff4757] mb-4">
                        {reportError.includes('429') ? 'Rate limited — please wait a few seconds and try again.' : reportError}
                    </div>
                )}

                {report && (
                    <div className="p-5 rounded-xl border border-[rgba(79,172,254,0.15)] bg-[rgba(8,10,24,0.7)]">
                        <div className="text-sm text-[var(--color-text-dim)] leading-relaxed whitespace-pre-wrap">
                            {report}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
