'use client'

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const router = useRouter();
    const { login, googleLogin } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await login(email, password);
        setLoading(false);

        if (result.success) {
            if (result.user && !result.user.onboarded) {
                router.push("/onboarding");
            } else {
                router.push("/");
            }
        } else {
            if (result.requiresVerification) {
                router.push(`/verify?email=${encodeURIComponent(email)}`);
            } else {
                setError(result.error || "Login failed");
            }
        }
    };

    return (
        <div className="flex min-h-screen bg-white">
            {/* Form Side */}
            <div className="flex flex-1 flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32">
                <div className="w-full max-w-[400px] mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back!</h1>
                    <p className="mt-2 text-sm text-gray-800 font-medium mb-8">Enter your Credentials to access your account</p>

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

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-black tracking-normal">Password</label>
                                <Link href="#" className="text-xs text-blue-600 hover:underline">forgot password</Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#36532B] focus:border-transparent text-sm transition-all"
                            />
                        </div>

                        <div className="flex items-center mt-2">
                            <input
                                id="remember"
                                type="checkbox"
                                className="h-4 w-4 rounded-md border-gray-300 text-[#36532B] focus:ring-[#36532B]"
                            />
                            <label htmlFor="remember" className="ml-2 block text-xs text-black font-semibold">
                                Remember for 30 days
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-6 bg-[#3b5930] hover:bg-[#2e4525] text-white py-3.5 rounded-xl font-medium tracking-wide transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Logging in..." : "Login"}
                        </button>
                    </form>

                    <div className="mt-8 flex items-center">
                        <div className="flex-1 border-t border-gray-100"></div>
                        <div className="px-4 text-xs text-gray-500 font-medium">Or</div>
                        <div className="flex-1 border-t border-gray-100"></div>
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={googleLogin}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                            </svg>
                            Sign in with Google
                        </button>
                    </div>

                    <p className="mt-8 text-center text-sm font-bold text-gray-700">
                        Don&apos;t have an account? <Link href="/signup" className="text-blue-600 hover:underline">Sign Up</Link>
                    </p>
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
