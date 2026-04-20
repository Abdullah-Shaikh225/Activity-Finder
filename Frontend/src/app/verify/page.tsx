'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '../context/AuthContext'

function VerifyOTPContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { verifyEmail, resendVerification } = useAuth()

    const email = searchParams.get('email') || ''

    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Focus first input on mount
    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus()
        }
    }, [])

    // Redirect if no email
    useEffect(() => {
        if (!email) {
            router.push('/signup')
        }
    }, [email, router])

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return // Prevent copy paste from firing multiple times incorrectly

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        // Move to next input
        if (value !== '' && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('')
        if (pastedData.length === 0) return

        const newOtp = [...otp]
        pastedData.forEach((char, i) => {
            if (i < 6 && /^\d+$/.test(char)) {
                newOtp[i] = char
            }
        })
        setOtp(newOtp)

        // Focus the next empty box or the last box
        const nextEmptyIndex = newOtp.findIndex(val => val === '')
        if (nextEmptyIndex === -1) {
            inputRefs.current[5]?.focus()
        } else {
            inputRefs.current[nextEmptyIndex]?.focus()
        }
    }

    const handleVerify = async () => {
        const fullOtp = otp.join('')
        if (fullOtp.length !== 6) {
            setStatus('error')
            setErrorMessage('Please enter all 6 digits')
            return
        }

        setStatus('loading')
        setErrorMessage('')

        const result = await verifyEmail(email, fullOtp)

        if (result.success) {
            setStatus('success')
            setTimeout(() => {
                router.push('/onboarding')
            }, 1000)
        } else {
            setStatus('error')
            setErrorMessage(result.error || 'Verification failed. Incorrect or expired code.')
        }
    }

    const handleResend = async () => {
        setResendStatus('sending')
        const result = await resendVerification(email)
        if (result.success) {
            setResendStatus('sent')
            setTimeout(() => setResendStatus('idle'), 5000)
        } else {
            setResendStatus('error')
            setStatus('error')
            setErrorMessage(result.error || 'Failed to resend code.')
        }
    }

    if (status === 'success') {
        return (
            <div className="w-full max-w-[400px] mx-auto text-center animate-fade-in-up">
                <div className="w-20 h-20 rounded-full bg-[#f0f4f0] flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-[#3b5930]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Verified!</h1>
                <p className="text-sm font-medium text-gray-500 mb-8">
                    Your account is now active. Taking you to the portal...
                </p>
            </div>
        )
    }

    return (
        <div className="w-full max-w-[440px] mx-auto">
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#f0f4f0] flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-[#3b5930]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Check your email</h1>
                <p className="text-sm font-medium text-gray-500">
                    We sent a 6-digit code to <br />
                    <span className="font-bold text-gray-900">{email}</span>
                </p>
            </div>

            {status === 'error' && (
                <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">
                    {errorMessage}
                </div>
            )}

            <div className="flex justify-between gap-2 sm:gap-3 mb-8">
                {otp.map((digit, index) => (
                    <input
                        key={index}
                        ref={(el) => {
                            inputRefs.current[index] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#36532B] focus:border-transparent text-gray-900 transition-all bg-gray-50 focus:bg-white"
                    />
                ))}
            </div>

            <button
                onClick={handleVerify}
                disabled={status === 'loading' || otp.join('').length !== 6}
                className="w-full bg-[#3b5930] hover:bg-[#2e4525] text-white py-3.5 rounded-xl font-medium tracking-wide transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            >
                {status === 'loading' ? 'Verifying...' : 'Verify Email'}
            </button>

            <div className="text-center">
                <p className="text-sm text-gray-500 font-medium">
                    Didn&apos;t receive the code?{' '}
                    <button
                        onClick={handleResend}
                        disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                        className="text-[#3b5930] font-bold hover:underline disabled:opacity-50"
                    >
                        {resendStatus === 'sending' ? 'Sending...' :
                            resendStatus === 'sent' ? 'Code Sent!' : 'Click to resend'}
                    </button>
                </p>
            </div>
        </div>
    )
}

export default function VerifyPage() {
    return (
        <div className="flex min-h-screen bg-white">
            <div className="flex flex-1 flex-col justify-center px-4 sm:px-8 md:px-16 lg:px-24">
                <Suspense fallback={
                    <div className="w-full max-w-[400px] mx-auto text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-6">
                            <span className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
                    </div>
                }>
                    <VerifyOTPContent />
                </Suspense>
            </div>

            {/* Image Side */}
            <div className="hidden lg:block lg:flex-1 relative p-2 pr-2">
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#f5f5f5]">
                    <Image
                        src="/bg-leaves.png"
                        alt="Leaves background"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    )
}
