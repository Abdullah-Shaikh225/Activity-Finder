'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

export default function LandingPage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  /* ── Redirect to onboarding if not completed ── */
  useEffect(() => {
    if (!user) return

    const checkOnboarding = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/auth/preferences/status/${user.id}`
        )
        const data = await res.json()
        if (!data.onboarding_completed) {
          router.push('/onboarding')
        }
      } catch (err) {
        console.error('Onboarding check failed', err)
      }
    }

    checkOnboarding()
  }, [user])

  return (
    <main className="min-h-screen" style={{ background: 'var(--warm-bg)' }}>
      {/* ── Navbar ── */}
      <nav className="border-b border-[#e8e5e0]/60">
        <div className="flex items-center justify-between px-6 sm:px-12 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" /></svg>
            </div>
            <span className="text-base font-bold text-gray-800 tracking-tight">Activity Finder</span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard')} className="text-xs font-semibold text-[#4a6741] hover:text-[#3b5535] transition cursor-pointer px-3 py-1.5 rounded-lg hover:bg-[#eef3ec] hidden sm:block">Dashboard</button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md cursor-pointer" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }} onClick={() => router.push('/dashboard')}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-gray-700 hidden sm:block">{user.name}</span>
              <button onClick={logout} className="text-xs text-gray-400 hover:text-red-400 transition cursor-pointer ml-1 font-medium">Logout</button>
            </div>
          ) : (
            <button onClick={() => router.push('/login')} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all cursor-pointer hover:shadow-lg hover:shadow-[#4a6741]/20 hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #4a6741, #6b8f5e)' }}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 sm:px-12 pb-20">

        {/* ── Hero Section ── */}
        <div className="hero-mesh -mx-6 sm:-mx-12 px-6 sm:px-12 relative overflow-hidden">
          {/* Floating decorative elements */}
          <div className="absolute top-20 right-[15%] w-16 h-16 rounded-full animate-float opacity-20" style={{ background: 'linear-gradient(135deg, #4a6741, #8ab07c)' }} />
          <div className="absolute top-40 right-[8%] w-8 h-8 rounded-lg animate-float-slow delay-300 opacity-15 bg-[#dce8d8] rotate-12" />
          <div className="absolute bottom-20 left-[10%] w-12 h-12 rounded-full animate-float delay-500 opacity-10 bg-[#fef0e8]" />
          <div className="absolute top-32 left-[5%] w-6 h-6 rounded-full animate-pulse-soft bg-[#4a6741] opacity-10" />

          <div className="py-10 sm:py-16 max-w-6xl mx-auto relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left — Copy */}
              <div className="animate-fade-in-up">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-[#dce8d8] text-xs font-semibold text-[#4a6741] mb-6 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#4a6741] animate-pulse-soft" />
                  AI-Powered Discovery
                </div>
                <h1 className="text-4xl sm:text-[3.25rem] font-extrabold text-gray-900 leading-[1.15] mb-6 tracking-tight">
                  Find your next<br />
                  <span className="text-gradient">favorite place</span>
                </h1>
                <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-md">
                  Discover restaurants, nightlife, cafés and hidden gems tailored to your taste — powered by AI and real-time Google data.
                </p>

                {/* Location choice cards — now navigate to /search */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  <button
                    onClick={() => router.push('/search?mode=gps')}
                    className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-[#e8e5e0] hover:border-[#4a6741]/30 hover:shadow-lg hover:shadow-[#4a6741]/5 transition-all duration-300 cursor-pointer text-left hover-lift"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 bg-[#eef3ec] text-[#4a6741] group-hover:scale-110" style={{ boxShadow: '0 4px 12px rgba(74,103,65,0.1)' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">Use My Location</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">Discover places nearby instantly</p>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/search?mode=manual')}
                    className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-[#e8e5e0] hover:border-[#4a6741]/30 hover:shadow-lg hover:shadow-[#4a6741]/5 transition-all duration-300 cursor-pointer text-left hover-lift"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 bg-[#f7f4ef] text-gray-500 group-hover:scale-110 group-hover:text-[#4a6741]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">Search Manually</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">Explore any city or neighborhood</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Right — Decorative visual */}
              <div className="hidden lg:flex justify-center animate-fade-in-up delay-200">
                <div className="relative w-80 h-80">
                  <div className="absolute inset-8 rounded-full border-2 border-dashed border-[#dce8d8] animate-spin" style={{ animationDuration: '30s' }} />
                  <div className="absolute inset-16 rounded-full bg-gradient-to-br from-[#eef3ec] to-[#fef0e8] opacity-60" />
                  {[
                    { icon: '🍽️', top: '5%', left: '45%', delay: '0s' },
                    { icon: '🎉', top: '25%', left: '85%', delay: '0.5s' },
                    { icon: '☕', top: '70%', left: '80%', delay: '1s' },
                    { icon: '🎮', top: '85%', left: '35%', delay: '1.5s' },
                    { icon: '🎵', top: '55%', left: '5%', delay: '2s' },
                    { icon: '📍', top: '10%', left: '15%', delay: '2.5s' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="absolute w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center text-xl animate-float border border-gray-100/80"
                      style={{ top: item.top, left: item.left, animationDelay: item.delay, animationDuration: `${5 + i}s` }}
                    >
                      {item.icon}
                    </div>
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-extrabold text-gradient">AI</div>
                      <div className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mt-1">Powered</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-3 gap-4 -mt-6 mb-16 animate-fade-in-up delay-300">
          {[
            { value: '10K+', label: 'Places Indexed' },
            { value: '4.8★', label: 'Avg. Rating' },
            { value: 'Live', label: 'Google Data' },
          ].map((s, i) => (
            <div key={i} className="text-center py-5 px-4 rounded-2xl bg-white border border-[#e8e5e0] shadow-sm hover-lift">
              <div className="text-xl sm:text-2xl font-extrabold text-gradient">{s.value}</div>
              <div className="text-xs text-gray-400 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── How it works ── */}
        <div className="mb-20">
          <div className="text-center mb-10 animate-fade-in-up delay-400">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">Three simple steps to discover your next adventure</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📍', num: '01', title: 'Share Location', desc: 'Use GPS or type any address. We\'ll find what\'s around you in seconds.' },
              { icon: '🤖', num: '02', title: 'AI Analyzes', desc: 'Our AI cross-references your tastes with live Google data for perfect matches.' },
              { icon: '✨', num: '03', title: 'Discover', desc: 'Get ranked, personalized recommendations with real ratings and insights.' },
            ].map((f, i) => (
              <div key={f.title} className={`group p-7 rounded-2xl bg-white border border-[#e8e5e0] hover-lift border-glow animate-fade-in-up`} style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-3xl">{f.icon}</span>
                  <span className="text-xs font-bold text-[#4a6741]/30 tracking-widest">{f.num}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA Banner ── */}
        <div className="mb-16 p-8 sm:p-10 rounded-3xl relative overflow-hidden animate-fade-in-up delay-700" style={{ background: 'linear-gradient(135deg, #4a6741 0%, #6b8f5e 60%, #8ab07c 100%)' }}>
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
          <div className="relative text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Ready to explore?</h3>
            <p className="text-white/70 text-sm mb-6 max-w-md mx-auto">Start discovering amazing places personalized just for you.</p>
            <button onClick={() => router.push('/login')} className="px-8 py-3 rounded-xl bg-white text-[#4a6741] font-bold text-sm hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer">
              Get Started →
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="pt-8 border-t border-[#e8e5e0] flex items-center justify-between text-xs text-gray-400">
          <p>© 2026 Activity Finder</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#4a6741] transition font-medium">Privacy</a>
            <a href="#" className="hover:text-[#4a6741] transition font-medium">Terms</a>
            <a href="#" className="hover:text-[#4a6741] transition font-medium">Contact</a>
          </div>
        </footer>
      </div>
    </main>
  )
}