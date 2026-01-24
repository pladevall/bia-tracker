'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Bet, Belief, BoldTake, UserSettings } from '@/lib/practice/types';
import { UPSIDE_OPTIONS } from '@/lib/practice/types';
import { calculateBetScore, getScoreColor, getScoreLabel, parseTimelineYears } from '@/lib/practice/bet-scoring';
import { formatDownside, formatCurrency } from '@/lib/practice/formatting';
import { getEffectiveConfidence, isComputedConfidence, calculateExpectedValue, calculateBetTimeline, calculateAutoUpside } from '@/lib/practice/bet-calculations';
import BetForm from './BetForm';
import Tooltip from '@/components/Tooltip';

// Score guidance helper
function getScoreGuidance(score: number): {
    priority: string;
    timeAllocation: string;
    action: string;
    color: string;
} {
    if (score >= 5) {
        return {
            priority: 'Must Do - Top Priority',
            timeAllocation: '80-90% of your time',
            action: 'This is your highest leverage bet. Focus here first.',
            color: 'text-green-600 dark:text-green-400'
        };
    }
    if (score >= 3) {
        return {
            priority: 'Should Do - High Priority',
            timeAllocation: '60-80% of your time',
            action: 'Strong opportunity. Allocate significant effort here.',
            color: 'text-green-500'
        };
    }
    if (score >= 1) {
        return {
            priority: 'Could Do - Medium Priority',
            timeAllocation: '20-40% of your time',
            action: 'Moderate opportunity. Balance with higher-priority bets.',
            color: 'text-yellow-500'
        };
    }
    if (score >= 0.5) {
        return {
            priority: 'Consider Deferring - Low Priority',
            timeAllocation: '5-20% of your time',
            action: 'Weak opportunity. Only pursue if higher priorities are handled.',
            color: 'text-orange-500'
        };
    }
    return {
        priority: 'Defer or Drop - Very Low Priority',
        timeAllocation: 'Minimal to no time',
        action: 'Poor risk-adjusted return. Consider pivoting or dropping.',
        color: 'text-red-500'
    };
}

// Status guidance helpers
const BELIEF_STATUS_GUIDANCE = {
    untested: {
        label: 'Untested',
        description: 'Starting state - belief not yet validated with real actions',
        when: 'Use when: You\'ve identified a belief but haven\'t taken action yet',
        next: 'Move to "Testing" when you start executing actions to validate it'
    },
    testing: {
        label: 'Testing',
        description: 'Active validation - gathering evidence through actions',
        when: 'Use when: You\'re actively running experiments/actions to test this belief',
        next: 'Move to "Proven" if evidence supports it, "Disproven" if evidence contradicts it'
    },
    proven: {
        label: 'Proven',
        description: 'Validated - evidence confirms this belief is true',
        when: 'Use when: Multiple data points/outcomes confirm this belief holds',
        next: 'Keep monitoring - beliefs can become disproven as conditions change'
    },
    disproven: {
        label: 'Disproven',
        description: 'Invalidated - evidence shows this belief is false',
        when: 'Use when: Evidence clearly contradicts the belief',
        next: 'Revisit the belief or pivot to a new one'
    }
};

const ACTION_STATUS_GUIDANCE = {
    committed: {
        label: 'Committed',
        description: 'Planned action - intention set but not yet executed',
        when: 'Use when: You\'ve committed to taking this action',
        next: 'Move to "Done" after completing, or "Skipped" if you decide not to do it'
    },
    done: {
        label: 'Done',
        description: 'Completed - action has been executed',
        when: 'Use when: You\'ve finished the action and can record outcomes/learnings',
        next: 'Record outcome and learning from the action'
    },
    skipped: {
        label: 'Skipped',
        description: 'Deliberately not pursued',
        when: 'Use when: You decided not to pursue this action (deprioritized, irrelevant, etc.)',
        next: 'Document why it was skipped for future reference'
    }
};

interface BetsTableProps {
    bets: Bet[];
    beliefs: Belief[];
    boldTakes: BoldTake[];
    userSettings?: UserSettings | null;
    onRefresh?: () => void;
    onOpenPracticeModal?: () => void;
    isCompleted?: boolean;
}

