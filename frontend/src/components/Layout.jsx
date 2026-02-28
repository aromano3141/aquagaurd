import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
    { to: '/overview', icon: '🗺️', label: 'Network Overview' },
    { to: '/results', icon: '📊', label: 'Detection Results' },
    { to: '/sensors', icon: '📈', label: 'Sensor Explorer' },
    { to: '/simulation', icon: '🎯', label: 'Simulation' },
    { to: '/sandbox', icon: '🏗️', label: 'City Sandbox' },
    { to: '/savings', icon: '💰', label: 'Savings' },
]

export default function Layout() {
    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="w-64 fixed top-0 left-0 h-screen flex flex-col border-r border-[var(--color-border)]"
                style={{ background: 'linear-gradient(180deg, #07091a 0%, #0a0d1f 50%, #050710 100%)' }}>
                <div className="px-6 pt-6 pb-2">
                    <div className="text-2xl font-extrabold tracking-wide gradient-text">💧 AquaGuard</div>
                    <p className="text-xs text-[var(--color-text-dimmer)] -mt-1">Smart Leak Detection System</p>
                </div>

                <div className="mx-6 my-3 h-px bg-[var(--color-border)]" />

                <nav className="flex-1 px-3 space-y-1">
                    {navItems.map(({ to, icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-[rgba(79,172,254,0.1)] text-[var(--color-accent)]'
                                    : 'text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:bg-[rgba(79,172,254,0.05)]'
                                }`
                            }
                        >
                            <span className="text-lg">{icon}</span>
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="mx-6 my-3 h-px bg-[var(--color-border)]" />

                <div className="px-6 pb-6 space-y-1">
                    <p className="text-xs text-[var(--color-text-dimmer)]">Built with LILA + GNN Entropy Features</p>
                    <p className="text-xs text-[var(--color-text-dimmest)]">BattLeDIM 2020 Competition Dataset</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 p-8 min-h-screen">
                <Outlet />
            </main>
        </div>
    )
}
