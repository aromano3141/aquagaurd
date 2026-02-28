import { useState } from 'react'
import NetworkMap from '../components/NetworkMap'
import FileUploader from '../components/FileUploader'
import NetworkStats from '../components/NetworkStats'

export default function Dashboard() {
    const [network, setNetwork] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleUpload = async (file) => {
        setLoading(true)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.detail || 'Upload failed')
            }

            const data = await response.json()
            setNetwork(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4"
                style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                }}>
                <div>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Network Overview
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {network
                            ? `${network.metadata.num_junctions} junctions · ${network.metadata.num_pipes} pipes`
                            : 'Upload an EPANET .inp file to visualize your water network'}
                    </p>
                </div>

                {network && (
                    <button
                        onClick={() => setNetwork(null)}
                        className="px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                        }}>
                        Load New Network
                    </button>
                )}
            </header>

            {/* Content */}
            <div className="flex-1 relative overflow-hidden">
                {!network ? (
                    <div className="h-full flex items-center justify-center p-8">
                        <FileUploader onUpload={handleUpload} loading={loading} error={error} />
                    </div>
                ) : (
                    <div className="h-full flex">
                        <div className="flex-1 relative">
                            <NetworkMap network={network} />
                        </div>
                        <div className="w-80 overflow-y-auto"
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderLeft: '1px solid var(--color-border-subtle)',
                            }}>
                            <NetworkStats network={network} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
