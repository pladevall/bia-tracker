'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePracticeData } from '@/lib/use-practice-data';
import ThemeToggle from '@/components/ThemeToggle';
import DailyPracticeForm from '@/components/practice/DailyPracticeForm';
import BetsTable from '@/components/practice/BetsTable';
import AICoachPanel from '@/components/practice/AICoachPanel';
import type { PracticeEntry, BeliefStatus, BoldTakeStatus } from '@/lib/practice/types';

export default function PracticePage() {
    const router = useRouter();
    const { data, isLoading, refresh } = usePracticeData();
    const [coachOpen, setCoachOpen] = useState(false);
    const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);

    // Desktop guard - redirect mobile users
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) return;

            if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                if (e.key === 'B' || e.key === 'b') {
                    e.preventDefault();
                    router.push('/');
                } else if (e.key === 'C' || e.key === 'c') {
                    e.preventDefault();
                    router.push('/calendar');
                }
            } else if (e.altKey && !e.metaKey && !e.ctrlKey) {
                if (e.code === 'Digit1') {
                    e.preventDefault();
                    router.push('/');
                } else if (e.code === 'Digit2') {
                    e.preventDefault();
                    router.push('/practice');
                } else if (e.code === 'Digit3') {
                    e.preventDefault();
                    router.push('/calendar');
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    const handleSavePractice = useCallback(async (practiceData: Partial<PracticeEntry>) => {
        try {
            await fetch('/api/practice/today', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(practiceData),
            });
        } catch (error) {
            console.error('Error saving practice:', error);
        }
    }, []);

    const handleCompletePractice = useCallback(async (practiceData: Partial<PracticeEntry>) => {
        try {
            const res = await fetch('/api/practice/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(practiceData),
            });
            if (res.ok) {
                refresh();
            }
        } catch (error) {
            console.error('Error completing practice:', error);
        }
    }, [refresh]);

    const handleUpdateGoalProgress = useCallback(async (id: string, value: number) => {
        try {
            await fetch(`/api/practice/goals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_value: value }),
            });
            refresh();
        } catch (error) {
            console.error('Error updating goal:', error);
        }
    }, [refresh]);

    if (isMobile) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Practice is optimized for desktop.
                    </p>
                    <Link
                        href="/"
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    >
                        Go to Baseline
                    </Link>
                </div>
            </div>
        );
    }

    if (isLoading && !data.todayPractice && data.boldTakes.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    const isCompleted = !!data.todayPractice?.completed_at;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
            <div className="max-w-[1600px] mx-auto px-8 py-8">
                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                Bets
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Strategic wagers & daily actions
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <span className="h-5 w-px bg-gray-200 dark:bg-gray-700/60" aria-hidden="true" />
                        <Link
                            href="/"
                            title="Baseline (Option+1)"
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </Link>
                        <Link
                            href="/practice"
                            title="Practice (Option+2)"
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                            </svg>
                        </Link>
                        <Link
                            href="/calendar"
                            title="Calendar (Option+3)"
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                <line x1="16" x2="16" y1="2" y2="6" />
                                <line x1="8" x2="8" y1="2" y2="6" />
                                <line x1="3" x2="21" y1="10" y2="10" />
                            </svg>
                        </Link>
                    </div>
                </header>

                {/* Full-width Bets Table */}
                <div className="w-full mb-8">
                    <BetsTable
                        bets={data.bets}
                        beliefs={data.beliefs}
                        boldTakes={data.boldTakes}
                        userSettings={data.userSettings}
                        onRefresh={refresh}
                        onOpenPracticeModal={() => setIsPracticeModalOpen(true)}
                        isCompleted={isCompleted}
                    />
                </div>
            </div>

            {/* Daily Practice Modal */}
            {isPracticeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
                        <div className="flex items-center justify-between p-4 sticky top-0 bg-white dark:bg-gray-900">
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">New Action</h3>
                            </div>
                            <button
                                onClick={() => setIsPracticeModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded p-1 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 border-t border-gray-100 dark:border-gray-800">
                            <DailyPracticeForm
                                practice={data.todayPractice}
                                streak={data.streak}
                                lastVision={data.lastVision}
                                beliefs={data.beliefs}
                                onSave={handleSavePractice}
                                onComplete={async (practiceData) => {
                                    await handleCompletePractice(practiceData);
                                    setIsPracticeModalOpen(false);
                                }}
                                isCompleted={isCompleted}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* AI Coach Panel */}
            <AICoachPanel
                isOpen={coachOpen}
                onToggle={() => setCoachOpen(!coachOpen)}
            />
        </div>
    );
}
