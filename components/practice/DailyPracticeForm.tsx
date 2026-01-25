'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { PracticeEntry, Streak, Belief } from '@/lib/practice/types';

interface DailyPracticeFormProps {
    practice: PracticeEntry | null;
    streak: Streak;
    lastVision: string | null;
    beliefs: Belief[];
    onSave: (data: Partial<PracticeEntry>) => Promise<void>;
    onComplete: (data: Partial<PracticeEntry> & { belief_id?: string }) => Promise<void>;
    isCompleted: boolean;
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
        </svg>
    );
}

export default function DailyPracticeForm({
    practice,
    streak,
    lastVision,
    beliefs,
    onSave,
    onComplete,
    isCompleted,
}: DailyPracticeFormProps) {
    const todayDate = useMemo(() => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }, []);
    // Initialize state with practice data
    const [beliefExamined, setBeliefExamined] = useState('');
    const [boldRisk, setBoldRisk] = useState('');
    const [blocker, setBlocker] = useState('');
    const [selectedBeliefId, setSelectedBeliefId] = useState<string | undefined>();

    // Initialize state once on mount/data load
    useEffect(() => {
        if (practice) {
            setBeliefExamined(practice.belief_examined || '');
            setBoldRisk(practice.bold_risk || '');
            setBlocker(practice.blocker || '');
            setSelectedBeliefId(practice.belief_id || undefined);
        }
    }, [practice]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [promptLoading, setPromptLoading] = useState<string | null>(null);

    const handleBlur = useCallback(async () => {
        await onSave({
            belief_examined: beliefExamined,
            bold_risk: boldRisk,
            blocker: blocker,
            belief_id: selectedBeliefId,
        });
    }, [beliefExamined, boldRisk, blocker, selectedBeliefId, onSave]);

    const handleComplete = useCallback(async () => {
        setIsSubmitting(true);
        try {
            await onComplete({
                belief_examined: beliefExamined,
                bold_risk: boldRisk,
                blocker: blocker,
                belief_id: selectedBeliefId,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [beliefExamined, boldRisk, blocker, selectedBeliefId, onComplete]);

    const getAIPrompt = useCallback(async (field: string, currentValue: string) => {
        setPromptLoading(field);
        try {
            const res = await fetch('/api/practice/ai/prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    field,
                    current_value: currentValue,
                    current_fields: {
                        belief_examined: beliefExamined,
                        bold_risk: boldRisk,
                        blocker: blocker,
                    },
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate prompt');
            }

            if (data.prompt) {
                alert(data.prompt);
            }
        } catch (err) {
            console.error('AI prompt error:', err);
            alert('Could not generate prompt. Please try again.');
        } finally {
            setPromptLoading(null);
        }
    }, [beliefExamined, boldRisk, blocker]);

    const isFormValid = beliefExamined.trim() && boldRisk.trim();

    return (
        <div>
            {isCompleted && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">✓ Completed today</span>
                </div>
            )}

            <div className="space-y-6">
                {/* What do I believe? (Beliefs Dropdown) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        What do I believe?
                    </label>
                    <select
                        value={selectedBeliefId || ''}
                        onChange={(e) => setSelectedBeliefId(e.target.value || undefined)}
                        onBlur={handleBlur}
                        disabled={isCompleted}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400 outline-none"
                    >
                        <option value="">—— Select a belief ——</option>
                        {beliefs.map(belief => (
                            <option key={belief.id} value={belief.id}>
                                {belief.belief}
                            </option>
                        ))}
                    </select>
                </div>


                {/* Bold Action */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Today&apos;s bold action
                        </label>
                        <button
                            onClick={() => getAIPrompt('bold_risk', boldRisk)}
                            disabled={promptLoading === 'bold_risk'}
                            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
                            title="Get AI prompt"
                        >
                            {promptLoading === 'bold_risk' ? (
                                <span className="text-xs">...</span>
                            ) : (
                                <SparklesIcon className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <input
                        type="text"
                        value={boldRisk}
                        onChange={(e) => setBoldRisk(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="One bold action to test your belief today..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400 outline-none"
                        disabled={isCompleted}
                    />
                </div>

                {/* What's the blocker? */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            What&apos;s the blocker?
                        </label>
                        <button
                            onClick={() => getAIPrompt('blocker', blocker)}
                            disabled={promptLoading === 'blocker'}
                            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
                            title="Get AI prompt"
                        >
                            {promptLoading === 'blocker' ? (
                                <span className="text-xs">...</span>
                            ) : (
                                <SparklesIcon className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <textarea
                        value={blocker}
                        onChange={(e) => setBlocker(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="What's blocking you from taking this action?"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400 resize-none outline-none"
                        rows={2}
                        disabled={isCompleted}
                    />
                </div>

                {/* Complete Button */}
                {!isCompleted && (
                    <button
                        onClick={handleComplete}
                        disabled={!isFormValid || isSubmitting}
                        className="w-full px-4 py-3 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        {isSubmitting ? 'Completing...' : 'Complete Practice'}
                    </button>
                )}
            </div>
        </div>
    );
}
