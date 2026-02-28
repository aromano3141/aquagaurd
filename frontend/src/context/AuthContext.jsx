import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

/**
 * Simple auth provider — stores user in localStorage.
 * This is a placeholder that will be replaced with Auth0 integration.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('aquaguard_user')
        return stored ? JSON.parse(stored) : null
    })

    const login = useCallback((email, password) => {
        // Simple validation — will be replaced by Auth0
        if (!email || !password) {
            return { success: false, error: 'Email and password are required' }
        }

        const userData = {
            email,
            name: email.split('@')[0],
            loggedInAt: new Date().toISOString(),
        }

        localStorage.setItem('aquaguard_user', JSON.stringify(userData))
        setUser(userData)
        return { success: true }
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('aquaguard_user')
        setUser(null)
    }, [])

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
