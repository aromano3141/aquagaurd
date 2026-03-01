import SandboxProcedural from './SandboxProcedural'

export default function CitySandbox() {
    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-[var(--color-border)] pb-4">
                <h1 className="text-3xl font-bold mb-2 gradient-text">🏗️ City Sandbox</h1>
                <p className="text-[var(--color-text-dim)]">Generate procedural water networks, inject leaks, and watch the AI localize them in real-time 3D.</p>
            </div>
            <SandboxProcedural />
        </div>
    )
}
