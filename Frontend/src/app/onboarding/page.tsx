'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function OnboardingPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [step, setStep] = useState(1);

    // Form State
    const [preferences, setPreferences] = useState({
        cuisines: [] as string[],
        vibe: [] as string[],
        budget: '',
        group: '',
        time: [] as string[],
        dislikes: [] as string[],
        customDislike: ''
    });

    const [loading, setLoading] = useState(false);

    // 1. Cuisines
    const cuisineOptions = [
        "Italian", "Japanese", "Indian", "Chinese", "Mediterranean",
        "Street Food", "Continental", "Seafood", "Mexican", "Thai"
    ];

    // 2. Vibe
    const vibeOptions = [
        "Rooftop", "Cozy & Quiet", "Trendy & Aesthetic", "Loud & Lively",
        "Local & Authentic", "Luxurious", "Casual", "Hidden Gems"
    ];

    // 3. Budget
    const budgetOptions = [
        "Under ₹500", "₹500–1500", "₹1500–3000", "₹3000+"
    ];

    // 4. Group
    const groupOptions = [
        "Solo", "Couple", "Small group 3–5", "Large group 6+"
    ];

    // 5. Time
    const timeOptions = [
        "Weekday evenings", "Weekend nights", "Afternoons", "Late nights"
    ];

    // 6. Dislikes
    const dislikeOptions = [
        "Loud clubs", "Fast food chains", "Crowded places",
        "Smoking zones", "Rooftop (fear of heights)", "Far locations"
    ];

    const toggleMultiSelect = (field: 'cuisines' | 'vibe' | 'time' | 'dislikes', value: string) => {
        setPreferences(prev => {
            const current = prev[field];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter(item => item !== value) };
            } else {
                return { ...prev, [field]: [...current, value] };
            }
        });
    };

    const setSingleSelect = (field: 'budget' | 'group', value: string) => {
        setPreferences(prev => ({ ...prev, [field]: value }));
    };

    const addCustomDislike = () => {
        if (preferences.customDislike.trim() !== '') {
            setPreferences(prev => ({
                ...prev,
                dislikes: [...prev.dislikes, prev.customDislike.trim()],
                customDislike: ''
            }));
        }
    };

    const handleCustomDislikeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomDislike();
        }
    };

    const isStepValid = () => {
        switch (step) {
            case 1: return preferences.cuisines.length > 0;
            case 2: return preferences.vibe.length > 0;
            case 3: return preferences.budget !== '';
            case 4: return preferences.group !== '';
            case 5: return preferences.time.length > 0;
            case 6: return true; // dislikes are optional
            default: return true;
        }
    };

    const handleNext = () => {
        if (step < 6) {
            setStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            if (user) {
                const res = await fetch('http://localhost:8000/auth/preferences', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: user.id,
                        cuisines: preferences.cuisines,
                        vibe: preferences.vibe,
                        budget: preferences.budget,
                        group_type: preferences.group,
                        outing_time: preferences.time,
                        dislikes: preferences.dislikes
                    })
                });
                if (!res.ok) {
                    console.error('Failed to save preferences');
                }
            }
        } catch (error) {
            console.error('Error saving preferences', error);
        } finally {
            setLoading(false);
            router.push('/dashboard');
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">What cuisines do you love?</h2>
                        <p className="text-gray-500 mb-6">Select all that apply to help us recommend the best spots.</p>
                        <div className="flex flex-wrap gap-3">
                            {cuisineOptions.map(option => (
                                <button
                                    key={option}
                                    onClick={() => toggleMultiSelect('cuisines', option)}
                                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${preferences.cuisines.includes(option)
                                        ? 'bg-[#3b5930] text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your vibe when going out?</h2>
                        <p className="text-gray-500 mb-6">Pick the atmospheres you enjoy the most.</p>
                        <div className="flex flex-wrap gap-3">
                            {vibeOptions.map(option => (
                                <button
                                    key={option}
                                    onClick={() => toggleMultiSelect('vibe', option)}
                                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${preferences.vibe.includes(option)
                                        ? 'bg-[#3b5930] text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your preferred budget?</h2>
                        <p className="text-gray-500 mb-6">Select your average spending per person.</p>
                        <div className="flex flex-col gap-3">
                            {budgetOptions.map(option => (
                                <button
                                    key={option}
                                    onClick={() => setSingleSelect('budget', option)}
                                    className={`px-5 py-4 rounded-xl text-left font-medium transition-all border-2 ${preferences.budget === option
                                        ? 'border-[#3b5930] bg-[#f0f4f0] text-[#3b5930]'
                                        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Who do you usually go out with?</h2>
                        <p className="text-gray-500 mb-6">This helps us find the right table sizes and atmospheres.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {groupOptions.map(option => (
                                <button
                                    key={option}
                                    onClick={() => setSingleSelect('group', option)}
                                    className={`px-5 py-4 rounded-xl text-center font-medium transition-all border-2 ${preferences.group === option
                                        ? 'border-[#3b5930] bg-[#f0f4f0] text-[#3b5930]'
                                        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">When do you usually go out?</h2>
                        <p className="text-gray-500 mb-6">Select your typical timings.</p>
                        <div className="flex flex-wrap gap-3">
                            {timeOptions.map(option => (
                                <button
                                    key={option}
                                    onClick={() => toggleMultiSelect('time', option)}
                                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${preferences.time.includes(option)
                                        ? 'bg-[#3b5930] text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 6:
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Anything you dislike or want to avoid?</h2>
                        <p className="text-gray-500 mb-6">Optional: Select or add things you'd rather not experience.</p>
                        <div className="flex flex-wrap gap-3 mb-6">
                            {dislikeOptions.map(option => (
                                <button
                                    key={option}
                                    onClick={() => toggleMultiSelect('dislikes', option)}
                                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${preferences.dislikes.includes(option)
                                        ? 'bg-red-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                            {preferences.dislikes.filter(d => !dislikeOptions.includes(d)).map(custom => (
                                <button
                                    key={custom}
                                    onClick={() => toggleMultiSelect('dislikes', custom)}
                                    className="px-4 py-2.5 rounded-full text-sm font-medium transition-all bg-red-600 text-white shadow-md flex items-center gap-2"
                                >
                                    {custom}
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={preferences.customDislike}
                                onChange={(e) => setPreferences(prev => ({ ...prev, customDislike: e.target.value }))}
                                onKeyDown={handleCustomDislikeKeyDown}
                                placeholder="Type your own and press Enter..."
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                            />
                            <button
                                onClick={addCustomDislike}
                                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header / Progress */}
            <div className="pt-8 px-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={handleBack}
                        className={`text-gray-400 hover:text-gray-900 transition-colors ${step === 1 ? 'invisible' : ''}`}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <span className="text-sm font-bold text-gray-400">
                        Step {step} of 6
                    </span>
                    <button
                        onClick={() => router.push('/')}
                        className="text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors"
                    >
                        Skip
                    </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div
                        className="bg-[#3b5930] h-full transition-all duration-300 ease-out"
                        style={{ width: `${(step / 6) * 100}%` }}
                    ></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-12 px-6 pb-24 max-w-2xl mx-auto min-h-[400px]">
                {renderStepContent()}
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={handleNext}
                        disabled={!isStepValid() || loading}
                        className="w-full bg-[#3b5930] hover:bg-[#2e4525] text-white py-4 rounded-2xl font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_16px_rgba(59,89,48,0.2)]"
                    >
                        {loading ? "Saving..." : step === 6 ? "Finish Setup" : "Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
}

