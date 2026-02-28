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
        <div className="h-full flex flex-col">
            {/* Header bar */}
            <header className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                <div>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Network Overview
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {network
                            ? `${network.metadata.num_junctions} junctions · ${network.metadata.num_pipes} pipes`
                            : 'Upload an EPANET .inp file to begin'}
                    </p>
                </div>

                {network && (
                    <button
                        onClick={() => setNetwork(null)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border cursor-pointer"
                        style={{
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text-secondary)',
                        }}
                        onMouseEnter={e => e.target.style.backgroundColor = 'var(--color-bg-tertiary)'}
                        onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                    >
                        Load New Network
                    </button>
                )}
            </header>

            {/* Main content */}
            <div className="flex-1 relative">
                {!network ? (
                    <div className="h-full flex items-center justify-center p-8">
                        <FileUploader onUpload={handleUpload} loading={loading} error={error} />
                    </div>
                ) : (
                    <div className="h-full flex">
                        <div className="flex-1 relative">
                            <NetworkMap network={network} />
                        </div>
                        <div className="w-80 border-l overflow-y-auto"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                            <NetworkStats network={network} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
