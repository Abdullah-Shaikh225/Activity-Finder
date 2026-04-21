'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

interface DayScheduleItem {
    time: string
    activity: string
    type: string
    place: string
    cost: string
    tip?: string
}

interface DayPlan {
    day: number
    title: string
    schedule: DayScheduleItem[]
}

interface Itinerary {
    id: number
    name: string
    style: string
    tagline: string
    estimated_total_cost: string
    cost_breakdown: {
        transport: string
        accommodation: string
        food: string
        activities: string
    }
    transport: {
        mode: string
        details: string
        estimated_cost: string
        booking_tip: string
        departure_time?: string
        arrival_time?: string
    }
    hotel: {
        name: string
        rating: number
        price_per_night: string
        why_chosen: string
        address: string
    }
    days: DayPlan[]
    highlights: string[]
}

interface TripData {
    trip_summary: {
        source: string
        destination: string
        dates: string
        duration: string
        group_size: number
        travel_distance: string
    }
    itineraries: Itinerary[]
}

const styleConfig: Record<string, { icon: string; gradient: string; border: string; bg: string; text: string }> = {
    budget: { icon: '💰', gradient: 'from-green-50 to-emerald-50', border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700' },
    balanced: { icon: '⚖️', gradient: 'from-blue-50 to-cyan-50', border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
    premium: { icon: '✨', gradient: 'from-amber-50 to-yellow-50', border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
    adventure: { icon: '🏔️', gradient: 'from-purple-50 to-indigo-50', border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' },
}

const typeIcons: Record<string, string> = {
    transport: '🚆',
    meal: '🍽️',
    activity: '🎯',
    hotel: '🏨',
    nightlife: '🎉',
    sightseeing: '📸',
    shopping: '🛍️',
    rest: '😴',
    breakfast: '☕',
}

export default function TripPage() {
    const router = useRouter()
    const { user } = useAuth()
    const resultsRef = useRef<HTMLDivElement>(null)

    // Form state
    const [source, setSource] = useState('')
    const [destination, setDestination] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [budget, setBudget] = useState('moderate')
    const [travelMode, setTravelMode] = useState('any')
    const [groupSize, setGroupSize] = useState(2)
    const [interests, setInterests] = useState<string[]>([])

    // Result state
    const [result, setResult] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [streamStatus, setStreamStatus] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [selectedItinerary, setSelectedItinerary] = useState<number | null>(null)
    const [expandedDay, setExpandedDay] = useState<number | null>(null)

    // Scroll to results
    useEffect(() => {
        if (result && resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [result])

    // Interest options
    const interestOptions = [
        { value: 'history', label: 'History & Culture', icon: '🏛️' },
        { value: 'food', label: 'Food & Cuisine', icon: '🍜' },
        { value: 'adventure', label: 'Adventure', icon: '🧗' },
        { value: 'nightlife', label: 'Nightlife', icon: '🌙' },
        { value: 'nature', label: 'Nature & Outdoors', icon: '🌿' },
        { value: 'shopping', label: 'Shopping', icon: '🛍️' },
        { value: 'photography', label: 'Photography', icon: '📸' },
        { value: 'spiritual', label: 'Spiritual', icon: '🕉️' },
    ]

    function toggleInterest(val: string) {
        setInterests(prev =>
            prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
        )
    }

    // Parse the LLM response into structured data
    function parseTripData(text: string): TripData | null {
        try {
            let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim()
            const firstBrace = cleanText.indexOf('{')
            const lastBrace = cleanText.lastIndexOf('}')
            if (firstBrace === -1 || lastBrace === -1) return null
            const jsonStr = cleanText.substring(firstBrace, lastBrace + 1)
            return JSON.parse(jsonStr)
        } catch {
            return null
        }
    }

    // ── PDF Download ──
    async function downloadItineraryPDF(itin: Itinerary) {
        if (!tripData) return
        const html2pdf = (await import('html2pdf.js')).default

        const typeIconsMap: Record<string, string> = {
            transport: '🚆', meal: '🍽️', activity: '🎯', hotel: '🏨',
            nightlife: '🎉', sightseeing: '📸', shopping: '🛍️', rest: '😴', breakfast: '☕',
        }

        const daysHtml = itin.days.map(day => `
            <div style="margin-bottom: 24px; page-break-inside: avoid;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #4a6741, #6b8f5e); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">D${day.day}</div>
                    <div><div style="font-weight: 700; font-size: 15px; color: #1a1a1a;">${day.title}</div><div style="font-size: 11px; color: #999;">${day.schedule?.length || 0} activities</div></div>
                </div>
                <div style="margin-left: 18px; border-left: 2px solid #e0ddd8; padding-left: 20px;">
                    ${(day.schedule || []).map(item => `
                        <div style="margin-bottom: 14px; padding: 12px 14px; background: #f9f8f6; border-radius: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 14px;">${typeIconsMap[item.type] || '📍'}</span>
                                    <span style="font-size: 11px; font-weight: 700; color: #4a6741; background: #eef3ec; padding: 2px 8px; border-radius: 6px;">${item.time}</span>
                                </div>
                                ${item.cost && item.cost !== '₹0' ? `<span style="font-size: 11px; font-weight: 700; color: #666;">${item.cost}</span>` : ''}
                            </div>
                            <div style="font-size: 13px; font-weight: 600; color: #333;">${item.activity}</div>
                            ${item.place ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">📍 ${item.place}</div>` : ''}
                            ${item.tip ? `<div style="font-size: 11px; color: #4a6741; margin-top: 4px; font-weight: 500;">💡 ${item.tip}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')

        const costEntries = Object.entries(itin.cost_breakdown).map(([key, val]) => `
            <div style="text-align: center; padding: 10px; background: #f5f4f2; border-radius: 10px; flex: 1; min-width: 100px;">
                <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 4px;">${key}</div>
                <div style="font-size: 13px; font-weight: 700; color: #1a1a1a;">${val}</div>
            </div>
        `).join('')

        const highlightsHtml = itin.highlights?.length ? `
            <div style="margin-top: 24px; padding: 18px; background: #f0f4ee; border: 1px solid #dce8d8; border-radius: 14px;">
                <div style="font-weight: 700; font-size: 14px; color: #1a1a1a; margin-bottom: 10px;">⭐ Trip Highlights</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${itin.highlights.map(hl => `<span style="font-size: 11px; font-weight: 500; color: #555; background: white; padding: 5px 12px; border-radius: 20px; border: 1px solid #e0ddd8;">✓ ${hl}</span>`).join('')}
                </div>
            </div>
        ` : ''

        const fullHtml = `
        <div id="pdf-content" style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 700px; margin: 0 auto; padding: 0;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4a6741 0%, #6b8f5e 60%, #8ab07c 100%); padding: 28px 30px; border-radius: 16px; margin-bottom: 24px; color: white;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                    </div>
                    <span style="font-size: 16px; font-weight: 700;">Activity Finder</span>
                </div>
                <div style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">✈️ ${tripData.trip_summary.source} → ${tripData.trip_summary.destination}</div>
                <div style="font-size: 13px; opacity: 0.85; display: flex; gap: 16px; flex-wrap: wrap;">
                    <span>📅 ${tripData.trip_summary.dates}</span>
                    <span>⏱ ${tripData.trip_summary.duration}</span>
                    <span>👥 ${tripData.trip_summary.group_size} ${tripData.trip_summary.group_size === 1 ? 'person' : 'people'}</span>
                </div>
            </div>

            <!-- Itinerary Name -->
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 20px; font-weight: 800; color: #1a1a1a;">${itin.name}</div>
                <div style="font-size: 13px; color: #999; margin-top: 4px;">${itin.tagline}</div>
                <div style="font-size: 22px; font-weight: 800; color: #4a6741; margin-top: 8px;">${itin.estimated_total_cost} <span style="font-size: 11px; font-weight: 400; color: #aaa;">per person estimate</span></div>
            </div>

            <!-- Transport & Hotel -->
            <div style="display: flex; gap: 14px; margin-bottom: 24px;">
                <div style="flex: 1; padding: 18px; background: #f9f8f6; border: 1px solid #e8e5e0; border-radius: 14px;">
                    <div style="font-size: 18px; margin-bottom: 4px;">🚆</div>
                    <div style="font-weight: 700; font-size: 14px; color: #1a1a1a; margin-bottom: 2px;">Transport</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 6px;">${itin.transport.details}</div>
                    <div style="font-size: 13px; font-weight: 700; color: #4a6741;">${itin.transport.estimated_cost}</div>
                    ${itin.transport.booking_tip ? `<div style="font-size: 11px; color: #888; margin-top: 6px; background: #f0f0ee; padding: 6px 10px; border-radius: 8px;">💡 ${itin.transport.booking_tip}</div>` : ''}
                </div>
                <div style="flex: 1; padding: 18px; background: #f9f8f6; border: 1px solid #e8e5e0; border-radius: 14px;">
                    <div style="font-size: 18px; margin-bottom: 4px;">🏨</div>
                    <div style="font-weight: 700; font-size: 14px; color: #1a1a1a; margin-bottom: 2px;">Accommodation</div>
                    <div style="font-size: 13px; font-weight: 600; color: #333;">${itin.hotel.name}</div>
                    ${itin.hotel.rating > 0 ? `<div style="font-size: 12px; color: #e6a817; margin: 4px 0;">⭐ ${itin.hotel.rating}/5</div>` : ''}
                    <div style="font-size: 13px; font-weight: 700; color: #4a6741;">${itin.hotel.price_per_night}/night</div>
                </div>
            </div>

            <!-- Cost Breakdown -->
            <div style="padding: 18px; border: 1px solid #e8e5e0; border-radius: 14px; margin-bottom: 28px;">
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px;">💰 Cost Breakdown</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">${costEntries}</div>
                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e8e5e0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; color: #555;">Total Estimated</span>
                    <span style="font-size: 18px; font-weight: 800; color: #4a6741;">${itin.estimated_total_cost}</span>
                </div>
            </div>

            <!-- Day-by-Day -->
            <div style="font-weight: 700; font-size: 16px; margin-bottom: 16px;">📅 Day-by-Day Plan</div>
            ${daysHtml}

            ${highlightsHtml}

            <!-- Footer -->
            <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e8e5e0; text-align: center;">
                <div style="font-size: 11px; color: #bbb;">Generated by Activity Finder • Powered by AI, Google Places & Google Maps</div>
            </div>
        </div>`

        const container = document.createElement('div')
        container.innerHTML = fullHtml
        document.body.appendChild(container)

        try {
            await html2pdf().set({
                margin: [12, 12, 12, 12],
                filename: `${tripData.trip_summary.destination.replace(/\s+/g, '_')}_Itinerary_${itin.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
            }).from(container.firstElementChild).save()
        } finally {
            document.body.removeChild(container)
        }
    }

    async function handlePlanTrip() {
        if (!user) {
            router.push('/login')
            return
        }
        if (!source.trim() || !destination.trim() || !startDate || !endDate) {
            setError('Please fill in all required fields.')
            return
        }

        setLoading(true)
        setResult('')
        setError('')
        setStreamStatus('')
        setIsStreaming(true)
        setSelectedItinerary(null)

        try {
            const response = await fetch('http://localhost:8000/trip/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source,
                    destination,
                    start_date: startDate,
                    end_date: endDate,
                    budget,
                    travel_mode: travelMode,
                    group_size: groupSize,
                    interests,
                    user_id: user.id,
                }),
            })

            if (!response.ok) throw new Error('Trip planning failed. Please try again.')
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
                            setResult(prev => prev + data.content)
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
                        if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr
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

    const tripData = result ? parseTripData(result) : null

    // Get today's date for min date
    const today = new Date().toISOString().split('T')[0]

    return (
        <main className="min-h-screen" style={{ background: 'var(--warm-bg)' }}>
            <div className="max-w-6xl mx-auto px-6 sm:px-12 pb-20 pt-8">

                {/* Header */}
                <div className="mb-8 animate-fade-in-up">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-sm text-gray-400 hover:text-[#4a6741] transition cursor-pointer mb-4 inline-flex items-center gap-1.5 font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Dashboard
                    </button>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                        Plan a Trip ✈️
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Tell us where you're going and we'll craft complete itineraries with hotels, meals, activities & more.
                    </p>
                </div>

                {/* ── Form ── */}
                <div className="space-y-6 animate-fade-in-up delay-100">

                    {/* Source & Destination */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 block">From *</label>
                            <input
                                type="text" value={source} onChange={e => setSource(e.target.value)}
                                placeholder="e.g. Mumbai"
                                className="w-full px-4 py-3.5 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 block">To *</label>
                            <input
                                type="text" value={destination} onChange={e => setDestination(e.target.value)}
                                placeholder="e.g. Goa"
                                className="w-full px-4 py-3.5 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Dates & Group Size */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 block">Start Date *</label>
                            <input
                                type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                min={today}
                                className="w-full px-4 py-3.5 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 block">End Date *</label>
                            <input
                                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                min={startDate || today}
                                className="w-full px-4 py-3.5 rounded-xl border border-[#e8e5e0] bg-white focus:outline-none focus:ring-2 focus:ring-[#4a6741]/30 focus:border-[#4a6741] text-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-2 block">Group Size</label>
                            <div className="flex items-center gap-3 h-[50px]">
                                <button onClick={() => setGroupSize(Math.max(1, groupSize - 1))} className="w-10 h-10 rounded-xl border border-[#e8e5e0] bg-white flex items-center justify-center text-lg font-bold text-gray-500 hover:border-[#4a6741]/30 hover:text-[#4a6741] transition cursor-pointer">−</button>
                                <span className="text-xl font-extrabold text-gray-900 w-8 text-center">{groupSize}</span>
                                <button onClick={() => setGroupSize(Math.min(20, groupSize + 1))} className="w-10 h-10 rounded-xl border border-[#e8e5e0] bg-white flex items-center justify-center text-lg font-bold text-gray-500 hover:border-[#4a6741]/30 hover:text-[#4a6741] transition cursor-pointer">+</button>
                                <span className="text-xs text-gray-400 font-medium ml-1">{groupSize === 1 ? 'Solo' : groupSize === 2 ? 'Couple' : `${groupSize} people`}</span>
                            </div>
                        </div>
                    </div>

                    {/* Budget & Travel Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-3 block">Budget</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'budget', label: 'Budget', icon: '💰' },
                                    { value: 'moderate', label: 'Moderate', icon: '⚖️' },
                                    { value: 'premium', label: 'Premium', icon: '✨' },
                                    { value: 'luxury', label: 'Luxury', icon: '👑' },
                                ].map(b => (
                                    <button
                                        key={b.value}
                                        onClick={() => setBudget(b.value)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${budget === b.value
                                            ? 'text-white border-transparent shadow-md'
                                            : 'bg-white text-gray-600 border-[#e8e5e0] hover:border-[#4a6741]/30'
                                            }`}
                                        style={budget === b.value ? { background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' } : {}}
                                    >
                                        <span className="mr-1.5">{b.icon}</span>{b.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-800 mb-3 block">Travel Mode</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'train', label: 'Train', icon: '🚆' },
                                    { value: 'flight', label: 'Flight', icon: '✈️' },
                                    { value: 'bus', label: 'Bus', icon: '🚌' },
                                    { value: 'any', label: 'Any', icon: '🗺️' },
                                ].map(m => (
                                    <button
                                        key={m.value}
                                        onClick={() => setTravelMode(m.value)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${travelMode === m.value
                                            ? 'text-white border-transparent shadow-md'
                                            : 'bg-white text-gray-600 border-[#e8e5e0] hover:border-[#4a6741]/30'
                                            }`}
                                        style={travelMode === m.value ? { background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' } : {}}
                                    >
                                        <span className="mr-1.5">{m.icon}</span>{m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Interests */}
                    <div>
                        <label className="text-sm font-bold text-gray-800 mb-3 block">Interests <span className="text-gray-400 font-normal">(optional)</span></label>
                        <div className="flex flex-wrap gap-2">
                            {interestOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleInterest(opt.value)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border ${interests.includes(opt.value)
                                        ? 'bg-[#eef3ec] border-[#4a6741]/30 text-[#4a6741] shadow-sm'
                                        : 'bg-white text-gray-500 border-[#e8e5e0] hover:border-[#4a6741]/20'
                                        }`}
                                >
                                    <span className="mr-1.5">{opt.icon}</span>{opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handlePlanTrip}
                        disabled={loading || !source.trim() || !destination.trim() || !startDate || !endDate}
                        className="w-full sm:w-auto px-12 py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:shadow-lg hover:shadow-[#4a6741]/20 hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                Planning your trip...
                            </span>
                        ) : (
                            '🗺️ Plan My Trip'
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

                {/* ── Streaming Status ── */}
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

                        {/* Trip Summary Header */}
                        {tripData && (
                            <div className="mb-8 p-6 rounded-2xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4a6741 0%, #6b8f5e 60%, #8ab07c 100%)' }}>
                                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
                                <div className="relative">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-2xl">✈️</span>
                                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                                            {tripData.trip_summary.source} → {tripData.trip_summary.destination}
                                        </h2>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-white/80 text-sm">
                                        <span>📅 {tripData.trip_summary.dates}</span>
                                        <span>⏱ {tripData.trip_summary.duration}</span>
                                        <span>👥 {tripData.trip_summary.group_size} {tripData.trip_summary.group_size === 1 ? 'person' : 'people'}</span>
                                        {tripData.trip_summary.travel_distance && <span>📏 {tripData.trip_summary.travel_distance}</span>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Itinerary Selection Cards */}
                        {tripData && tripData.itineraries && (
                            <>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Choose Your Itinerary</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    {tripData.itineraries.map((itin) => {
                                        const style = styleConfig[itin.style] || styleConfig.balanced
                                        const isSelected = selectedItinerary === itin.id
                                        return (
                                            <button
                                                key={itin.id}
                                                onClick={() => { setSelectedItinerary(itin.id); setExpandedDay(null); }}
                                                className={`p-5 rounded-2xl text-left transition-all cursor-pointer border-2 hover-lift ${isSelected
                                                    ? `bg-gradient-to-br ${style.gradient} ${style.border} shadow-lg`
                                                    : 'bg-white border-[#e8e5e0] hover:border-[#4a6741]/20'
                                                    }`}
                                            >
                                                <div className="text-2xl mb-2">{style.icon}</div>
                                                <h4 className="font-bold text-gray-900 text-base mb-1">{itin.name}</h4>
                                                <p className="text-xs text-gray-400 mb-3 leading-relaxed">{itin.tagline}</p>
                                                <div className="text-lg font-extrabold text-[#4a6741]">{itin.estimated_total_cost}</div>
                                                <p className="text-[10px] text-gray-400 mt-1">per person estimate</p>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Selected Itinerary Detail */}
                                {selectedItinerary && (() => {
                                    const itin = tripData.itineraries.find(i => i.id === selectedItinerary)
                                    if (!itin) return null
                                    const style = styleConfig[itin.style] || styleConfig.balanced

                                    return (
                                        <div className="space-y-6 animate-fade-in-up">

                                            {/* Transport & Hotel Overview */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Transport */}
                                                <div className="p-5 rounded-2xl bg-white border border-[#e8e5e0] hover-lift">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-blue-50 border border-blue-200">🚆</div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900">Transport</h4>
                                                            <p className="text-xs text-gray-400">{itin.transport.mode}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-700 mb-2 font-medium">{itin.transport.details}</p>
                                                    <p className="text-sm font-bold text-[#4a6741] mb-2">{itin.transport.estimated_cost}</p>
                                                    {itin.transport.booking_tip && (
                                                        <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">💡 {itin.transport.booking_tip}</p>
                                                    )}
                                                </div>

                                                {/* Hotel */}
                                                <div className="p-5 rounded-2xl bg-white border border-[#e8e5e0] hover-lift">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-amber-50 border border-amber-200">🏨</div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900">Accommodation</h4>
                                                            <p className="text-xs text-gray-400">{itin.hotel.price_per_night}/night</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-700 font-semibold mb-1">{itin.hotel.name}</p>
                                                    {itin.hotel.rating > 0 && (
                                                        <div className="flex items-center gap-1 mb-2">
                                                            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                            <span className="text-xs font-bold text-gray-700">{itin.hotel.rating}/5</span>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-gray-400">{itin.hotel.why_chosen}</p>
                                                </div>
                                            </div>

                                            {/* Cost Breakdown */}
                                            <div className="p-5 rounded-2xl bg-white border border-[#e8e5e0]">
                                                <h4 className="font-bold text-gray-900 mb-4">💰 Cost Breakdown</h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {Object.entries(itin.cost_breakdown).map(([key, val]) => (
                                                        <div key={key} className="text-center p-3 rounded-xl bg-gray-50">
                                                            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">{key}</p>
                                                            <p className="text-sm font-bold text-gray-900">{val}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-[#e8e5e0] flex items-center justify-between">
                                                    <span className="font-bold text-gray-700">Total Estimated Cost</span>
                                                    <span className="text-xl font-extrabold text-[#4a6741]">{itin.estimated_total_cost}</span>
                                                </div>
                                            </div>

                                            {/* Day-by-Day Schedule */}
                                            <h4 className="font-bold text-gray-900 text-lg">📅 Day-by-Day Plan</h4>
                                            <div className="space-y-3">
                                                {itin.days.map(day => {
                                                    const isExpanded = expandedDay === day.day
                                                    return (
                                                        <div key={day.day} className="rounded-2xl bg-white border border-[#e8e5e0] overflow-hidden transition-all">
                                                            <button
                                                                onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                                                                className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors text-left"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
                                                                        D{day.day}
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="font-bold text-gray-900">{day.title}</h5>
                                                                        <p className="text-xs text-gray-400">{day.schedule?.length || 0} activities</p>
                                                                    </div>
                                                                </div>
                                                                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>

                                                            {isExpanded && day.schedule && (
                                                                <div className="px-5 pb-5 border-t border-[#e8e5e0]">
                                                                    <div className="relative pl-6 pt-4 space-y-4">
                                                                        {/* Timeline line */}
                                                                        <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-[#e8e5e0]" />
                                                                        {day.schedule.map((item, idx) => (
                                                                            <div key={idx} className="relative flex gap-4">
                                                                                {/* Timeline dot */}
                                                                                <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#4a6741] z-10" />
                                                                                <div className="flex-1 p-3 rounded-xl bg-gray-50 hover:bg-[#eef3ec]/50 transition-colors">
                                                                                    <div className="flex items-center justify-between mb-1">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-sm">{typeIcons[item.type] || '📍'}</span>
                                                                                            <span className="text-xs font-bold text-[#4a6741] bg-[#eef3ec] px-2 py-0.5 rounded-md">{item.time}</span>
                                                                                        </div>
                                                                                        {item.cost && item.cost !== '₹0' && (
                                                                                            <span className="text-xs font-bold text-gray-500">{item.cost}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-sm font-semibold text-gray-800">{item.activity}</p>
                                                                                    {item.place && <p className="text-xs text-gray-400 mt-0.5">📍 {item.place}</p>}
                                                                                    {item.tip && <p className="text-xs text-[#4a6741] mt-1 font-medium">💡 {item.tip}</p>}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Highlights */}
                                            {itin.highlights && itin.highlights.length > 0 && (
                                                <div className={`p-5 rounded-2xl bg-gradient-to-br ${style.gradient} border ${style.border}`}>
                                                    <h4 className="font-bold text-gray-900 mb-3">⭐ Trip Highlights</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {itin.highlights.map((hl, idx) => (
                                                            <span key={idx} className="text-xs font-medium text-gray-700 bg-white/80 px-3 py-1.5 rounded-full border border-white/50 shadow-sm">
                                                                ✓ {hl}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Download PDF */}
                                            <div className="flex justify-center pt-2">
                                                <button
                                                    onClick={() => downloadItineraryPDF(itin)}
                                                    className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4a6741]/20 hover:-translate-y-0.5 flex items-center gap-2"
                                                    style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Download Itinerary PDF
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </>
                        )}

                        {/* Streaming skeleton */}
                        {isStreaming && (
                            <div className="p-8 rounded-2xl border border-[#e8e5e0] bg-white flex justify-center animate-pulse mt-8">
                                <div className="flex items-center gap-3">
                                    <span className="inline-block w-1.5 h-5 bg-[#4a6741]/30 rounded-sm animate-blink" />
                                    <p className="text-sm text-gray-400">Building your trip plan...</p>
                                </div>
                            </div>
                        )}

                        {/* No results / could not parse */}
                        {!isStreaming && !tripData && result && (
                            <div className="p-8 rounded-2xl border border-[#e8e5e0] bg-white text-center mt-8">
                                <p className="text-3xl mb-4">🗺️</p>
                                <h3 className="font-bold text-gray-900 mb-2">Processing your trip plan...</h3>
                                <p className="text-sm text-gray-400 max-w-sm mx-auto">
                                    The AI is still formatting. Try refreshing or planning again.
                                </p>
                            </div>
                        )}

                        {/* Reset button */}
                        {!isStreaming && tripData && (
                            <div className="mt-8 text-center">
                                <button
                                    onClick={() => { setResult(''); setError(''); setSelectedItinerary(null); }}
                                    className="px-6 py-2.5 rounded-xl border border-[#e8e5e0] text-sm text-gray-500 hover:text-[#4a6741] hover:border-[#4a6741]/30 transition-all cursor-pointer font-medium"
                                >
                                    ← Plan Another Trip
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-20 pt-6 border-t border-[#e8e5e0] text-center">
                    <p className="text-xs text-gray-400">
                        Powered by AI, Google Places & Google Maps • Activity Finder
                    </p>
                </footer>
            </div>
        </main>
    )
}
