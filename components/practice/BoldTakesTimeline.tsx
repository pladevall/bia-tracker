'use client';

import { useState, useCallback } from 'react';
import type { BoldTake, BoldTakeStatus } from '@/lib/practice/types';

interface BoldTakesTimelineProps {
    boldTakes: BoldTake[];
    onUpdateBoldTake: (id: string, updates?: Partial<BoldTake>) => Promise<void>;
}

const STATUS_COLORS: Record<BoldTakeStatus, { bg: string; text: string }> = {
    committed: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    done: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    skipped: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BoldTakesTimeline({ boldTakes, onUpdateBoldTake }: BoldTakesTimelineProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [outcome, setOutcome] = useState('');
    const [learning, setLearning] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);

    const handleStatusChange = useCallback(async (id: string, newStatus: BoldTakeStatus) => {
        await onUpdateBoldTake(id, { status: newStatus });
    }, [onUpdateBoldTake]);

    const handleSaveOutcome = useCallback(async (id: string) => {
        const take = boldTakes.find(t => t.id === id);
        await onUpdateBoldTake(id, { status: take?.status, outcome, learning });
        setEditingId(null);
        setOutcome('');
        setLearning('');
    }, [boldTakes, outcome, learning, onUpdateBoldTake]);

    const handleSaveConfidence = useCallback(async (id: string, confidence: number) => {
        await onUpdateBoldTake(id, { confidence });
    }, [onUpdateBoldTake]);

    const visibleTakes = boldTakes.slice(0, visibleCount);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200/50 dark:border-gray-800/50 p-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bold Takes</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {boldTakes.filter(t => t.status === 'done').length}/{boldTakes.length} done
                </span>
            </div>

            {boldTakes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No bold takes yet. Complete a daily practice to add your first one.
                </p>
            ) : (
                <div className="space-y-3">
                    {visibleTakes.map((take) => {
                        const colors = STATUS_COLORS[take.status];
                        const isExpanded = expandedId === take.id;
                        const isEditing = editingId === take.id;

                        return (
                            <div
                                key={take.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {formatRelativeDate(take.date)}
                                            </span>
                                            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
                                                {take.status === 'committed' && '⏳ Committed'}
                                                {take.status === 'done' && '✓ Done'}
                                                {take.status === 'skipped' && 'Skipped'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                            {take.description}
                                        </p>
                                        {take.fear && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Fear: {take.fear}
                                            </p>
                                        )}
                                        {/* Confidence Slider */}
                                        <div className="mt-2">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={take.confidence ?? 50}
                                                onChange={(e) => handleSaveConfidence(take.id, parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                            />
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Confidence: {take.confidence ?? 50}%
                                            </p>
                                        </div>
                                        {take.status === 'committed' && (
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => handleStatusChange(take.id, 'done')}
                                                    className="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 border border-green-600/30 dark:border-green-400/30 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                                >
                                                    Done ✓
                                                </button>
                                                <button
                                                    onClick={() => handleStatusChange(take.id, 'skipped')}
                                                    className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                                                >
                                                    Skipped
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : take.id)}
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                                    >
                                        <svg
                                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">Outcome</label>
                                                    <textarea
                                                        value={outcome}
                                                        onChange={(e) => setOutcome(e.target.value)}
                                                        placeholder="What happened?"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                                                        rows={2}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 dark:text-gray-400">Learning</label>
                                                    <textarea
                                                        value={learning}
                                                        onChange={(e) => setLearning(e.target.value)}
                                                        placeholder="What did you learn?"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                                                        rows={2}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleSaveOutcome(take.id)}
                                                        className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-xs text-gray-500 hover:text-gray-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                {take.outcome && (
                                                    <div className="mb-2">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">Outcome: </span>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{take.outcome}</span>
                                                    </div>
                                                )}
                                                {take.learning && (
                                                    <div className="mb-2">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">Learning: </span>
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{take.learning}</span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingId(take.id);
                                                        setOutcome(take.outcome || '');
                                                        setLearning(take.learning || '');
                                                    }}
                                                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                                >
                                                    {take.outcome ? 'Edit outcome' : 'Add outcome'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {boldTakes.length > visibleCount && (
                        <button
                            onClick={() => setVisibleCount(prev => prev + 10)}
                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            Load more ({boldTakes.length - visibleCount} remaining)
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
