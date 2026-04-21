'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

const API_URL = 'http://localhost:8000'

interface Bookmark {
    place_name: string
    place_id: string
    saved_at: string
}

interface Click {
    place_name: string
    place_id: string
    category: string
    clicked_at: string
}

interface Signal {
    signal_type: string
    signal_value: string
    strength: number
    updated_at: string
}

interface Preferences {
    cuisines: string[]
    vibe: string[]
    budget: string
    group_type: string
    outing_time: string[]
    dislikes: string[]
    onboarding_completed: boolean
}

export default function DashboardPage() {
    const router = useRouter()
    const { user, logout } = useAuth()

    const [preferences, setPreferences] = useState<Preferences | null>(null)
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
    const [clicks, setClicks] = useState<Click[]>([])
    const [signals, setSignals] = useState<Signal[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'bookmarks' | 'likes' | 'signals'>('overview')

    useEffect(() => {
        if (!user) {
            router.push('/login')
            return
        }
        loadAllData()
    }, [user])

    async function loadAllData() {
        if (!user) return
        setLoading(true)
        try {
            const [prefsRes, bookmarksRes, clicksRes, signalsRes] = await Promise.all([
                fetch(`${API_URL}/auth/preferences/${user.id}`),
                fetch(`${API_URL}/track/bookmarks/${user.id}`),
                fetch(`${API_URL}/track/clicks/${user.id}`),
                fetch(`${API_URL}/track/signals/${user.id}`),
            ])

            const prefsData = await prefsRes.json()
            const bookmarksData = await bookmarksRes.json()
            const clicksData = await clicksRes.json()
            const signalsData = await signalsRes.json()

            if (prefsData && prefsData.onboarding_completed !== undefined) setPreferences(prefsData)
            if (bookmarksData.status === 'success') setBookmarks(bookmarksData.bookmarks || [])
            if (clicksData.status === 'success') setClicks(clicksData.clicks || [])
            if (signalsData.status === 'success') setSignals(signalsData.signals || [])
        } catch (err) {
            console.error('Failed to load dashboard data', err)
        } finally {
            setLoading(false)
        }
    }

    async function removeBookmark(placeName: string) {
        if (!user) return
        setBookmarks(prev => prev.filter(b => b.place_name !== placeName))
        try {
            await fetch(`${API_URL}/track/unbookmark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, place_name: placeName })
            })
        } catch {
            loadAllData()
        }
    }

    function formatDate(dateStr: string) {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
        } catch {
            return dateStr
        }
    }

    // Get unique clicked places (deduplicated)
    const uniqueClicks = clicks.reduce((acc: Click[], click) => {
        if (!acc.find(c => c.place_name === click.place_name)) acc.push(click)
        return acc
    }, [])

    // Top signals for suggestions
    const topCuisines = signals.filter(s => s.signal_type === 'cuisine').slice(0, 5)
    const topVibes = signals.filter(s => s.signal_type === 'vibe').slice(0, 5)
    const topCategories = signals.filter(s => s.signal_type === 'category').slice(0, 5)

    if (!user) return null

    const tabs = [
        { id: 'overview' as const, label: 'Overview', icon: '📊' },
        { id: 'bookmarks' as const, label: 'Saved', icon: '🔖', count: bookmarks.length },
        { id: 'likes' as const, label: 'Liked', icon: '❤️', count: uniqueClicks.length },
        { id: 'signals' as const, label: 'AI Signals', icon: '🧠', count: signals.length },
    ]

    return (
        <main className="min-h-screen" style={{ background: 'var(--warm-bg)' }}>
            {/* ── Navbar ── */}
            <nav className="border-b border-[#e8e5e0]/60">
                <div className="flex items-center justify-between px-6 sm:px-12 py-4 max-w-6xl mx-auto">
                    <div className="flex items-center gap-2.5">
                        <button onClick={() => router.push('/')} className="flex items-center gap-2.5 cursor-pointer">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" /></svg>
                            </div>
                            <span className="text-base font-bold text-gray-800 tracking-tight">Activity Finder</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 hidden sm:block">{user.name}</span>
                        <button onClick={logout} className="text-xs text-gray-400 hover:text-red-400 transition cursor-pointer ml-1 font-medium">Logout</button>
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-6 sm:px-12 pb-20 pt-6">
                {/* ── Dashboard Header ── */}
                <div className="mb-8 animate-fade-in-up">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                                Your Dashboard
                            </h1>
                            <p className="text-gray-400 text-sm">
                                Welcome back, <span className="font-semibold text-gray-600">{user.name}</span>. Here's your personalized activity profile.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                onClick={() => router.push('/trip')}
                                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border-2 border-[#4a6741]/20 text-[#4a6741] hover:bg-[#eef3ec] hover:-translate-y-0.5"
                            >
                                ✈️ Plan a Trip
                            </button>
                            <button
                                onClick={() => router.push('/search')}
                                className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4a6741]/20 hover:-translate-y-0.5"
                                style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}
                            >
                                ✨ Discover Places
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Tab Navigation ── */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-1 animate-fade-in-up delay-100">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer border-2 whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white border-[#4a6741]/30 text-[#4a6741] shadow-md shadow-[#4a6741]/5'
                                : 'bg-white/50 border-transparent text-gray-400 hover:text-gray-600 hover:bg-white hover:border-[#e8e5e0]'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-[#eef3ec] text-[#4a6741]' : 'bg-gray-100 text-gray-400'
                                    }`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Loading ── */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-[#4a6741]/20 border-t-[#4a6741] rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm text-gray-400 font-medium">Loading your dashboard...</p>
                        </div>
                    </div>
                )}

                {!loading && (
                    <>
                        {/* ═══════════════════════════════════════
                OVERVIEW TAB
            ═══════════════════════════════════════ */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-fade-in-up">

                                {/* Quick Stats */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { value: bookmarks.length, label: 'Saved Places', icon: '🔖', color: 'from-amber-50 to-yellow-50', border: 'border-amber-200' },
                                        { value: uniqueClicks.length, label: 'Liked Places', icon: '❤️', color: 'from-red-50 to-pink-50', border: 'border-red-200' },
                                        { value: signals.length, label: 'AI Signals', icon: '🧠', color: 'from-purple-50 to-indigo-50', border: 'border-purple-200' },
                                    ].map((stat, i) => (
                                        <div
                                            key={stat.label}
                                            className={`p-5 rounded-2xl bg-gradient-to-br ${stat.color} border ${stat.border} hover-lift animate-fade-in-up`}
                                            style={{ animationDelay: `${i * 0.08}s` }}
                                        >
                                            <div className="text-2xl mb-2">{stat.icon}</div>
                                            <div className="text-2xl font-extrabold text-gray-900">{stat.value}</div>
                                            <div className="text-xs text-gray-500 font-medium mt-1">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Preferences Card */}
                                {preferences && preferences.onboarding_completed && (
                                    <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e8e5e0] hover-lift">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, #eef3ec, #dce8d8)' }}>🎯</div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg">Your Preferences</h3>
                                                    <p className="text-xs text-gray-400">From your onboarding selections</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => router.push('/onboarding')}
                                                className="text-xs font-semibold text-[#4a6741] hover:text-[#3b5535] transition cursor-pointer px-3 py-1.5 rounded-lg hover:bg-[#eef3ec]"
                                            >
                                                Edit →
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {/* Cuisines */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                    <span>🍽️</span> Favourite Cuisines
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(preferences.cuisines || []).map((c: string) => (
                                                        <span key={c} className="text-xs font-medium text-[#4a6741] bg-[#eef3ec] px-2.5 py-1 rounded-full border border-[#dce8d8]">{c}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Vibe */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                    <span>✨</span> Preferred Vibes
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(preferences.vibe || []).map((v: string) => (
                                                        <span key={v} className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">{v}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Budget */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                    <span>💰</span> Budget
                                                </div>
                                                <span className="inline-block text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                                                    {preferences.budget || 'Not set'}
                                                </span>
                                            </div>

                                            {/* Group */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                    <span>👥</span> Group Type
                                                </div>
                                                <span className="inline-block text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                                                    {preferences.group_type || 'Not set'}
                                                </span>
                                            </div>

                                            {/* Outing Time */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                    <span>🕐</span> Outing Time
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(preferences.outing_time || []).map((t: string) => (
                                                        <span key={t} className="text-xs font-medium text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">{t}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Dislikes */}
                                            {(preferences.dislikes || []).length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                        <span>🚫</span> Avoids
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {preferences.dislikes.map((d: string) => (
                                                            <span key={d} className="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">{d}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* AI Taste Profile (top signals summary) */}
                                {signals.length > 0 && (
                                    <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e8e5e0] hover-lift">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, #f0e6ff, #e8d5ff)' }}>🧠</div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-lg">AI Taste Profile</h3>
                                                <p className="text-xs text-gray-400">Built from your likes, bookmarks, and searches</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {topCuisines.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Top Cuisines</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {topCuisines.map(s => (
                                                            <div key={s.signal_value} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#eef3ec] border border-[#dce8d8]">
                                                                <span className="text-sm font-semibold text-[#4a6741] capitalize">{s.signal_value}</span>
                                                                <span className="text-xs font-bold text-[#4a6741]/50 bg-white px-1.5 py-0.5 rounded-md">{s.strength.toFixed(0)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {topVibes.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Preferred Vibes</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {topVibes.map(s => (
                                                            <div key={s.signal_value} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-200">
                                                                <span className="text-sm font-semibold text-purple-700 capitalize">{s.signal_value}</span>
                                                                <span className="text-xs font-bold text-purple-400 bg-white px-1.5 py-0.5 rounded-md">{s.strength.toFixed(0)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {topCategories.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Favourite Categories</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {topCategories.map(s => (
                                                            <div key={s.signal_value} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                                                                <span className="text-sm font-semibold text-blue-700 capitalize">{s.signal_value}</span>
                                                                <span className="text-xs font-bold text-blue-400 bg-white px-1.5 py-0.5 rounded-md">{s.strength.toFixed(0)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Suggestion Card */}
                                <div className="p-6 sm:p-8 rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4a6741 0%, #6b8f5e 60%, #8ab07c 100%)' }}>
                                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
                                    <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
                                    <div className="relative">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-2xl">💡</span>
                                            <h3 className="text-xl font-bold text-white">Suggestions for You</h3>
                                        </div>
                                        <p className="text-white/80 text-sm mb-5 max-w-lg leading-relaxed">
                                            {signals.length === 0
                                                ? "Start exploring! Like and save places to build your personalized taste profile. The more you interact, the smarter your recommendations get."
                                                : `Based on ${signals.length} signals from your activity, we're learning your taste. Keep exploring to improve your recommendations!`
                                            }
                                        </p>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={() => router.push('/')}
                                                className="px-6 py-3 rounded-xl bg-white text-[#4a6741] font-bold text-sm hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
                                            >
                                                🔍 Find New Places
                                            </button>
                                            {!preferences?.onboarding_completed && (
                                                <button
                                                    onClick={() => router.push('/onboarding')}
                                                    className="px-6 py-3 rounded-xl bg-white/20 text-white border border-white/30 font-bold text-sm hover:bg-white/30 transition-all cursor-pointer"
                                                >
                                                    Complete Onboarding
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* ═══════════════════════════════════════
                BOOKMARKS TAB
            ═══════════════════════════════════════ */}
                        {activeTab === 'bookmarks' && (
                            <div className="animate-fade-in-up">
                                {bookmarks.length === 0 ? (
                                    <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[#e8e5e0]">
                                        <div className="text-4xl mb-4">🔖</div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">No saved places yet</h3>
                                        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">Discover places and hit the Save button to build your collection.</p>
                                        <button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                                            Start Exploring
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {bookmarks.map((b, i) => (
                                            <div
                                                key={b.place_name}
                                                className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#e8e5e0] hover:border-amber-200 transition-all hover-lift animate-fade-in-up"
                                                style={{ animationDelay: `${i * 0.04}s` }}
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200">
                                                        🔖
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-gray-900 truncate">{b.place_name}</h4>
                                                        <p className="text-xs text-gray-400 mt-0.5">Saved {formatDate(b.saved_at)}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeBookmark(b.place_name)}
                                                    className="text-xs font-semibold text-gray-400 hover:text-red-500 transition px-3 py-2 rounded-lg hover:bg-red-50 cursor-pointer shrink-0"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* ═══════════════════════════════════════
                LIKES TAB
            ═══════════════════════════════════════ */}
                        {activeTab === 'likes' && (
                            <div className="animate-fade-in-up">
                                {uniqueClicks.length === 0 ? (
                                    <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[#e8e5e0]">
                                        <div className="text-4xl mb-4">❤️</div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">No liked places yet</h3>
                                        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">Like places to help us understand your taste better.</p>
                                        <button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                                            Start Exploring
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {uniqueClicks.map((c, i) => {
                                            const clickCount = clicks.filter(cl => cl.place_name === c.place_name).length
                                            return (
                                                <div
                                                    key={c.place_name}
                                                    className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#e8e5e0] hover:border-red-200 transition-all hover-lift animate-fade-in-up"
                                                    style={{ animationDelay: `${i * 0.04}s` }}
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 bg-gradient-to-br from-red-50 to-pink-50 border border-red-200">
                                                            ❤️
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-gray-900 truncate">{c.place_name}</h4>
                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                {c.category && <span className="text-xs text-gray-400 font-medium uppercase">{c.category}</span>}
                                                                <span className="text-xs text-gray-300">•</span>
                                                                <span className="text-xs text-gray-400">Last: {formatDate(c.clicked_at)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {clickCount > 1 && (
                                                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 shrink-0">
                                                            ×{clickCount}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* ═══════════════════════════════════════
                SIGNALS TAB
            ═══════════════════════════════════════ */}
                        {activeTab === 'signals' && (
                            <div className="animate-fade-in-up">
                                {signals.length === 0 ? (
                                    <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[#e8e5e0]">
                                        <div className="text-4xl mb-4">🧠</div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">No signals yet</h3>
                                        <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">Signals are automatically generated when you like, save, or search for places.</p>
                                        <button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                                            Start Exploring
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {signals.map((s, i) => {
                                            const maxStrength = signals[0]?.strength || 1
                                            const percent = Math.min((s.strength / maxStrength) * 100, 100)
                                            const typeColors: Record<string, { bg: string; text: string; bar: string }> = {
                                                cuisine: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-gradient-to-r from-green-400 to-emerald-500' },
                                                vibe: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-gradient-to-r from-purple-400 to-indigo-500' },
                                                category: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-gradient-to-r from-blue-400 to-cyan-500' },
                                                clicked_place: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-gradient-to-r from-red-400 to-pink-500' },
                                                bookmarked_place: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-gradient-to-r from-amber-400 to-yellow-500' },
                                                search_category: { bg: 'bg-cyan-50', text: 'text-cyan-700', bar: 'bg-gradient-to-r from-cyan-400 to-teal-500' },
                                                activity: { bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-gradient-to-r from-indigo-400 to-violet-500' },
                                            }
                                            const colors = typeColors[s.signal_type] || { bg: 'bg-gray-50', text: 'text-gray-700', bar: 'bg-gray-400' }

                                            return (
                                                <div
                                                    key={`${s.signal_type}-${s.signal_value}`}
                                                    className="p-4 rounded-2xl bg-white border border-[#e8e5e0] hover:shadow-sm transition-all animate-fade-in-up"
                                                    style={{ animationDelay: `${i * 0.03}s` }}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${colors.bg} ${colors.text}`}>
                                                                {s.signal_type.replace('_', ' ')}
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900 capitalize">{s.signal_value}</span>
                                                        </div>
                                                        <span className="text-sm font-extrabold text-gray-700">{s.strength.toFixed(1)}</span>
                                                    </div>
                                                    {/* Strength bar */}
                                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    )
}
