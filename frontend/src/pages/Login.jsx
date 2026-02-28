import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)

    const handleSubmit = (e) => {
        e.preventDefault()
        setError(null)
        const result = login(email, password)
        if (!result.success) {
            setError(result.error)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4"
            style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        AquaGuard
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Sign in to continue
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5"
                            style={{ color: 'var(--color-text-secondary)' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5"
                            style={{ color: 'var(--color-text-secondary)' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                        />
                    </div>

                    {error && (
                        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
                    )}

                    <button type="submit"
                        className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-opacity"
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                            color: '#fff',
                            border: 'none',
                        }}>
                        Sign In
                    </button>
                </form>

                <p className="text-[11px] text-center mt-6" style={{ color: 'var(--color-text-muted)' }}>
                    Auth0 integration coming soon
                </p>
            </div>
        </div>
    )
}
