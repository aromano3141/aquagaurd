import { useState } from 'react'
import SandboxProcedural from './SandboxProcedural'
import SandboxUniversal from './SandboxUniversal'

export default function CitySandbox() {
    const [activeTab, setActiveTab] = useState('universal')

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-end border-b border-[var(--color-border)] pb-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-white">City Operations Sandbox</h1>
                    <p className="text-[var(--color-text-dim)]">Test AquaGuard's core models dynamically in simulation.</p>
                </div>

                <div className="flex bg-[rgba(10,14,39,0.8)] border border-[var(--color-border)] rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('universal')}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'universal'
                                ? 'bg-[var(--color-accent)] text-white shadow-md'
                                : 'text-[var(--color-text-dim)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                            }`}
                    >
                        Universal Model (.inp Upload)
                    </button>
                    <button
                        onClick={() => setActiveTab('procedural')}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'procedural'
                                ? 'bg-[var(--color-accent)] text-white shadow-md'
                                : 'text-[var(--color-text-dim)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
                            }`}
                    >
                        Procedural Grid Generator
                    </button>
                </div>
            </div>

            <div className="mt-2">
                {activeTab === 'universal' ? <SandboxUniversal /> : <SandboxProcedural />}
            </div>
        </div>
    )
}
