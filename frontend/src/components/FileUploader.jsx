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
        if (file) {
            onUpload(file)
        }
    }, [onUpload])

    return (
        <div className="w-full max-w-lg">
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                    relative border-2 border-dashed rounded-2xl p-12
                    flex flex-col items-center justify-center gap-4
                    transition-all duration-200 cursor-pointer
                `}
                style={{
                    borderColor: dragOver ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: dragOver ? 'rgba(6, 182, 212, 0.05)' : 'var(--color-bg-secondary)',
                }}
                onClick={() => document.getElementById('file-input').click()}
            >
                {loading ? (
                    <>
                        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}>
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            Parsing network topology...
                        </p>
                    </>
                ) : (
                    <>
                        {/* Upload icon */}
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.15))' }}>
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                style={{ color: 'var(--color-accent)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>

                        <div className="text-center">
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Drop your EPANET file here
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                or click to browse · accepts .inp files
                            </p>
                        </div>

                        {/* File type badges */}
                        <div className="flex gap-2 mt-2">
                            <span className="px-2.5 py-1 rounded-md text-xs font-mono"
                                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                                .inp
                            </span>
                            <span className="px-2.5 py-1 rounded-md text-xs"
                                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                                EPANET format
                            </span>
                        </div>
                    </>
                )}

                <input
                    id="file-input"
                    type="file"
                    accept=".inp"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {error && (
                <div className="mt-4 px-4 py-3 rounded-lg text-sm border"
                    style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                    }}>
                    {error}
                </div>
            )}
        </div>
    )
}