export default function BetsTable({ bets, beliefs, boldTakes, userSettings, onRefresh, onOpenPracticeModal, isCompleted }: BetsTableProps) {
    const [expandedBets, setExpandedBets] = useState<Set<string>>(() =>
        new Set(bets.map(b => b.id))
    );
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editingBet, setEditingBet] = useState<Bet | null>(null);
    const [editingField, setEditingField] = useState<{ betId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [salaryInput, setSalaryInput] = useState(String(userSettings?.annual_salary ?? 150000));
    const [isSaving, setIsSaving] = useState(false);

    // Sync salary input when userSettings changes
    React.useEffect(() => {
        setSalaryInput(String(userSettings?.annual_salary ?? 150000));
    }, [userSettings?.annual_salary]);

    // Compute scores and sort
    const sortedBets = useMemo(() => {
        return [...bets]
            .map(bet => ({ ...bet, bet_score: bet.bet_score ?? calculateBetScore(bet) }))
            .sort((a, b) => (b.bet_score ?? 0) - (a.bet_score ?? 0));
    }, [bets]);

    const toggleBet = (betId: string) => {
        const newExpanded = new Set(expandedBets);
        if (newExpanded.has(betId)) {
            newExpanded.delete(betId);
        } else {
            newExpanded.add(betId);
        }
        setExpandedBets(newExpanded);
    };

    const handleStartEdit = (betId: string, field: string, value: string) => {
        setEditingField({ betId, field });
        setEditValue(value);
    };

    const handleSaveInlineEdit = useCallback(async (betId: string, field: string, clearValue: boolean = false) => {
        const trimmedValue = editValue.trim();
        if (!trimmedValue && field === 'downside_override') {
            // Allow empty downside_override (undefined)
        } else if (!trimmedValue && !clearValue) {
            setEditingField(null);
            return;
        }

        const updates: Partial<Bet> = {};
        if (field === 'upside_multiplier') {
            if (clearValue) {
                // Clear to use auto-calculation
                updates.upside_multiplier = null;
            } else {
                updates.upside_multiplier = parseFloat(trimmedValue);
            }
        } else if (field === 'downside_override') {
            // Convert to number, handling various input formats
            if (!trimmedValue) {
                updates.downside_override = null;
            } else {
                const numValue = parseFloat(trimmedValue.replace(/[^0-9.-]/g, ''));
                updates.downside_override = isNaN(numValue) ? null : numValue;
            }
        }

        try {
            const res = await fetch(`/api/practice/bets/${betId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                setEditingField(null);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating field:', error);
        }
    }, [editValue, onRefresh]);

    const handleUpdateBeliefStatus = useCallback(async (beliefId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/practice/beliefs/${beliefId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating belief status:', error);
        }
    }, [onRefresh]);

    const handleUpdateActionStatus = useCallback(async (actionId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/practice/bold-takes/${actionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating action status:', error);
        }
    }, [onRefresh]);

    const handleUpdateBeliefConfidence = useCallback(async (beliefId: string, confidence: number) => {
        try {
            const res = await fetch(`/api/practice/beliefs/${beliefId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confidence }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating belief confidence:', error);
        }
    }, [onRefresh]);

    const handleUpdateActionConfidence = useCallback(async (actionId: string, confidence: number) => {
        try {
            const res = await fetch(`/api/practice/bold-takes/${actionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confidence }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating action confidence:', error);
        }
    }, [onRefresh]);

    const handleUpdateActionDuration = useCallback(async (actionId: string, duration_days: number) => {
        try {
            const res = await fetch(`/api/practice/bold-takes/${actionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duration_days }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating action duration:', error);
        }
    }, [onRefresh]);

    const handleCreateBet = useCallback(async (betData: Partial<Bet>) => {
        try {
            const res = await fetch('/api/practice/bets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(betData),
            });
            if (res.ok) {
                setIsFormOpen(false);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error creating bet:', error);
        }
    }, [onRefresh]);

    const handleUpdateBet = useCallback(async (betData: Partial<Bet>) => {
        if (!editingBet) return;
        try {
            const res = await fetch(`/api/practice/bets/${editingBet.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(betData),
            });
            if (res.ok) {
                setEditingBet(null);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating bet:', error);
        }
    }, [editingBet, onRefresh]);

    const handleDeleteBet = useCallback(async (betId: string) => {
        if (!confirm('Delete this bet? Linked beliefs and actions will be unlinked.')) return;
        try {
            const res = await fetch(`/api/practice/bets/${betId}`, { method: 'DELETE' });
            if (res.ok) onRefresh?.();
        } catch (error) {
            console.error('Error deleting bet:', error);
        }
    }, [onRefresh]);

    // Status styles
    const statusStyles: Record<string, string> = {
        active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };

    // Confidence color (0-100 scale)
    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return 'text-green-500';
        if (confidence >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };

    // Status badge class helper
    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'proven':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
            case 'testing':
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
            case 'disproven':
                return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
            case 'active':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
            case 'done':
                return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
            case 'paused':
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
            case 'committed':
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
            case 'skipped':
                return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
            case 'closed':
                return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
            default:
                return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Bets</h2>
                <div className="flex items-center gap-3 relative">
                    {/* Annual Salary Badge with Popover */}
                    <div className="relative">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Click to edit opportunity cost"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatCurrency(userSettings?.annual_salary ?? 150000)}
                        </button>

                        {/* Settings Popover */}
                        {isSettingsOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-40">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            Annual Salary (Opportunity Cost)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={salaryInput}
                                                onChange={(e) => setSalaryInput(e.target.value)}
                                                placeholder="e.g., 150000"
                                                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                                            />
                                            <div className="flex items-center px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded text-green-700 dark:text-green-300 text-xs font-medium whitespace-nowrap">
                                                {salaryInput ? formatCurrency(parseInt(salaryInput.replace(/[^0-9]/g, '')) || undefined) : '-'}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                                            Used to calculate downside: timeline × salary
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSalaryInput(String(userSettings?.annual_salary ?? 150000));
                                                setIsSettingsOpen(false);
                                            }}
                                            className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSaving || !salaryInput}
                                            onClick={async () => {
                                                const parsed = parseInt(salaryInput.replace(/[^0-9]/g, ''));
                                                if (isNaN(parsed) || parsed <= 0) return;

                                                setIsSaving(true);
                                                try {
                                                    const res = await fetch('/api/practice/user-settings', {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ annual_salary: parsed }),
                                                    });
                                                    if (res.ok) {
                                                        onRefresh?.();
                                                        setIsSettingsOpen(false);
                                                    }
                                                } catch (error) {
                                                    console.error('Error updating user settings:', error);
                                                } finally {
                                                    setIsSaving(false);
                                                }
                                            }}
                                            className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
                                        >
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                        >
                            + New Bet
                        </button>
                        {!isCompleted && (
                            <button
                                onClick={onOpenPracticeModal}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                            >
                                + New Action
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {sortedBets.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No bets yet. Create your first bet.</p>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                        Create Bet
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-800">
                                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[200px]">
                                    Name
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Timeline
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                                    Upside
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                                    Expected Value
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Downside
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Confidence
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                                    Score
                                </th>
                                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[70px]">
                                    Status
                                </th>
                                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px]">
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBets.map((bet) => {
                                const isExpanded = expandedBets.has(bet.id);
                                const linkedBeliefs = beliefs.filter(b => b.bet_id === bet.id);
                                const linkedTakes = boldTakes.filter(t => t.bet_id === bet.id);
                                const score = bet.bet_score ?? calculateBetScore(bet);
                                const scoreColor = getScoreColor(score);
                                const isEditing = editingField?.betId === bet.id;
                                const timelineYears = calculateBetTimeline(linkedTakes);
                                const effectiveConfidence = getEffectiveConfidence(bet);

                                // Calculate downside (opportunity cost)
                                const calculatedDownside = timelineYears * (userSettings?.annual_salary ?? 150000);
                                const effectiveDownside = bet.downside_override ?? calculatedDownside;

                                // Calculate upside multiplier (auto or manual)
                                const autoUpside = calculateAutoUpside(timelineYears, effectiveConfidence);
                                const displayUpside = bet.upside_multiplier || autoUpside;

                                // Calculate expected value: downside × upside_multiplier
                                const expectedValue = calculateExpectedValue(displayUpside, effectiveDownside);

                                return (
                                    <>
                                        {/* Main Bet Row */}
                                        <tr
                                            key={bet.id}
                                            className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                                            onClick={() => toggleBet(bet.id)}
                                        >
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <svg
                                                        className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                    <div>
                                                        <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                                            {bet.name}
                                                        </div>
                                                        {bet.description && (
                                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[250px]">
                                                                {bet.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Timeline with Rich Tooltip */}
                                            <td className="px-3 py-2 text-center text-xs text-gray-700 dark:text-gray-300">
                                                {(() => {
                                                    const actionDurations = linkedTakes.map(t => t.duration_days ?? 30);
                                                    const beliefDurations = linkedBeliefs.map(b => b.duration_days ?? 0);
                                                    const allDurations = [...actionDurations, ...beliefDurations];
                                                    const totalDays = allDurations.reduce((sum, d) => sum + d, 0);

                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-1">
                                                                <div className="font-semibold text-white">Timeline Calculation:</div>
                                                                <div className="text-xs font-mono space-y-0.5">
                                                                    {allDurations.length > 0 ? (
                                                                        <>
                                                                            <div>{allDurations.join('d + ')}d = {totalDays} days</div>
                                                                            <div className="border-t border-gray-600 pt-0.5 mt-0.5">≈ {timelineYears.toFixed(2)} years</div>
                                                                        </>
                                                                    ) : (
                                                                        <div>No actions defined yet</div>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-300 mt-1">Estimated time to realize bet outcome</div>
                                                            </div>
                                                        }>
                                                            <span className="cursor-help">
                                                                {timelineYears > 0
                                                                    ? `${timelineYears.toFixed(1)} yrs`
                                                                    : bet.timeline || '-'
                                                                }
                                                            </span>
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </td>
                                            {/* Upside - Inline Editable with Rich Tooltip */}
                                            <td
                                                className="px-3 py-2 text-center text-xs text-gray-700 dark:text-gray-300"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {(() => {
                                                    const autoUpside = calculateAutoUpside(timelineYears, effectiveConfidence);
                                                    const displayUpside = bet.upside_multiplier || autoUpside;
                                                    const isAutoCalculated = !bet.upside_multiplier;
                                                    const showDifference = bet.upside_multiplier && Math.abs(bet.upside_multiplier - autoUpside) > 0.1;

                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-2">
                                                                <div className="font-semibold text-white">Upside Multiple:</div>

                                                                {/* Current/Display Value */}
                                                                <div className="text-xs space-y-0.5">
                                                                    <div className="font-mono">{displayUpside}x return if successful</div>
                                                                    <div className="text-gray-300 mt-1">For every $1 invested, expect ${displayUpside} back if bet succeeds</div>
                                                                </div>

                                                                {/* Auto-calculated value comparison */}
                                                                <div className="border-t border-gray-600 pt-2 mt-2">
                                                                    <div className="font-semibold text-white text-xs mb-1">Auto-Calculated Value:</div>
                                                                    <div className="text-xs space-y-1">
                                                                        <div className="text-blue-400 font-mono">{autoUpside}x</div>
                                                                        <div className="text-[10px] text-gray-400">
                                                                            Formula: 5 × ({100}/{effectiveConfidence})^0.5 × {timelineYears.toFixed(2)}^0.3
                                                                        </div>
                                                                        {showDifference && bet.upside_multiplier && (
                                                                            <div className="text-[10px] text-amber-300 mt-1">
                                                                                {bet.upside_multiplier > autoUpside ? '↑' : '↓'} {Math.abs((bet.upside_multiplier - autoUpside) / autoUpside * 100).toFixed(0)}% different from auto
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Status */}
                                                                <div className="border-t border-gray-600 pt-2">
                                                                    {isAutoCalculated ? (
                                                                        <div className="text-[10px] text-blue-400">
                                                                            💙 Using auto-calculated value
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[10px] text-indigo-400">
                                                                            ✎ Manually set - click to use auto-upside
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        }>
                                                            {isEditing && editingField.field === 'upside_multiplier' ? (
                                                                <input
                                                                    autoFocus
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onBlur={() => handleSaveInlineEdit(bet.id, 'upside_multiplier')}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveInlineEdit(bet.id, 'upside_multiplier');
                                                                        if (e.key === 'Escape') setEditingField(null);
                                                                    }}
                                                                    className="w-full px-2 py-1 text-xs border border-indigo-500 rounded bg-indigo-50 dark:bg-indigo-900/20"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        onClick={() => handleStartEdit(bet.id, 'upside_multiplier', String(displayUpside))}
                                                                        className={`hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded text-xs font-mono cursor-help ${
                                                                            isAutoCalculated
                                                                                ? 'text-blue-600 dark:text-blue-400'
                                                                                : 'text-indigo-600 dark:text-indigo-400'
                                                                        }`}
                                                                        title={isAutoCalculated ? 'Click to manually set upside' : 'Click to edit'}
                                                                    >
                                                                        {displayUpside}x {isAutoCalculated && <span className="text-[8px]">◆</span>}
                                                                    </button>
                                                                    {!isAutoCalculated && (
                                                                        <button
                                                                            onClick={() => handleSaveInlineEdit(bet.id, 'upside_multiplier', true)}
                                                                            className="text-[10px] px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                                                            title="Apply auto-calculated value"
                                                                        >
                                                                            🔄
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </td>
                                            {/* Expected Value Column (NEW) */}
                                            <td className="px-3 py-2 text-center text-xs text-green-600 dark:text-green-400 font-medium">
                                                <Tooltip content={
                                                    <div className="space-y-1">
                                                        <div className="font-semibold text-white">Expected Value:</div>
                                                        <div className="text-xs font-mono space-y-0.5">
                                                            <div>{formatCurrency(effectiveDownside)} × {displayUpside}x</div>
                                                            <div className="border-t border-gray-600 pt-0.5 mt-0.5">= {formatCurrency(expectedValue || 0)}</div>
                                                        </div>
                                                        {timelineYears > 0 && (
                                                            <div className="text-xs text-gray-300 mt-1">
                                                                Downside: {timelineYears.toFixed(2)} yrs × ${userSettings?.annual_salary.toLocaleString() ?? '150,000'}{bet.downside_override && ' (overridden)'}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-300 mt-1">Potential monetary outcome if bet succeeds</div>
                                                    </div>
                                                }>
                                                    <span className="cursor-help">{formatCurrency(expectedValue || 0)}</span>
                                                </Tooltip>
                                            </td>
                                            {/* Downside - Inline Editable with Rich Tooltip (UPDATED) */}
                                            <td
                                                className="px-3 py-2 text-center text-xs text-red-600 dark:text-red-400 font-medium"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {(() => {
                                                    const calculatedDownside = timelineYears * (userSettings?.annual_salary ?? 150000);
                                                    const effectiveDownside = bet.downside_override ?? calculatedDownside;

                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-1">
                                                                <div className="font-semibold text-white">Downside (Opportunity Cost):</div>
                                                                <div className="text-xs space-y-0.5 font-mono">
                                                                    {timelineYears > 0 && (
                                                                        <>
                                                                            <div>{timelineYears.toFixed(2)} yrs × ${userSettings?.annual_salary.toLocaleString() ?? '150,000'}</div>
                                                                            <div className="border-t border-gray-600 pt-0.5 mt-0.5">= {formatCurrency(calculatedDownside)}</div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {bet.downside_override && (
                                                                    <div className="text-xs text-amber-300 mt-1">
                                                                        ✎ Manually overridden
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-gray-300 mt-1">Time cost of pursuing this bet</div>
                                                            </div>
                                                        }>
                                                            {isEditing && editingField.field === 'downside_override' ? (
                                                                <input
                                                                    autoFocus
                                                                    type="text"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onBlur={() => handleSaveInlineEdit(bet.id, 'downside_override')}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveInlineEdit(bet.id, 'downside_override');
                                                                        if (e.key === 'Escape') setEditingField(null);
                                                                    }}
                                                                    placeholder="Leave blank for auto-calc"
                                                                    className="w-full px-2 py-1 text-xs border border-red-500 rounded bg-red-50 dark:bg-red-900/20"
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleStartEdit(bet.id, 'downside_override', String(effectiveDownside ?? ''))}
                                                                    className="hover:bg-red-100 dark:hover:bg-red-900/20 px-2 py-1 rounded text-xs cursor-help"
                                                                >
                                                                    {formatDownside(effectiveDownside, true)}
                                                                    {bet.downside_override && <span className="text-[8px] ml-0.5">✎</span>}
                                                                </button>
                                                            )}
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </td>
                                            {/* Confidence with Rich Tooltip (UPDATED) */}
                                            <td className={`px-3 py-2 text-center text-xs font-medium tabular-nums ${getConfidenceColor(effectiveConfidence)}`}>
                                                <Tooltip content={
                                                    <div className="space-y-1">
                                                        <div className="font-semibold text-white">Confidence Assessment:</div>
                                                        {isComputedConfidence(bet) ? (
                                                            <>
                                                                <div className="text-xs font-mono">{effectiveConfidence}% (auto-calculated)</div>
                                                                <div className="text-xs text-gray-300">Weighted average from {linkedBeliefs.length + linkedTakes.length} beliefs/actions</div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-xs font-mono">{effectiveConfidence}% (manual)</div>
                                                                <div className="text-xs text-gray-300">Set manually, no beliefs/actions yet</div>
                                                            </>
                                                        )}
                                                        <div className="border-t border-gray-600 pt-1 mt-1">
                                                            <div className="text-xs text-gray-300">Based on available evidence and conviction</div>
                                                        </div>
                                                    </div>
                                                }>
                                                    <span className="cursor-help">
                                                        {effectiveConfidence}%
                                                        {isComputedConfidence(bet) && <span className="text-[8px] ml-0.5">◆</span>}
                                                    </span>
                                                </Tooltip>
                                            </td>
                                            {/* Score with Rich Tooltip */}
                                            <td className={`px-3 py-2 text-center text-xs font-bold tabular-nums ${scoreColor}`}>
                                                {(() => {
                                                    const guidance = getScoreGuidance(score);
                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-2">
                                                                {/* Formula Breakdown */}
                                                                <div>
                                                                    <div className="font-semibold text-white">Kelly Score Formula:</div>
                                                                    <div className="text-xs space-y-0.5 font-mono">
                                                                        <div>({displayUpside}x × {effectiveConfidence}%) / {timelineYears.toFixed(2)} yrs</div>
                                                                        <div className="border-t border-gray-600 pt-0.5 mt-0.5">= {score.toFixed(2)}</div>
                                                                    </div>
                                                                    {!bet.upside_multiplier && (
                                                                        <div className="text-[10px] text-blue-400 mt-1">
                                                                            (Upside auto-calculated: 5 × ({100}/{effectiveConfidence})^0.5 × {timelineYears.toFixed(2)}^0.3)
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Actionable Guidance */}
                                                                <div className="border-t border-gray-600 pt-2">
                                                                    <div className={`font-semibold ${guidance.color}`}>
                                                                        {guidance.priority}
                                                                    </div>
                                                                    <div className="text-xs text-gray-200 mt-1">
                                                                        <div className="font-medium">Time Allocation:</div>
                                                                        <div>{guidance.timeAllocation}</div>
                                                                    </div>
                                                                    <div className="text-xs text-gray-300 mt-2 italic">
                                                                        {guidance.action}
                                                                    </div>
                                                                </div>

                                                                {/* Score Hierarchy Reference */}
                                                                <div className="border-t border-gray-600 pt-2">
                                                                    <div className="text-[10px] text-gray-400">
                                                                        Score ranges: &gt;5 Excellent | 3-5 Strong | 1-3 Moderate | 0.5-1 Weak | &lt;0.5 Poor
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        }>
                                                            <span className="cursor-help">{score.toFixed(2)}</span>
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${statusStyles[bet.status]}`}>
                                                    {bet.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setEditingBet(bet)}
                                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                                                    title="Edit bet"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Expanded Details - Column-Aligned Nested Rows */}
                                        {isExpanded && (
                                            <>
                                                {linkedBeliefs.map((belief) => {
                                                    const beliefActions = linkedTakes.filter(t => t.belief_id === belief.id);
                                                    return (
                                                        <React.Fragment key={`belief-${belief.id}`}>
                                                            {/* Belief Row */}
                                                            <tr className="border-b border-gray-100 dark:border-gray-800/50 bg-indigo-50/30 dark:bg-indigo-900/10">
                                                                <td className="px-4 py-1">
                                                                    <div className="flex items-center gap-2 pl-5">
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-200 dark:bg-indigo-700 rounded font-medium">B</span>
                                                                        <span className="text-xs text-gray-900 dark:text-gray-100">{belief.belief}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-1 text-center">
                                                                    <Tooltip content="Auto-calculated from sum of linked actions">
                                                                        <span className="text-xs text-gray-500 dark:text-gray-400 cursor-help">
                                                                            {belief.duration_days ?? 0}d
                                                                        </span>
                                                                    </Tooltip>
                                                                </td>
                                                                <td className="px-3 py-1"></td>
                                                                <td className="px-3 py-1"></td>
                                                                <td className="px-3 py-1"></td>
                                                                <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                                    {editingField?.betId === belief.id && editingField?.field === `belief-confidence-${belief.id}` ? (
                                                                        <input
                                                                            autoFocus
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            value={editValue}
                                                                            onChange={(e) => setEditValue(e.target.value)}
                                                                            onBlur={() => {
                                                                                const val = parseInt(editValue);
                                                                                if (!isNaN(val) && val >= 0 && val <= 100) {
                                                                                    handleUpdateBeliefConfidence(belief.id, val);
                                                                                }
                                                                                setEditingField(null);
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    const val = parseInt(editValue);
                                                                                    if (!isNaN(val) && val >= 0 && val <= 100) {
                                                                                        handleUpdateBeliefConfidence(belief.id, val);
                                                                                    }
                                                                                    setEditingField(null);
                                                                                }
                                                                                if (e.key === 'Escape') setEditingField(null);
                                                                            }}
                                                                            className="w-16 px-2 py-0.5 text-xs text-center border border-indigo-500 rounded bg-indigo-50 dark:bg-indigo-900/20"
                                                                        />
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingField({ betId: belief.id, field: `belief-confidence-${belief.id}` });
                                                                                setEditValue(String(belief.confidence ?? 50));
                                                                            }}
                                                                            className="text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                                                        >
                                                                            {belief.confidence ?? 50}%
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-1"></td>
                                                                <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                                    <Tooltip content={
                                                                        <div className="space-y-2 max-w-xs">
                                                                            <div className="font-semibold text-white">Belief Status: {belief.status}</div>
                                                                            <div className="text-xs text-gray-200">
                                                                                {BELIEF_STATUS_GUIDANCE[belief.status as keyof typeof BELIEF_STATUS_GUIDANCE]?.description || 'Unknown status'}
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-300 border-t border-gray-600 pt-1 mt-1">
                                                                                <div className="font-medium">When to use:</div>
                                                                                <div>{BELIEF_STATUS_GUIDANCE[belief.status as keyof typeof BELIEF_STATUS_GUIDANCE]?.when || ''}</div>
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-300">
                                                                                <div className="font-medium">Next step:</div>
                                                                                <div>{BELIEF_STATUS_GUIDANCE[belief.status as keyof typeof BELIEF_STATUS_GUIDANCE]?.next || ''}</div>
                                                                            </div>
                                                                        </div>
                                                                    }>
                                                                        <select
                                                                            value={belief.status}
                                                                            onChange={(e) => handleUpdateBeliefStatus(belief.id, e.target.value)}
                                                                            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-help"
                                                                        >
                                                                            <option value="untested">Untested</option>
                                                                            <option value="testing">Testing</option>
                                                                            <option value="proven">Proven</option>
                                                                            <option value="disproven">Disproven</option>
                                                                        </select>
                                                                    </Tooltip>
                                                                </td>
                                                                <td className="px-3 py-1"></td>
                                                            </tr>

                                                            {/* Action Rows (nested under belief) */}
                                                            {beliefActions.map(take => (
                                                                <tr key={`action-${take.id}`} className="border-b border-gray-100 dark:border-gray-800/50 bg-green-50/20 dark:bg-green-900/5">
                                                                    <td className="px-4 py-1">
                                                                        <div className="flex items-center gap-2 pl-10">
                                                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-200 dark:bg-green-700 rounded font-medium">A</span>
                                                                            <span className="text-xs text-gray-900 dark:text-gray-100">{take.description}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                                        {editingField?.betId === take.id && editingField?.field === `action-duration-${take.id}` ? (
                                                                            <input
                                                                                autoFocus
                                                                                type="number"
                                                                                min="0"
                                                                                value={editValue}
                                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                                onBlur={() => {
                                                                                    const val = parseInt(editValue);
                                                                                    if (!isNaN(val) && val >= 0) {
                                                                                        handleUpdateActionDuration(take.id, val);
                                                                                    }
                                                                                    setEditingField(null);
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        const val = parseInt(editValue);
                                                                                        if (!isNaN(val) && val >= 0) {
                                                                                            handleUpdateActionDuration(take.id, val);
                                                                                        }
                                                                                        setEditingField(null);
                                                                                    }
                                                                                    if (e.key === 'Escape') setEditingField(null);
                                                                                }}
                                                                                className="w-16 px-2 py-0.5 text-xs text-center border border-blue-500 rounded bg-blue-50 dark:bg-blue-900/20"
                                                                            />
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingField({ betId: take.id, field: `action-duration-${take.id}` });
                                                                                    setEditValue(String(take.duration_days ?? 30));
                                                                                }}
                                                                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                                                            >
                                                                                {take.duration_days ?? 30}d
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-1"></td>
                                                                    <td className="px-3 py-1"></td>
                                                                    <td className="px-3 py-1"></td>
                                                                    <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                                        {editingField?.betId === take.id && editingField?.field === `action-confidence-${take.id}` ? (
                                                                            <input
                                                                                autoFocus
                                                                                type="number"
                                                                                min="0"
                                                                                max="100"
                                                                                value={editValue}
                                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                                onBlur={() => {
                                                                                    const val = parseInt(editValue);
                                                                                    if (!isNaN(val) && val >= 0 && val <= 100) {
                                                                                        handleUpdateActionConfidence(take.id, val);
                                                                                    }
                                                                                    setEditingField(null);
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        const val = parseInt(editValue);
                                                                                        if (!isNaN(val) && val >= 0 && val <= 100) {
                                                                                            handleUpdateActionConfidence(take.id, val);
                                                                                        }
                                                                                        setEditingField(null);
                                                                                    }
                                                                                    if (e.key === 'Escape') setEditingField(null);
                                                                                }}
                                                                                className="w-16 px-2 py-0.5 text-xs text-center border border-indigo-500 rounded bg-indigo-50 dark:bg-indigo-900/20"
                                                                            />
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingField({ betId: take.id, field: `action-confidence-${take.id}` });
                                                                                    setEditValue(String(take.confidence ?? 50));
                                                                                }}
                                                                                className="text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                                                            >
                                                                                {take.confidence ?? 50}%
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-1"></td>
                                                                    <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                                        <Tooltip content={
                                                                            <div className="space-y-2 max-w-xs">
                                                                                <div className="font-semibold text-white">Action Status: {take.status}</div>
                                                                                <div className="text-xs text-gray-200">
                                                                                    {ACTION_STATUS_GUIDANCE[take.status as keyof typeof ACTION_STATUS_GUIDANCE]?.description || 'Unknown status'}
                                                                                </div>
                                                                                <div className="text-[10px] text-gray-300 border-t border-gray-600 pt-1 mt-1">
                                                                                    <div className="font-medium">When to use:</div>
                                                                                    <div>{ACTION_STATUS_GUIDANCE[take.status as keyof typeof ACTION_STATUS_GUIDANCE]?.when || ''}</div>
                                                                                </div>
                                                                                <div className="text-[10px] text-gray-300">
                                                                                    <div className="font-medium">Next step:</div>
                                                                                    <div>{ACTION_STATUS_GUIDANCE[take.status as keyof typeof ACTION_STATUS_GUIDANCE]?.next || ''}</div>
                                                                                </div>
                                                                            </div>
                                                                        }>
                                                                            <select
                                                                                value={take.status}
                                                                                onChange={(e) => handleUpdateActionStatus(take.id, e.target.value)}
                                                                                className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-help"
                                                                            >
                                                                                <option value="committed">Committed</option>
                                                                                <option value="done">Done</option>
                                                                                <option value="skipped">Skipped</option>
                                                                            </select>
                                                                        </Tooltip>
                                                                    </td>
                                                                    <td className="px-3 py-1"></td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Actions without linked beliefs */}
                                                {boldTakes.filter(t => t.bet_id === bet.id && !t.belief_id).map(take => (
                                                    <tr key={`unlinked-action-${take.id}`} className="border-b border-gray-100 dark:border-gray-800/50 bg-green-50/20 dark:bg-green-900/5">
                                                        <td className="px-4 py-1">
                                                            <div className="flex items-center gap-2 pl-5">
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-green-200 dark:bg-green-700 rounded font-medium">A</span>
                                                                <span className="text-xs text-gray-900 dark:text-gray-100">{take.description}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                            {editingField?.betId === take.id && editingField?.field === `action-duration-${take.id}` ? (
                                                                <input
                                                                    autoFocus
                                                                    type="number"
                                                                    min="0"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onBlur={() => {
                                                                        const val = parseInt(editValue);
                                                                        if (!isNaN(val) && val >= 0) {
                                                                            handleUpdateActionDuration(take.id, val);
                                                                        }
                                                                        setEditingField(null);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const val = parseInt(editValue);
                                                                            if (!isNaN(val) && val >= 0) {
                                                                                handleUpdateActionDuration(take.id, val);
                                                                            }
                                                                            setEditingField(null);
                                                                        }
                                                                        if (e.key === 'Escape') setEditingField(null);
                                                                    }}
                                                                    className="w-16 px-2 py-0.5 text-xs text-center border border-blue-500 rounded bg-blue-50 dark:bg-blue-900/20"
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingField({ betId: take.id, field: `action-duration-${take.id}` });
                                                                        setEditValue(String(take.duration_days ?? 30));
                                                                    }}
                                                                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                                                >
                                                                    {take.duration_days ?? 30}d
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-1"></td>
                                                        <td className="px-3 py-1"></td>
                                                        <td className="px-3 py-1"></td>
                                                        <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                            {editingField?.betId === take.id && editingField?.field === `action-confidence-${take.id}` ? (
                                                                <input
                                                                    autoFocus
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onBlur={() => {
                                                                        const val = parseInt(editValue);
                                                                        if (!isNaN(val) && val >= 0 && val <= 100) {
                                                                            handleUpdateActionConfidence(take.id, val);
                                                                        }
                                                                        setEditingField(null);
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const val = parseInt(editValue);
                                                                            if (!isNaN(val) && val >= 0 && val <= 100) {
                                                                                handleUpdateActionConfidence(take.id, val);
                                                                            }
                                                                            setEditingField(null);
                                                                        }
                                                                        if (e.key === 'Escape') setEditingField(null);
                                                                    }}
                                                                    className="w-16 px-2 py-0.5 text-xs text-center border border-indigo-500 rounded bg-indigo-50 dark:bg-indigo-900/20"
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingField({ betId: take.id, field: `action-confidence-${take.id}` });
                                                                        setEditValue(String(take.confidence ?? 50));
                                                                    }}
                                                                    className="text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                                                >
                                                                    {take.confidence ?? 50}%
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-1"></td>
                                                        <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <Tooltip content={
                                                                <div className="space-y-2 max-w-xs">
                                                                    <div className="font-semibold text-white">Action Status: {take.status}</div>
                                                                    <div className="text-xs text-gray-200">
                                                                        {ACTION_STATUS_GUIDANCE[take.status as keyof typeof ACTION_STATUS_GUIDANCE]?.description || 'Unknown status'}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-300 border-t border-gray-600 pt-1 mt-1">
                                                                        <div className="font-medium">When to use:</div>
                                                                        <div>{ACTION_STATUS_GUIDANCE[take.status as keyof typeof ACTION_STATUS_GUIDANCE]?.when || ''}</div>
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-300">
                                                                        <div className="font-medium">Next step:</div>
                                                                        <div>{ACTION_STATUS_GUIDANCE[take.status as keyof typeof ACTION_STATUS_GUIDANCE]?.next || ''}</div>
                                                                    </div>
                                                                </div>
                                                            }>
                                                                <select
                                                                    value={take.status}
                                                                    onChange={(e) => handleUpdateActionStatus(take.id, e.target.value)}
                                                                    className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-help"
                                                                >
                                                                    <option value="committed">Committed</option>
                                                                    <option value="done">Done</option>
                                                                    <option value="skipped">Skipped</option>
                                                                </select>
                                                            </Tooltip>
                                                        </td>
                                                        <td className="px-3 py-1"></td>
                                                    </tr>
                                                ))}

                                                {/* Empty State */}
                                                {linkedBeliefs.length === 0 && linkedTakes.length === 0 && (
                                                    <tr className="border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10">
                                                        <td colSpan={9} className="px-4 py-3 text-center">
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                                                                No beliefs or actions linked yet
                                                            </p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )}
                                    </>
                                );
                            })}

                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create New Bet</h3>
                            <BetForm onSave={handleCreateBet} onCancel={() => setIsFormOpen(false)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingBet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit Bet</h3>
                            <BetForm bet={editingBet} onSave={handleUpdateBet} onCancel={() => setEditingBet(null)} />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
