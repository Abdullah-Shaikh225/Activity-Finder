'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './context/AuthContext'

type LocationMode = 'choose' | 'gps' | 'manual'

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
}

export default function Home() {
  const router = useRouter()
  const { user, logout } = useAuth()

  /* ── State ── */
  const [mode, setMode] = useState<LocationMode>('choose')

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

  const resultsRef = useRef<HTMLDivElement>(null)

  /* ── Scroll to results when they appear ── */
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

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
    // Auth guard
    if (!user) {
      localStorage.setItem('af_return_mode', mode)
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

    // Strip out markdown code blocks if the LLM wrapped it
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Attempt full parse if possible
    const firstBracket = cleanText.indexOf('{');
    const lastBracket = cleanText.lastIndexOf('}');

    if (firstBracket !== -1 && lastBracket !== -1) {
      try {
        const potentialJson = cleanText.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(potentialJson);
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
          }));
        }
      } catch (err) {
        // Fallthrough to regex streaming extraction
      }
    }

    // Streaming extraction using regex on JSON keys
    if (cleanText.includes('"rank"')) {
      const blocks = cleanText.split(/"rank"\s*:/).slice(1);
      for (const block of blocks) {
        // name could be like "name": "Cafe" or "name": ""
        const nameMatch = block.match(/"name"\s*:\s*"([^"]*)"/);
        if (!nameMatch || !nameMatch[1].trim()) {
          // Fallback if formatting was a bit different
          const backupName = block.match(/"name"\s*:\s*([^,]+)/);
          if (!backupName) continue;
        }

        const finalName = nameMatch && nameMatch[1] ? nameMatch[1] : 'Found Place';

        const catMatch = block.match(/"category"\s*:\s*"([^"]*)"/);
        const rateMatch = block.match(/"google_rating"\s*:\s*([\d\.]+)/);
        const addrMatch = block.match(/"address"\s*:\s*"([^"]*)"/);
        const scoreMatch = block.match(/"match_score"\s*:\s*"([^"]*)"/);
        const whyMatch = block.match(/"why_for_you"\s*:\s*"([^"]*)"/);
        const priceMatch = block.match(/"price_level"\s*:\s*"([^"]*)"/);
        const hlMatch = block.match(/"highlights"\s*:\s*\[([\s\S]*?)\]/);

        let highlights: string[] = [];
        if (hlMatch) {
          const hStr = hlMatch[1];
          const hItems = hStr.match(/"([^"]+)"/g);
          if (hItems) highlights = hItems.map(h => h.replace(/"/g, ''));
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
        });
      }
      return places;
    }

    // Old Parser Fallback for plain text
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const isListItem = /^(?:\d+[\.)\]]\s*|[-•*]\s+)/.test(trimmed)
      if (!isListItem) continue

      let cleaned = trimmed.replace(/^(?:\d+[\.)\]]\s*|[-•*]\s+)/, '').trim()
      if (!cleaned) continue

      let name = ''
      let type = ''
      let description = ''
      let address = ''
      let distance = ''
      let rating = ''
      let reviews = ''

      const boldMatch = cleaned.match(/^\*\*(.+?)\*\*|^__(.+?)__/)
      if (boldMatch) {
        name = (boldMatch[1] || boldMatch[2]).trim()
        cleaned = cleaned.substring(boldMatch[0].length).trim()
      }

      const typeMatch = cleaned.match(/^\(([^)]+)\)/)
      if (typeMatch) {
        type = typeMatch[1].trim()
        cleaned = cleaned.substring(typeMatch[0].length).trim()
      }

      cleaned = cleaned.replace(/^[—\-–:·|]\s*/, '').trim()

      const ratingMatch = cleaned.match(/(?:Rating:\s*|⭐\s*|★\s*)(\d+(?:\.\d+)?)\s*(?:\/\s*5)?\s*(?:\(\s*(\d+[kKmM]?\+?)\s*(?:reviews|ratings)?\s*\))?/i)
      if (ratingMatch) {
        rating = ratingMatch[1]
        if (ratingMatch[2]) reviews = ratingMatch[2]
        cleaned = cleaned.replace(ratingMatch[0], '').trim()
      }

      const distMatch = cleaned.match(/(\d+\.?\d*)\s*km\s*(away)?/i)
      if (distMatch) {
        distance = distMatch[1] + ' km'
        cleaned = cleaned.replace(distMatch[0], '').trim()
      }

      cleaned = cleaned.replace(/^[—\-–:·|]\s*/, '').trim()

      const atMatch = cleaned.match(/\bat\s+(.+)$/i)
      if (atMatch && atMatch[1].length > 3) {
        address = atMatch[1].trim().replace(/\.?$/, '')
        cleaned = cleaned.substring(0, atMatch.index).trim()
      }

      const pipeMatch = cleaned.split('|')
      if (pipeMatch.length > 1 && !address) {
        const lastPart = pipeMatch[pipeMatch.length - 1].trim()
        if (lastPart.length > 5 && !lastPart.toLowerCase().includes('review')) {
          address = lastPart
          cleaned = pipeMatch.slice(0, -1).join('|').trim()
        }
      }

      cleaned = cleaned.replace(/[—\-–:·,.|]\s*$/, '').trim()

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

      description = cleaned.replace(/\*\*/g, '').trim()
      if (name.length < 2) continue

      places.push({ name, type, description, address, distance, rating, reviews })
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

  /* ── Render ── */
  return (
    <main className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-5 max-w-6xl mx-auto">
        <div className="text-lg font-bold text-gray-900">Activity Finder</div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          <button onClick={() => { setMode('choose'); setResult(''); setError(''); }} className="hover:text-gray-900 transition cursor-pointer">Discover</button>
          <a href="#" className="hover:text-gray-900 transition">Favorites</a>
          <a href="#" className="hover:text-gray-900 transition">About</a>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#3b5930] text-white flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.name}</span>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-700 transition cursor-pointer ml-2">
              Logout
            </button>
          </div>
        ) : (
          <button onClick={() => router.push('/login')} className="px-5 py-2 rounded-xl bg-[#3b5930] text-white text-sm font-medium hover:bg-[#2e4525] transition cursor-pointer">
            Sign In
          </button>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-6 sm:px-12 pb-20">

        {/* ═══════════════════════════════════════
            Landing / Choose Mode
        ═══════════════════════════════════════ */}
        {mode === 'choose' && (
          <div className="animate-fade-in-up">
            {/* Hero */}
            <div className="py-16 sm:py-24 max-w-2xl">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
                Discover activities<br />near you
              </h1>
              <p className="text-gray-500 text-lg mb-12 max-w-md">
                Find the best places and experiences around you — restaurants, nightlife, group activities and more.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                {/* GPS Option */}
                <button
                  onClick={() => { setMode('gps'); requestGPS(); }}
                  className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-200 hover:border-[#3b5930] hover:bg-[#f8faf8] transition-all cursor-pointer text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#f0f4f0] text-[#3b5930] flex items-center justify-center shrink-0 group-hover:bg-[#3b5930] group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Use My Location</h3>
                    <p className="text-xs text-gray-400">Find things nearby automatically</p>
                  </div>
                </button>

                {/* Manual Option */}
                <button
                  onClick={() => setMode('manual')}
                  className="group flex items-start gap-4 p-5 rounded-2xl border border-gray-200 hover:border-[#3b5930] hover:bg-[#f8faf8] transition-all cursor-pointer text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center shrink-0 group-hover:bg-[#3b5930] group-hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Enter Manually</h3>
                    <p className="text-xs text-gray-400">Search a specific city or area</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
              {[
                { icon: '📍', title: 'Smart Search', desc: 'AI-powered discovery that finds the best spots, not just the nearest.' },
                { icon: '⭐', title: 'Curated Quality', desc: 'Filter by ratings and reviews to find only the best experiences.' },
                { icon: '🔄', title: 'Live Results', desc: 'Real-time data from Google Places combined with local insights.' },
              ].map((f) => (
                <div key={f.title} className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50">
                  <span className="text-2xl mb-4 block">{f.icon}</span>
                  <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <footer className="pt-8 border-t border-gray-100 flex items-center justify-between text-xs text-gray-300">
              <p>© 2026 Activity Finder</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-gray-500 transition">Privacy</a>
                <a href="#" className="hover:text-gray-500 transition">Terms</a>
                <a href="#" className="hover:text-gray-500 transition">Contact</a>
              </div>
            </footer>
          </div>
        )}

        {/* ═══════════════════════════════════════
            Search Configuration
        ═══════════════════════════════════════ */}
        {(mode === 'gps' || mode === 'manual') && (
          <div className="animate-fade-in-up mt-4">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => { setMode('choose'); setError(''); setResult(''); setGpsStatus('idle'); setStreamStatus(''); setIsStreaming(false); }}
                className="text-sm text-gray-400 hover:text-gray-700 transition cursor-pointer mb-4 inline-flex items-center gap-1"
              >
                ← Back
              </button>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {mode === 'gps' ? 'Searching near your location' : 'Search a location'}
              </h2>
              {mode === 'gps' && gpsStatus === 'loading' && (
                <p className="text-sm text-gray-400 mt-2">Acquiring GPS coordinates...</p>
              )}
            </div>

            {/* Manual Inputs */}
            {mode === 'manual' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div>
                  <label className="text-sm font-bold text-gray-900 mb-2 block">City *</label>
                  <input
                    type="text" value={city} onChange={e => setCity(e.target.value)}
                    placeholder="e.g. London"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#3b5930] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-900 mb-2 block">Street / Area</label>
                  <input
                    type="text" value={street} onChange={e => setStreet(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#3b5930] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-900 mb-2 block">Landmark</label>
                  <input
                    type="text" value={landmark} onChange={e => setLandmark(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#3b5930] focus:border-transparent text-sm"
                  />
                </div>
              </div>
            )}

            {/* Category Selection */}
            <div className="mb-8">
              <label className="text-sm font-bold text-gray-900 mb-3 block">What are you looking for?</label>
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer border ${category === cat.value
                      ? 'bg-[#3b5930] text-white border-[#3b5930]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <span className="mr-2">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Radius */}
              <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-gray-900">Search Radius</label>
                  <span className="text-sm font-bold text-[#3b5930]">{radius} km</span>
                </div>
                <input type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-[10px] text-gray-300 mt-2">
                  <span>1 km</span><span>50 km</span>
                </div>
              </div>

              {/* Max Results */}
              <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-gray-900">Max Results</label>
                  <span className="text-sm font-bold text-[#3b5930]">{maxResults}</span>
                </div>
                <input type="range" min={3} max={20} value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-[10px] text-gray-300 mt-2">
                  <span>3</span><span>20</span>
                </div>
              </div>

              {/* Min Rating */}
              <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/50">
                <label className="text-sm font-bold text-gray-900 mb-4 block">Minimum Rating</label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b5930] focus:border-transparent cursor-pointer"
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
              className="w-full sm:w-auto px-12 py-3.5 rounded-xl bg-[#3b5930] hover:bg-[#2e4525] text-white font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Searching...
                </span>
              ) : (
                'Find Activities'
              )}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            Error
        ═══════════════════════════════════════ */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-red-400">⚠</span>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* ── Streaming Progress ── */}
        {loading && streamStatus && (
          <div className="mt-8 p-5 rounded-xl border border-gray-100 bg-gray-50 animate-fade-in">
            <div className="flex items-center gap-4">
              <svg className="animate-spin h-5 w-5 text-[#3b5930]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-600">{streamStatus}</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            Results
        ═══════════════════════════════════════ */}
        {result && (
          <div ref={resultsRef} className="mt-12 animate-fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {isStreaming ? 'Finding results…' : 'Results'}
                </h2>
                <p className="text-sm text-gray-400">
                  {selectedCat?.icon} {selectedCat?.label} within {radius}km
                </p>
              </div>
              {!isStreaming && (
                <button
                  onClick={() => { setResult(''); setError(''); }}
                  className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-gray-900 hover:border-gray-300 transition cursor-pointer"
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
                      className="flex items-start gap-5 p-5 rounded-2xl border border-gray-100 hover:border-gray-200 transition animate-fade-in-up bg-white"
                      style={{ animationDelay: `${i * 0.04}s` }}
                    >
                      {/* Rank */}
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-400 shrink-0">
                        {i + 1}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className="font-bold text-gray-900 text-lg">{place.name}</h3>
                          {place.match_score && (
                            <span className="text-sm font-bold text-[#3b5930] bg-[#f0f4f0] px-2 py-1 rounded-lg shrink-0">
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
                            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md uppercase tracking-wide">{place.type}</span>
                          )}
                          {place.rating && (
                            <span className="text-xs font-bold text-gray-700 flex items-center">
                              <svg className="w-3.5 h-3.5 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                              {place.rating}/5
                              {place.reviews && <span className="text-gray-400 font-medium ml-1 block">({place.reviews})</span>}
                            </span>
                          )}
                          {place.price_level && (
                            <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-md font-medium border border-green-100">{place.price_level}</span>
                          )}
                        </div>

                        {place.why_for_you && (
                          <div className="mb-3 p-3 bg-gradient-to-r from-[#f8faf8] to-transparent border-l-2 border-[#3b5930] rounded-r-xl">
                            <p className="text-sm font-medium text-gray-800 leading-snug">
                              <span className="text-[#3b5930] font-bold mr-1">Why you'll love it:</span>
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
                              <span key={idx} className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-md shrink-0 shadow-sm">
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
                      </div>
                    </div>
                  ))}

                  {/* Streaming skeleton */}
                  {isStreaming && (
                    <div className="p-8 rounded-2xl border border-gray-100 flex justify-center animate-pulse">
                      <div className="flex items-center gap-3">
                        <span className="inline-block w-1.5 h-5 bg-[#3b5930]/30 rounded-sm animate-blink" />
                        <p className="text-sm text-gray-300">Finding more...</p>
                      </div>
                    </div>
                  )}

                  {!isStreaming && places.length === 0 && (
                    <div className="p-12 rounded-2xl border border-gray-100 text-center">
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

        {/* ── Footer (when not on landing) ── */}
        {mode !== 'choose' && (
          <footer className="mt-20 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-300">
              Powered by AI & Google Places • Activity Finder
            </p>
          </footer>
        )}
      </div>
    </main>
  )
}