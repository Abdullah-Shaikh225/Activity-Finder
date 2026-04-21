'use client'

import Image from "next/image";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = 'http://localhost:8000'

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!token) {
            setError("Invalid reset link. Please request a new one.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: password }),
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

    if (!token) {
        return (
            <div className="flex min-h-screen bg-white items-center justify-center">
                <div className="text-center max-w-md px-8">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">Invalid Reset Link</h1>
                    <p className="text-sm text-gray-500 mb-6">This password reset link is invalid or has expired.</p>
                    <Link href="/forgot-password" className="inline-block px-8 py-3 bg-[#3b5930] hover:bg-[#2e4525] text-white rounded-xl font-medium text-sm transition-colors">
                        Request New Link
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-white">
            {/* Form Side */}
            <div className="flex flex-1 flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32">
                <div className="w-full max-w-[400px] mx-auto">
                    {!success ? (
                        <>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Set new password</h1>
                            <p className="mt-2 text-sm text-gray-500 font-medium mb-8">
                                Your new password must be at least 6 characters long.
                            </p>

                            {error && (
                                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <form className="space-y-5" onSubmit={handleSubmit}>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-black tracking-normal">New Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        minLength={6}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#36532B] focus:border-transparent text-sm transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-black tracking-normal">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        minLength={6}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#36532B] focus:border-transparent text-sm transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-6 bg-[#3b5930] hover:bg-[#2e4525] text-white py-3.5 rounded-xl font-medium tracking-wide transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Resetting..." : "Reset Password"}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center animate-fade-in-up">
                            <div className="w-16 h-16 rounded-full bg-[#eef3ec] flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-[#3b5930]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-3">Password updated!</h1>
                            <p className="text-sm text-gray-500 mb-8">
                                Your password has been reset successfully. You can now log in with your new password.
                            </p>
                            <button
                                onClick={() => router.push('/login')}
                                className="inline-block px-8 py-3 bg-[#3b5930] hover:bg-[#2e4525] text-white rounded-xl font-medium text-sm transition-colors cursor-pointer"
                            >
                                Go to Login
                            </button>
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

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="w-12 h-12 border-4 border-[#3b5930]/20 border-t-[#3b5930] rounded-full animate-spin" />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
