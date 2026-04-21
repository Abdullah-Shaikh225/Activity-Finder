'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { useRouter } from 'next/navigation'

interface User {
    id: number
    name: string
    email: string
    onboarded?: boolean
}

interface AuthContextType {
    user: User | null
    isLoading: boolean
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; user?: User }>
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>
    verifyEmail: (email: string, otp: string) => Promise<{ success: boolean; error?: string; user?: User }>
    resendVerification: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>
    googleLogin: () => void
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = 'http://localhost:8000'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const router = useRouter()

    // Check for saved session on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('af_user')
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser))
            } catch {
                localStorage.removeItem('af_user')
            }
        }
        setIsLoading(false)
    }, [])

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()

            if (res.status === 403) {
                return { success: false, error: data.detail, requiresVerification: true }
            }
            if (!res.ok) return { success: false, error: data.detail || 'Login failed' }

            setUser(data.user)
            localStorage.setItem('af_user', JSON.stringify(data.user))
            return { success: true, user: data.user }
        } catch {
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    const register = async (name: string, email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            })
            const data = await res.json()
            if (!res.ok) return { success: false, error: data.detail || 'Registration failed' }

            if (data.requires_verification) {
                return { success: true, requiresVerification: true }
            }

            // Fallback: auto-login if no verification needed
            if (data.user) {
                setUser(data.user)
                localStorage.setItem('af_user', JSON.stringify(data.user))
            }
            return { success: true }
        } catch {
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    const verifyEmail = async (email: string, otp: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            })
            const data = await res.json()
            if (!res.ok) return { success: false, error: data.detail || 'Verification failed' }

            setUser(data.user)
            localStorage.setItem('af_user', JSON.stringify(data.user))
            return { success: true, user: data.user }
        } catch {
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    const resendVerification = async (email: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: '' }),
            })
            const data = await res.json()
            if (!res.ok) return { success: false, error: data.detail || 'Failed to resend' }
            return { success: true, message: data.message }
        } catch {
            return { success: false, error: 'Network error. Please try again.' }
        }
    }

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsAuthenticating(true);
            try {
                const token = tokenResponse.access_token;
                if (!token) throw new Error("No token received from Google");

                const res = await fetch(`${API_URL}/auth/google/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error("Google verify failed:", data.detail);
                    return;
                }

                setUser(data.user);
                localStorage.setItem('af_user', JSON.stringify(data.user));

                if (!data.user.onboarded) {
                    setIsAuthenticating(false);
                    router.push('/onboarding');
                } else {
                    setIsAuthenticating(false);
                    router.push('/dashboard');
                }
            } catch (err) {
                console.error('Network error during Google login:', err);
                setIsAuthenticating(false);
            }
        },
        onError: () => {
            console.error('Google login failed');
            setIsAuthenticating(false);
        }
    });

    const logout = () => {
        setUser(null)
        localStorage.removeItem('af_user')
        router.push('/login')
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, verifyEmail, resendVerification, googleLogin, logout }}>
            {children}
            {isAuthenticating && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md transition-opacity">
                    <div className="w-12 h-12 border-4 border-[#3b5930]/30 border-t-[#3b5930] rounded-full animate-spin mb-4" />
                    <p className="text-[#3b5930] font-bold tracking-tight animate-pulse">Securing your account...</p>
                    <p className="text-gray-500 text-xs mt-1 font-medium">Please wait while we verify your Google credentials</p>
                </div>
            )}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}
