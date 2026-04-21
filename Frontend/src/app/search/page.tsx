'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { Suspense } from 'react'

interface ParsedPlace {
    name: string
    type: string
    description: string
    address: string
    distance: string
    rating?: string
    reviews?: string
    match_score?: string
    why_for_you?: string
    price_level?: string
    highlights?: string[]
    place_id?: string
}

function SearchContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()

    const initialMode = searchParams.get('mode') === 'manual' ? 'manual' : 'gps'

    /* ── State ── */
    const [mode, setMode] = useState<'gps' | 'manual'>(initialMode)

    // GPS state
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)

    // Manual state
    const [city, setCity] = useState('')
    const [street, setStreet] = useState('')
    const [landmark, setLandmark] = useState('')

    // Shared state
    const [category, setCategory] = useState('all')
    const [radius, setRadius] = useState(5)
    const [maxResults, setMaxResults] = useState(10)
    const [minRating, setMinRating] = useState(0.0)
    const [result, setResult] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Streaming state
    const [streamStatus, setStreamStatus] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)

    // Tracking state — optimistic UI
    const [likedPlaces, setLikedPlaces] = useState<Set<string>>(new Set())
    const [bookmarkedPlaces, setBookmarkedPlaces] = useState<Set<string>>(new Set())

    const resultsRef = useRef<HTMLDivElement>(null)

    /* ── Auto-request GPS on mount if mode is gps ── */
    useEffect(() => {
        if (initialMode === 'gps') {
            requestGPS()
        }
    }, [])

    /* ── Scroll to results when they appear ── */
    useEffect(() => {
        if (result && resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [result])

    /* ── Load user bookmarks on mount ── */
    useEffect(() => {
        if (!user) return
        const loadBookmarks = async () => {
            try {
                const res = await fetch(`http://localhost:8000/track/bookmarks/${user.id}`)
                const data = await res.json()
                if (data.status === 'success' && data.bookmarks) {
                    setBookmarkedPlaces(new Set(data.bookmarks.map((b: any) => b.place_name)))
                }
            } catch (err) {
                console.error('Failed to load bookmarks', err)
            }
        }
        loadBookmarks()
    }, [user])

    /* ── Track place click (Like) ── */
    async function handleLike(place: ParsedPlace) {
        if (!user) {
            router.push('/login')
            return
        }
        setLikedPlaces(prev => {
            const next = new Set(prev)
            if (next.has(place.name)) {
                next.delete(place.name)
            } else {
                next.add(place.name)
            }
            return next
        })
        try {
            await fetch('http://localhost:8000/track/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    place: {
                        name: place.name,
                        category: place.type || '',
                        address: place.address || '',
                        highlights: place.highlights || [],
                        rating: place.rating || '',
                        price_level: place.price_level || '',
                    }
                })
            })
        } catch (err) {
            console.error('Track click failed', err)
        }
    }

    /* ── Track place bookmark ── */
    async function handleBookmark(place: ParsedPlace) {
        if (!user) {
            router.push('/login')
            return
        }
        const isCurrentlyBookmarked = bookmarkedPlaces.has(place.name)

        setBookmarkedPlaces(prev => {
            const next = new Set(prev)
            if (isCurrentlyBookmarked) {
                next.delete(place.name)
            } else {
                next.add(place.name)
            }
            return next
        })

        try {
            if (isCurrentlyBookmarked) {
                await fetch('http://localhost:8000/track/unbookmark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user.id, place_name: place.name })
                })
            } else {
                await fetch('http://localhost:8000/track/bookmark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: user.id,
                        place: {
                            name: place.name,
                            category: place.type || '',
                            address: place.address || '',
                            highlights: place.highlights || [],
                            rating: place.rating || '',
                            price_level: place.price_level || '',
                        }
                    })
                })
            }
        } catch (err) {
            console.error('Bookmark action failed', err)
            setBookmarkedPlaces(prev => {
                const next = new Set(prev)
                if (isCurrentlyBookmarked) {
                    next.add(place.name)
                } else {
                    next.delete(place.name)
                }
                return next
            })
        }
    }

    /* ── Geocode address text to coordinates ── */
    async function geocodeAddress(address: string, fallbackCity?: string) {
        let response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'ActivityFinderApp' } }
        )
        let data = await response.json()

        if (data.length === 0 && fallbackCity) {
            response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackCity)}&format=json&limit=1`,
                { headers: { 'User-Agent': 'ActivityFinderApp' } }
            )
            data = await response.json()
        }

        if (data.length === 0) throw new Error('Location not found. Try entering just the city name.')

        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name as string,
        }
    }

    /* ── Request GPS permission ── */
    async function requestGPS() {
        setGpsStatus('loading')
        setError('')
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported by your browser'))
                    return
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                })
            })
            setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            setGpsStatus('granted')
        } catch {
            setGpsStatus('denied')
            setError('Location access denied. You can still search manually.')
        }
    }

    /* ── Handle Search (SSE Streaming) ── */
    async function handleSearch() {
        if (!user) {
            router.push('/login')
            return
        }

        setLoading(true)
        setResult('')
        setError('')
        setStreamStatus('')
        setIsStreaming(true)

        try {
            let coords: { lat: number; lng: number }

            if (mode === 'gps') {
                if (!gpsCoords) {
                    throw new Error('GPS coordinates not available. Please allow location access.')
                }
                coords = gpsCoords
            } else {
                const parts = [street, landmark, city].filter(Boolean)
                if (parts.length === 0) throw new Error('Please enter at least a city name.')
                const geoResult = await geocodeAddress(parts.join(', '), city)
                coords = { lat: geoResult.lat, lng: geoResult.lng }
            }

            const response = await fetch('http://localhost:8000/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: coords.lat,
                    lng: coords.lng,
                    radius_km: radius,
                    category,
                    max_results: maxResults,
                    min_rating: minRating,
                    user_id: user.id,
                }),
            })

            if (!response.ok) throw new Error('Search failed. Please try again.')
            if (!response.body) throw new Error('Streaming not supported.')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed.startsWith('data: ')) continue

                    try {
                        const data = JSON.parse(trimmed.slice(6))
                        if (data.type === 'token') {
                            setResult((prev) => prev + data.content)
                            setStreamStatus('')
                        } else if (data.type === 'status') {
                            setStreamStatus(data.content)
                        } else if (data.type === 'done') {
                            setStreamStatus('')
                            setIsStreaming(false)
                        } else if (data.type === 'error') {
                            throw new Error(data.content)
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message && !parseErr.message.includes('JSON')) {
                            throw parseErr
                        }
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong.')
        } finally {
            setLoading(false)
            setIsStreaming(false)
            setStreamStatus('')
        }
    }

    /* ── Parse result text into structured cards ── */
    function parseResults(text: string): ParsedPlace[] {
        const places: ParsedPlace[] = []

        let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim()

        const firstBracket = cleanText.indexOf('{')
        const lastBracket = cleanText.lastIndexOf('}')

        if (firstBracket !== -1 && lastBracket !== -1) {
            try {
                const potentialJson = cleanText.substring(firstBracket, lastBracket + 1)
                const parsed = JSON.parse(potentialJson)
                if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
                    return parsed.recommendations.map((r: any) => ({
                        name: r.name || 'Unnamed Place',
                        type: r.category || '',
                        rating: r.google_rating?.toString() || '',
                        address: r.address || '',
                        description: '',
                        distance: '',
                        match_score: r.match_score?.toString() || '',
                        why_for_you: r.why_for_you || '',
                        price_level: r.price_level || '',
                        highlights: Array.isArray(r.highlights) ? r.highlights : []
                    }))
                }
            } catch {
                // Fallthrough to regex streaming extraction
            }
        }

        if (cleanText.includes('"rank"')) {
            const blocks = cleanText.split(/"rank"\s*:/).slice(1)
            for (const block of blocks) {
                const nameMatch = block.match(/"name"\s*:\s*"([^"]*)"/)
                if (!nameMatch || !nameMatch[1].trim()) {
                    const backupName = block.match(/"name"\s*:\s*([^,]+)/)
                    if (!backupName) continue
                }

                const finalName = nameMatch && nameMatch[1] ? nameMatch[1] : 'Found Place'

                const catMatch = block.match(/"category"\s*:\s*"([^"]*)"/)
                const rateMatch = block.match(/"google_rating"\s*:\s*([\d\.]+)/)
                const addrMatch = block.match(/"address"\s*:\s*"([^"]*)"/)
                const scoreMatch = block.match(/"match_score"\s*:\s*"([^"]*)"/)
                const whyMatch = block.match(/"why_for_you"\s*:\s*"([^"]*)"/)
                const priceMatch = block.match(/"price_level"\s*:\s*"([^"]*)"/)
                const hlMatch = block.match(/"highlights"\s*:\s*\[([\s\S]*?)\]/)

                let highlights: string[] = []
                if (hlMatch) {
                    const hStr = hlMatch[1]
                    const hItems = hStr.match(/"([^"]+)"/g)
                    if (hItems) highlights = hItems.map(h => h.replace(/"/g, ''))
                }

                places.push({
                    name: finalName.replace(/\\"/g, '"'),
                    type: catMatch ? catMatch[1] : '',
                    rating: rateMatch ? rateMatch[1] : '',
                    address: addrMatch ? addrMatch[1] : '',
                    description: '',
                    distance: '',
                    match_score: scoreMatch ? scoreMatch[1] : '',
                    why_for_you: whyMatch ? whyMatch[1].replace(/\\"/g, '"') : '',
                    price_level: priceMatch ? priceMatch[1] : '',
                    highlights
                })
            }
            return places
        }

        // Plain text fallback
        const textLines = text.split('\n')
        for (const line of textLines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const isListItem = /^(?:\d+[\.)]\s*|[-•*]\s+)/.test(trimmed)
            if (!isListItem) continue
            let cleaned = trimmed.replace(/^(?:\d+[\.)]\s*|[-•*]\s+)/, '').trim()
            if (!cleaned) continue
            let name = ''
            const boldMatch = cleaned.match(/^\*\*(.+?)\*\*|^__(.+?)__/)
            if (boldMatch) {
                name = (boldMatch[1] || boldMatch[2]).trim()
                cleaned = cleaned.substring(boldMatch[0].length).trim()
            }
            if (!name) {
                const sepMatch = cleaned.match(/^(.+?)\s*[—\-–:]\s+(.+)$/)
                if (sepMatch) {
                    name = sepMatch[1].replace(/\*\*/g, '').trim()
                    cleaned = sepMatch[2].trim()
                } else {
                    name = cleaned.replace(/\*\*/g, '').trim()
                    cleaned = ''
                }
            }
            if (name.length < 2) continue
            places.push({ name, type: '', description: cleaned, address: '', distance: '', rating: '', reviews: '' })
        }

        return places
    }

    /* ── Categories ── */
    const categories = [
        { value: 'all', label: 'All Activities', icon: '🎯' },
        { value: 'party', label: 'Party & Nightlife', icon: '🎉' },
        { value: 'eating', label: 'Food & Dining', icon: '🍽️' },
        { value: 'group_play', label: 'Group Activities', icon: '🎮' },
    ]

    const selectedCat = categories.find((c) => c.value === category)

    return (
        <main className="min-h-screen" style={{ background: 'var(--warm-bg)' }}>
            <div className="max-w-6xl mx-auto px-6 sm:px-12 pb-20 pt-8">

                {/* ── Search Configuration ── */}
                <div className="animate-fade-in-up mt-4">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => router.push('/landing')}
                            className="text-sm text-gray-400 hover:text-[#4a6741] transition cursor-pointer mb-4 inline-flex items-center gap-1.5 font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back
                        </button>
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                            {mode === 'gps' ? 'Searching near you' : 'Search a location'}
                        </h2>

                        {/* Mode Toggle */}
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => { setMode('gps'); requestGPS(); }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === 'gps' ? 'bg-[#eef3ec] border-[#4a6741]/30 text-[#4a6741]' : 'bg-white border-[#e8e5e0] text-gray-400 hover:text-gray-600'}`}
                            >
                                📍 GPS
                            </button>
                            <button
                                onClick={() => setMode('manual')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === 'manual' ? 'bg-[#eef3ec] border-[#4a6741]/30 text-[#4a6741]' : 'bg-white border-[#e8e5e0] text-gray-400 hover:text-gray-600'}`}
                            >
                                🔍 Manual
                            </button>
                        </div>

                        {mode === 'gps' && gpsStatus === 'loading' && (
                            <div className="flex items-center gap-2 mt-3">
                                <span className="w-2 h-2 rounded-full bg-[#4a6741] animate-pulse-soft" />
                                <p className="text-sm text-gray-400">Acquiring GPS coordinates...</p>
                            </div>
                        )}
                        {mode === 'gps' && gpsStatus === 'granted' && (
                            <div className="flex items-center gap-2 mt-3">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <p className="text-sm text-green-600 font-medium">Location acquired ✓</p>
                            </div>
                        )}
                    </div>

                    {/* Manual Inputs */}
                    {mode === 'manual' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div>
                                <label className="text-sm font-bold text-gray-800 mb-2 block">City *</label>
                                <input
                                    type="text" value={city} onChange={e => setCity(e.target.value)}
                                    placeholder="e.g. London"
                                    className="w-full px-4 py-3 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-800 mb-2 block">Street / Area</label>
                                <input
                                    type="text" value={street} onChange={e => setStreet(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full px-4 py-3 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-800 mb-2 block">Landmark</label>
                                <input
                                    type="text" value={landmark} onChange={e => setLandmark(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full px-4 py-3 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Category Selection */}
                    <div className="mb-8">
                        <label className="text-sm font-bold text-gray-800 mb-3 block">What are you looking for?</label>
                        <div className="flex flex-wrap gap-3">
                            {categories.map((cat) => (
                                <button
                                    key={cat.value}
                                    onClick={() => setCategory(cat.value)}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${category === cat.value
                                        ? 'text-white border-transparent shadow-md'
                                        : 'bg-white text-gray-600 border-[#e8e5e0] hover:border-[#4a6741]/30 hover:shadow-sm'
                                        }`}
                                    style={category === cat.value ? { background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' } : {}}
                                >
                                    <span className="mr-2">{cat.icon}</span>
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="p-5 rounded-2xl border border-[#e8e5e0] bg-white">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-gray-800">Search Radius</label>
                                <span className="text-sm font-bold text-[#4a6741]">{radius} km</span>
                            </div>
                            <input type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
                            <div className="flex justify-between text-[10px] text-gray-300 mt-2">
                                <span>1 km</span><span>50 km</span>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl border border-[#e8e5e0] bg-white">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-gray-800">Max Results</label>
                                <span className="text-sm font-bold text-[#4a6741]">{maxResults}</span>
                            </div>
                            <input type="range" min={3} max={20} value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} className="w-full" />
                            <div className="flex justify-between text-[10px] text-gray-300 mt-2">
                                <span>3</span><span>20</span>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl border border-[#e8e5e0] bg-white">
                            <label className="text-sm font-bold text-gray-800 mb-4 block">Minimum Rating</label>
                            <select
                                value={minRating}
                                onChange={(e) => setMinRating(Number(e.target.value))}
                                className="w-full bg-white border border-[#e8e5e0] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] cursor-pointer transition-all"
                            >
                                <option value={0}>Any Rating</option>
                                <option value={2}>2.0+ Stars</option>
                                <option value={3}>3.0+ Stars</option>
                                <option value={4}>4.0+ Stars</option>
                                <option value={4.5}>4.5+ Stars</option>
                            </select>
                        </div>
                    </div>

                    {/* Search Button */}
                    <button
                        onClick={handleSearch}
                        disabled={loading || (mode === 'gps' && gpsStatus !== 'granted') || (mode === 'manual' && !city.trim())}
                        className="w-full sm:w-auto px-12 py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:shadow-lg hover:shadow-[#4a6741]/20 hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                Searching...
                            </span>
                        ) : (
                            'Find Activities ✨'
                        )}
                    </button>
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="mt-6 p-4 rounded-xl bg-red-50/80 border border-red-100 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="text-red-400">⚠</span>
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        </div>
                    </div>
                )}

                {/* ── Streaming Progress ── */}
                {loading && streamStatus && (
                    <div className="mt-8 p-5 rounded-xl border border-[#e8e5e0] bg-white animate-fade-in shadow-sm">
                        <div className="flex items-center gap-4">
                            <svg className="animate-spin h-5 w-5 text-[#4a6741]" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <p className="text-sm text-gray-600 font-medium">{streamStatus}</p>
                        </div>
                    </div>
                )}

                {/* ── Results ── */}
                {result && (
                    <div ref={resultsRef} className="mt-12 animate-fade-in-up">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
                                    {isStreaming ? 'Finding results…' : 'Results'}
                                </h2>
                                <p className="text-sm text-gray-400">
                                    {selectedCat?.icon} {selectedCat?.label} within {radius}km
                                </p>
                            </div>
                            {!isStreaming && (
                                <button
                                    onClick={() => { setResult(''); setError(''); }}
                                    className="px-5 py-2 rounded-xl border border-[#e8e5e0] text-sm text-gray-500 hover:text-[#4a6741] hover:border-[#4a6741]/30 transition-all cursor-pointer font-medium"
                                >
                                    ← Refine Search
                                </button>
                            )}
                        </div>

                        {/* Result Cards */}
                        {(() => {
                            const places = parseResults(result).slice(0, 20)
                            return (
                                <div className="space-y-4">
                                    {places.length > 0 && places.map((place, i) => (
                                        <div
                                            key={i}
                                            className="flex items-start gap-5 p-5 rounded-2xl border border-[#e8e5e0] hover:border-[#4a6741]/20 transition-all animate-fade-in-up bg-white hover-lift"
                                            style={{ animationDelay: `${i * 0.04}s` }}
                                        >
                                            {/* Rank */}
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                                                {i + 1}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3 mb-1">
                                                    <h3 className="font-bold text-gray-900 text-lg">{place.name}</h3>
                                                    {place.match_score && (
                                                        <span className="text-sm font-bold text-[#4a6741] bg-[#eef3ec] px-2.5 py-1 rounded-lg shrink-0">
                                                            {place.match_score} Match
                                                        </span>
                                                    )}
                                                    {!place.match_score && place.distance && (
                                                        <span className="text-xs text-gray-400 shrink-0">{place.distance}</span>
                                                    )}
                                                </div>

                                                {/* Tags */}
                                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                                    {place.type && (
                                                        <span className="text-xs font-semibold text-gray-500 bg-[#f7f4ef] px-2.5 py-1 rounded-md uppercase tracking-wide">{place.type}</span>
                                                    )}
                                                    {place.rating && (
                                                        <span className="text-xs font-bold text-gray-700 flex items-center">
                                                            <svg className="w-3.5 h-3.5 text-amber-400 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                            {place.rating}/5
                                                            {place.reviews && <span className="text-gray-400 font-medium ml-1">({place.reviews})</span>}
                                                        </span>
                                                    )}
                                                    {place.price_level && (
                                                        <span className="text-xs text-[#4a6741] bg-[#eef3ec] px-2 py-0.5 rounded-md font-medium border border-[#dce8d8]">{place.price_level}</span>
                                                    )}
                                                </div>

                                                {place.why_for_you && (
                                                    <div className="mb-3 p-3 bg-gradient-to-r from-[#eef3ec] to-transparent border-l-2 border-[#4a6741] rounded-r-xl">
                                                        <p className="text-sm font-medium text-gray-800 leading-snug">
                                                            <span className="text-[#4a6741] font-bold mr-1">Why you'll love it:</span>
                                                            {place.why_for_you}
                                                        </p>
                                                    </div>
                                                )}

                                                {place.description && !place.why_for_you && (
                                                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-3">{place.description}</p>
                                                )}

                                                {place.highlights && place.highlights.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {place.highlights.map((hl, idx) => (
                                                            <span key={idx} className="text-xs text-gray-500 bg-white border border-[#e8e5e0] px-2 py-1 rounded-md shrink-0 shadow-sm">
                                                                ✓ {hl}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {place.address && (
                                                    <p className="text-xs text-gray-400 mt-2 font-medium flex items-center">
                                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                        {place.address}
                                                    </p>
                                                )}

                                                {/* ── Like & Bookmark Actions ── */}
                                                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#e8e5e0]">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleLike(place); }}
                                                        className={`group/btn flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer border-2 ${likedPlaces.has(place.name)
                                                            ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 text-red-500 shadow-md shadow-red-100/50'
                                                            : 'bg-white border-[#e8e5e0] text-gray-500 hover:text-red-500 hover:border-red-300 hover:bg-red-50 hover:shadow-md hover:shadow-red-100/40'
                                                            }`}
                                                    >
                                                        <svg
                                                            className={`w-5 h-5 transition-all duration-300 ${likedPlaces.has(place.name) ? 'scale-125 animate-[heartPop_0.3s_ease]' : 'group-hover/btn:scale-110'}`}
                                                            fill={likedPlaces.has(place.name) ? 'currentColor' : 'none'}
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={likedPlaces.has(place.name) ? 0 : 2}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                        </svg>
                                                        {likedPlaces.has(place.name) ? 'Liked ✓' : 'Like'}
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleBookmark(place); }}
                                                        className={`group/btn flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer border-2 ${bookmarkedPlaces.has(place.name)
                                                            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 text-amber-600 shadow-md shadow-amber-100/50'
                                                            : 'bg-white border-[#e8e5e0] text-gray-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 hover:shadow-md hover:shadow-amber-100/40'
                                                            }`}
                                                    >
                                                        <svg
                                                            className={`w-5 h-5 transition-all duration-300 ${bookmarkedPlaces.has(place.name) ? 'scale-125 animate-[heartPop_0.3s_ease]' : 'group-hover/btn:scale-110'}`}
                                                            fill={bookmarkedPlaces.has(place.name) ? 'currentColor' : 'none'}
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={bookmarkedPlaces.has(place.name) ? 0 : 2}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                        </svg>
                                                        {bookmarkedPlaces.has(place.name) ? 'Saved ✓' : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Streaming skeleton */}
                                    {isStreaming && (
                                        <div className="p-8 rounded-2xl border border-[#e8e5e0] bg-white flex justify-center animate-pulse">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-block w-1.5 h-5 bg-[#4a6741]/30 rounded-sm animate-blink" />
                                                <p className="text-sm text-gray-400">Finding more...</p>
                                            </div>
                                        </div>
                                    )}

                                    {!isStreaming && places.length === 0 && (
                                        <div className="p-12 rounded-2xl border border-[#e8e5e0] bg-white text-center">
                                            <p className="text-3xl mb-4">🔍</p>
                                            <h3 className="font-bold text-gray-900 mb-2">No results found</h3>
                                            <p className="text-sm text-gray-400 max-w-sm mx-auto">
                                                Try expanding your search radius or lowering the minimum rating.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </div>
                )}

                {/* ── Footer ── */}
                <footer className="mt-20 pt-6 border-t border-[#e8e5e0] text-center">
                    <p className="text-xs text-gray-400">
                        Powered by AI & Google Places • Activity Finder
                    </p>
                </footer>
            </div>
        </main>
    )
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--warm-bg)' }}>
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#4a6741]/20 border-t-[#4a6741] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-400 font-medium">Loading...</p>
                </div>
            </div>
        }>
            <SearchContent />
        </Suspense>
    )
}
