'use client'

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const API_URL = 'http://localhost:8000'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || "Something went wrong");
            } else {
                setSuccess(true);
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white">
            {/* Form Side */}
            <div className="flex flex-1 flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32">
                <div className="w-full max-w-[400px] mx-auto">
                    {!success ? (
                        <>
                            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#3b5930] transition font-medium mb-8">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                Back to login
                            </Link>

                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Forgot password?</h1>
                            <p className="mt-2 text-sm text-gray-500 font-medium mb-8">
                                No worries! Enter your registered email and we'll send you a link to reset your password.
                            </p>

                            {error && (
                                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <form className="space-y-5" onSubmit={handleSubmit}>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-black tracking-normal">Email address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#36532B] focus:border-transparent text-sm transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-6 bg-[#3b5930] hover:bg-[#2e4525] text-white py-3.5 rounded-xl font-medium tracking-wide transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Sending..." : "Send Reset Link"}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center animate-fade-in-up">
                            <div className="w-16 h-16 rounded-full bg-[#eef3ec] flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-[#3b5930]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">Check your email</h1>
                            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                                We&apos;ve sent a password reset link to<br />
                                <strong className="text-gray-800">{email}</strong>
                            </p>
                            <p className="text-xs text-gray-400 mb-6">
                                Didn&apos;t receive it? Check your spam folder or{' '}
                                <button onClick={() => { setSuccess(false); setEmail(''); }} className="text-[#3b5930] font-semibold hover:underline cursor-pointer">
                                    try again
                                </button>
                            </p>
                            <Link
                                href="/login"
                                className="inline-block px-8 py-3 bg-[#3b5930] hover:bg-[#2e4525] text-white rounded-xl font-medium text-sm transition-colors"
                            >
                                Back to Login
                            </Link>
                        </div>
                    )}
                </div>
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
    );
}
