import { NavLink } from 'react-router-dom'

const navItems = [
    { path: '/', label: 'Dashboard', icon: '◉' },
    { path: '/timeline', label: 'Timeline', icon: '◔' },
    { path: '/sandbox', label: 'City Sandbox', icon: '⬡' },
    { path: '/savings', label: 'Savings', icon: '◈' },
]

export default function Sidebar() {
    return (
        <aside className="w-64 h-full flex flex-col border-r"
            style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>

            {/* Logo */}
            <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                        AG
                    </div>
                    <div>
                        <h1 className="text-base font-semibold tracking-tight"
                            style={{ color: 'var(--color-text-primary)' }}>
                            AquaGuard
                        </h1>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Leak Detection Engine
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                                ? 'bg-cyan-500/10 text-cyan-400'
                                : 'hover:bg-white/5'
                            }`
                        }
                        style={({ isActive }) => ({
                            color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        })}
                    >
                        <span className="text-lg">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {/* Status indicator */}
            <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    System Online
                </div>
            </div>
        </aside>
    )
}
