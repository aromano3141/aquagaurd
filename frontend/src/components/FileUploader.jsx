import { useCallback, useState } from 'react'

export default function FileUploader({ onUpload, loading, error }) {
    const [dragOver, setDragOver] = useState(false)

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file && file.name.endsWith('.inp')) {
            onUpload(file)
        }
    }, [onUpload])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback(() => {
        setDragOver(false)
    }, [])

    const handleFileSelect = useCallback((e) => {
        const file = e.target.files[0]
        if (file) onUpload(file)
    }, [onUpload])

    return (
        <div className="w-full max-w-xl">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Load Your Water Network
                </h2>
                <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    Upload an EPANET network file to begin leak detection analysis
                </p>
            </div>

            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className="relative rounded-2xl p-14 cursor-pointer flex flex-col items-center justify-center gap-5 transition-colors duration-200"
                style={{
                    border: `2px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    backgroundColor: dragOver ? 'rgba(6, 182, 212, 0.04)' : 'var(--color-bg-secondary)',
                }}
                onClick={() => document.getElementById('file-input').click()}
            >
                {loading ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            Parsing network topology...
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.08))' }}>
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                style={{ color: 'var(--color-accent)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Drop your EPANET file here
                            </p>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                or click to browse · accepts .inp files
                            </p>
                        </div>
                    </>
                )}

                <input id="file-input" type="file" accept=".inp" onChange={handleFileSelect} className="hidden" />
            </div>

            {error && (
                <div className="mt-4 px-4 py-3 rounded-xl text-sm"
                    style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#fca5a5',
                    }}>
                    {error}
                </div>
            )}
        </div>
    )
}
