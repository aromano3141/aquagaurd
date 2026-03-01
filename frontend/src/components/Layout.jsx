import { NavLink, Outlet } from 'react-router-dom'
import { useAuth0, withAuthenticationRequired } from '@auth0/auth0-react'

const navItems = [
    { to: '/overview', icon: '🗺️', label: 'Network Overview' },
    { to: '/simulation', icon: '🎯', label: 'Simulation' },
    { to: '/sandbox', icon: '🏗️', label: 'City Sandbox' },
    { to: '/savings', icon: '💰', label: 'Savings' },
]

function Layout() {
    const { isAuthenticated, loginWithRedirect, logout, user, isLoading } = useAuth0()

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

                <div className="px-6 pb-6 space-y-3">
                    {isLoading ? (
                        <button disabled className="w-full text-sm font-semibold py-2 rounded-lg bg-[var(--color-border)] text-[var(--color-text-dim)] opacity-50 cursor-not-allowed">
                            Loading...
                        </button>
                    ) : isAuthenticated ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-[var(--color-border)]" />
                                <div className="text-sm font-medium text-white max-w-[150px] truncate">{user.name}</div>
                            </div>
                            <button
                                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                className="w-full text-xs font-semibold py-2 rounded-lg bg-[rgba(239,68,68,0.1)] text-red-500 hover:bg-[rgba(239,68,68,0.2)] transition-colors"
                            >Log Out</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => loginWithRedirect()}
                            className="w-full text-sm font-semibold py-2 rounded-lg bg-[var(--color-accent)] text-black hover:opacity-90 transition-opacity"
                        >Log In</button>
                    )}

                    <p className="text-[10px] text-center text-[var(--color-text-dimmest)] pt-2">AquaGuard Engine v1.0</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 p-8 min-h-screen">
                <Outlet />
            </main>
        </div>
    )
}

export default withAuthenticationRequired(Layout, {
    onRedirecting: () => (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#050710]">
            <div className="text-3xl font-extrabold tracking-wide gradient-text mb-4">💧 AquaGuard</div>
            <div className="text-[var(--color-text-dim)] font-medium animate-pulse">Redirecting to secure login...</div>
        </div>
    )
})
