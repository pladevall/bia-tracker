'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Bet, Belief, BoldTake, UserSettings } from '@/lib/practice/types';
import { UPSIDE_OPTIONS } from '@/lib/practice/types';
import { calculateBetScore, parseTimelineYears } from '@/lib/practice/bet-scoring';
import { formatDownside, formatCurrency } from '@/lib/practice/formatting';
import { getEffectiveConfidence, isComputedConfidence, calculateExpectedValue, calculateBetTimeline, calculateBeliefDuration } from '@/lib/practice/bet-calculations';
import BetForm from './BetForm';
import Tooltip from '@/components/Tooltip';

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

interface DragHandleProps {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
}

function DragHandle({ attributes, listeners }: DragHandleProps) {
    return (
        <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-gray-500 opacity-0 transition group-hover:opacity-100 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Reorder"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
        >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="6" r="1.5" />
                <circle cx="8" cy="12" r="1.5" />
                <circle cx="8" cy="18" r="1.5" />
                <circle cx="16" cy="6" r="1.5" />
                <circle cx="16" cy="12" r="1.5" />
                <circle cx="16" cy="18" r="1.5" />
            </svg>
        </button>
    );
}

interface SortableRowProps {
    id: string;
    children: (props: DragHandleProps) => React.ReactNode;
    className?: string;
    rowProps?: React.HTMLAttributes<HTMLTableRowElement>;
}

function SortableRow({ id, children, className, rowProps }: SortableRowProps) {
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`group ${isDragging ? 'bg-indigo-50/40 dark:bg-indigo-900/20' : ''} ${className ?? ''}`}
            {...rowProps}
        >
            {children({ attributes, listeners })}
        </tr>
    );
}

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
    const [detailFilter, setDetailFilter] = useState<'all' | 'beliefs' | 'actions'>('all');
    const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [betOrder, setBetOrder] = useState<string[]>([]);
    const [actionOrder, setActionOrder] = useState<Record<string, string[]>>({});
    const [isBeliefFormOpen, setIsBeliefFormOpen] = useState(false);
    const [beliefText, setBeliefText] = useState('');
    const [beliefStatus, setBeliefStatus] = useState<'untested' | 'testing' | 'proven' | 'disproven'>('untested');
    const [beliefBetId, setBeliefBetId] = useState<string | null>(null);
    const [isBeliefSaving, setIsBeliefSaving] = useState(false);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    // Close add menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-add-menu]')) {
                setIsAddMenuOpen(false);
            }
        };
        if (isAddMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isAddMenuOpen]);

    // Sync salary input when userSettings changes
    useEffect(() => {
        setSalaryInput(String(userSettings?.annual_salary ?? 150000));
    }, [userSettings?.annual_salary]);

    // Compute scores and sort
    const sortedBets = useMemo(() => {
        return [...bets].map(bet => ({ ...bet, bet_score: bet.bet_score ?? calculateBetScore(bet) }));
    }, [bets]);

    useEffect(() => {
        setBetOrder(sortedBets.map(bet => bet.id));
    }, [sortedBets]);

    useEffect(() => {
        setActionOrder((prev) => {
            const next: Record<string, string[]> = {};
            const groups = new Map<string, string[]>();

            const sortedTakes = [...boldTakes].sort((a, b) => {
                const aOrder = a.sort_order ?? 0;
                const bOrder = b.sort_order ?? 0;
                if (aOrder !== bOrder) return aOrder - bOrder;
                const aTime = a.created_at ? Date.parse(a.created_at) : 0;
                const bTime = b.created_at ? Date.parse(b.created_at) : 0;
                return aTime - bTime;
            });

            const betsById = new Map(sortedBets.map((bet) => [bet.id, bet]));

            sortedTakes.forEach((take) => {
                if (!take.bet_id || !betsById.has(take.bet_id)) return;
                const groupKey = take.belief_id
                    ? `belief-${take.belief_id}`
                    : `unlinked-${take.bet_id}`;
                const list = groups.get(groupKey) || [];
                list.push(take.id);
                groups.set(groupKey, list);
            });

            groups.forEach((ids, key) => {
                const existing = prev[key] || [];
                const existingSet = new Set(existing);
                const merged = existing.filter(id => ids.includes(id));
                ids.forEach((id) => {
                    if (!existingSet.has(id)) merged.push(id);
                });
                next[key] = merged;
            });

            return next;
        });
    }, [boldTakes, sortedBets]);

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

    const handleSaveInlineEdit = useCallback(async (betId: string, field: string) => {
        const trimmedValue = editValue.trim();

        const updates: Partial<Bet> = {};
        if (field === 'upside_multiplier') {
            if (!trimmedValue) {
                updates.upside_multiplier = null;
            } else {
                updates.upside_multiplier = parseFloat(trimmedValue);
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

    const handleUpdateBetStatus = useCallback(async (betId: string, status: Bet['status']) => {
        try {
            const res = await fetch(`/api/practice/bets/${betId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating bet status:', error);
        }
    }, [onRefresh]);

    const handleCreateBelief = useCallback(async () => {
        if (!beliefText.trim()) return;
        setIsBeliefSaving(true);
        try {
            const res = await fetch('/api/practice/beliefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    belief: beliefText.trim(),
                    status: beliefStatus,
                    bet_id: beliefBetId,
                }),
            });
            if (res.ok) {
                setBeliefText('');
                setBeliefStatus('untested');
                setBeliefBetId(null);
                setIsBeliefFormOpen(false);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error creating belief:', error);
        } finally {
            setIsBeliefSaving(false);
        }
    }, [beliefText, beliefStatus, beliefBetId, onRefresh]);

    const orderedBets = useMemo(() => {
        const betMap = new Map(sortedBets.map((bet) => [bet.id, bet]));
        return betOrder
            .map((id) => betMap.get(id))
            .filter((bet): bet is Bet => Boolean(bet));
    }, [betOrder, sortedBets]);

    const getOrderedActions = useCallback((actions: BoldTake[], groupKey: string) => {
        const order = actionOrder[groupKey];
        if (!order) return actions;
        const actionMap = new Map(actions.map((action) => [action.id, action]));
        const ordered = order
            .map((id) => actionMap.get(id))
            .filter((action): action is BoldTake => Boolean(action));
        const missing = actions.filter((action) => !order.includes(action.id));
        return [...ordered, ...missing];
    }, [actionOrder]);

    const handleBetDragEnd = useCallback(async (event: { active: { id: string }; over: { id: string } | null }) => {
        if (!event.over || event.active.id === event.over.id) return;
        const activeIndex = betOrder.indexOf(event.active.id);
        const overIndex = betOrder.indexOf(event.over.id);
        if (activeIndex === -1 || overIndex === -1) return;
        const newOrder = arrayMove(betOrder, activeIndex, overIndex);
        setBetOrder(newOrder);

        try {
            await fetch('/api/practice/bets/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrder }),
            });
            onRefresh?.();
        } catch (error) {
            console.error('Error reordering bets:', error);
        }
    }, [betOrder, onRefresh]);

    const handleActionDragEnd = useCallback(async (
        event: { active: { id: string }; over: { id: string } | null },
        groupKey: string
    ) => {
        if (!event.over || event.active.id === event.over.id) return;
        const currentOrder = actionOrder[groupKey] || [];
        const activeIndex = currentOrder.indexOf(event.active.id);
        const overIndex = currentOrder.indexOf(event.over.id);
        if (activeIndex === -1 || overIndex === -1) return;
        const newOrder = arrayMove(currentOrder, activeIndex, overIndex);

        setActionOrder((prev) => ({
            ...prev,
            [groupKey]: newOrder,
        }));

        try {
            await fetch('/api/practice/bold-takes/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newOrder }),
            });
            onRefresh?.();
        } catch (error) {
            console.error('Error reordering actions:', error);
        }
    }, [actionOrder, onRefresh]);

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

    const handleUpdateBeliefText = useCallback(async (beliefId: string, beliefText: string) => {
        if (!beliefText.trim()) return;
        try {
            const res = await fetch(`/api/practice/beliefs/${beliefId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ belief: beliefText.trim() }),
            });
            if (res.ok) {
                setEditingField(null);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating belief text:', error);
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

    const handleUpdateActionDescription = useCallback(async (actionId: string, description: string) => {
        if (!description.trim()) return;
        try {
            const res = await fetch(`/api/practice/bold-takes/${actionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: description.trim() }),
            });
            if (res.ok) {
                setEditingField(null);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating action description:', error);
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

    const formatEstimatedDate = useCallback((days: number) => {
        if (!days || days <= 0) return null;
        const target = new Date();
        target.setDate(target.getDate() + days);
        return target.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!hoveredActionId) return;
            const activeElement = document.activeElement;
            if (activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) return;

            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                handleUpdateActionStatus(hoveredActionId, 'done');
            } else if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                handleUpdateActionStatus(hoveredActionId, 'skipped');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [hoveredActionId, handleUpdateActionStatus]);

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
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error deleting bet:', error);
        }
    }, [onRefresh]);


    // Confidence color (0-100 scale)
    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return 'text-green-500';
        if (confidence >= 50) return 'text-yellow-500';
        return 'text-red-500';
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
                                            className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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
                                            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
                                        >
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5">
                            {(['all', 'beliefs', 'actions'] as const).map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setDetailFilter(option)}
                                    className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wide rounded-sm transition-colors ${
                                        detailFilter === option
                                            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        <div className="relative" data-add-menu>
                            <button
                                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                                className="inline-flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                title="Add new"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            {isAddMenuOpen && (
                                <div className="absolute right-0 mt-2 w-40 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-1 z-10">
                                    <button
                                        onClick={() => {
                                            setIsFormOpen(true);
                                            setIsAddMenuOpen(false);
                                        }}
                                        className="block w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    >
                                        New Bet
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsBeliefFormOpen(true);
                                            setIsAddMenuOpen(false);
                                        }}
                                        className="block w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    >
                                        New Belief
                                    </button>
                                    {!isCompleted && (
                                        <button
                                            onClick={() => {
                                                onOpenPracticeModal?.();
                                                setIsAddMenuOpen(false);
                                            }}
                                            className="block w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                        >
                                            New Action
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {orderedBets.length === 0 ? (
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
                                <th className="px-6 py-3 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[200px]">
                                    Name
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Timeline
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Confidence
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Status
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                                    Upside
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                                    Expected Value
                                </th>
                                <th className="px-5 py-3 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[90px]">
                                    Downside
                                </th>
                                <th className="px-5 py-3 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px]">
                                </th>
                            </tr>
                        </thead>
                        <DndContext sensors={sensors} onDragEnd={handleBetDragEnd}>
                            <SortableContext items={betOrder} strategy={verticalListSortingStrategy}>
                                <tbody>
                                    {orderedBets.map((bet) => {
                                const isExpanded = expandedBets.has(bet.id);
                                const linkedBeliefs = beliefs
                                    .filter(b => b.bet_id === bet.id)
                                    .sort((a, b) => {
                                        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
                                        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
                                        if (aTime !== bTime) return bTime - aTime;
                                        return a.id.localeCompare(b.id);
                                    });
                                const linkedTakes = boldTakes
                                    .filter(t => t.bet_id === bet.id)
                                    .sort((a, b) => {
                                        const aOrder = a.sort_order ?? 0;
                                        const bOrder = b.sort_order ?? 0;
                                        if (aOrder !== bOrder) return aOrder - bOrder;
                                        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
                                        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
                                        if (aTime !== bTime) return aTime - bTime;
                                        return a.id.localeCompare(b.id);
                                    });
                                const showBeliefs = detailFilter !== 'actions';
                                const showActions = detailFilter !== 'beliefs';
                                const hasBeliefs = linkedBeliefs.length > 0;
                                const hasActions = linkedTakes.length > 0;
                                const hasConfidenceData = hasBeliefs || hasActions;
                                const showEmptyState = detailFilter === 'all'
                                    ? !hasBeliefs && !hasActions
                                    : detailFilter === 'beliefs'
                                        ? !hasBeliefs
                                        : !hasActions;
                                const isEditing = editingField?.betId === bet.id;
                                const timelineYears = calculateBetTimeline(linkedBeliefs, linkedTakes);
                                const effectiveConfidence = getEffectiveConfidence(bet);

                                // Calculate downside (opportunity cost)
                                const calculatedDownside = timelineYears * (userSettings?.annual_salary ?? 150000);

                                // Calculate upside multiplier (auto or manual)
                                const displayUpside = bet.upside_multiplier ?? null;

                                // Calculate expected value: downside × upside_multiplier
                                const expectedValue = displayUpside !== null
                                    ? calculateExpectedValue(displayUpside, calculatedDownside)
                                    : null;

                                return (
                                    <React.Fragment key={bet.id}>
                                        {/* Main Bet Row */}
                                        <SortableRow
                                            id={bet.id}
                                            className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                                        >
                                            {({ attributes, listeners }) => (
                                                <>
                                                    <td className="px-6 py-3" onClick={() => toggleBet(bet.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <DragHandle attributes={attributes} listeners={listeners} />
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
                                            <td className="px-5 py-3 text-center text-xs text-gray-700 dark:text-gray-300">
                                                {(() => {
                                                    const beliefDurations = linkedBeliefs.map(belief => {
                                                        const derived = calculateBeliefDuration(belief.id, linkedTakes);
                                                        return derived > 0 ? derived : (belief.duration_days ?? 0);
                                                    });
                                                    const unlinkedActionDurations = linkedTakes
                                                        .filter(take => !take.belief_id)
                                                        .map(take => take.duration_days ?? 30);
                                                    const allDurations = [...beliefDurations, ...unlinkedActionDurations];
                                                    const totalDays = allDurations.reduce((sum, d) => sum + d, 0);

                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-1">
                                                                <div className="font-semibold text-white">Timeline Rollup:</div>
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
                                                                <div className="text-xs text-gray-300 mt-1">Belief durations roll up from actions, plus unlinked actions</div>
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
                                            {/* Confidence */}
                                            <td className={`px-5 py-3 text-center text-xs font-medium tabular-nums ${hasConfidenceData ? getConfidenceColor(effectiveConfidence) : 'text-gray-400'}`}>
                                                {hasConfidenceData ? (
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
                                                                    <div className="text-xs text-gray-300">Set manually</div>
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
                                                ) : (
                                                    <span>-</span>
                                                )}
                                            </td>
                                            {/* Status */}
                                            <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={bet.status}
                                                    onChange={(e) => handleUpdateBetStatus(bet.id, e.target.value as Bet['status'])}
                                                    className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-xs text-gray-700 dark:text-gray-200"
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="paused">Paused</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                            </td>
                                            {/* Upside - Inline Editable with Rich Tooltip */}
                                            <td
                                                className="px-3 py-2 text-center text-xs text-gray-700 dark:text-gray-300"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {(() => {
                                                    const displayUpside = bet.upside_multiplier ?? null;

                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-2">
                                                                <div className="font-semibold text-white">Upside Multiple:</div>

                                                                {/* Current/Display Value */}
                                                                <div className="text-xs space-y-0.5">
                                                                    {displayUpside !== null ? (
                                                                        <>
                                                                            <div className="font-mono">{displayUpside}x return if successful</div>
                                                                            <div className="text-gray-300 mt-1">For every $1 invested, expect ${displayUpside} back if bet succeeds</div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="text-gray-300">Set a multiplier to model expected returns.</div>
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
                                                                        onClick={() => handleStartEdit(bet.id, 'upside_multiplier', displayUpside !== null ? String(displayUpside) : '')}
                                                                        className="hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400 cursor-help"
                                                                        title="Click to set upside multiplier"
                                                                    >
                                                                        {displayUpside !== null ? `${displayUpside}x` : '-'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </td>
                                            {/* Expected Value Column (NEW) */}
                                            <td className={`px-5 py-3 text-center text-xs font-medium ${expectedValue !== null ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                                <Tooltip content={
                                                    <div className="space-y-1">
                                                        <div className="font-semibold text-white">Expected Value:</div>
                                                        {displayUpside !== null ? (
                                                            <div className="text-xs font-mono space-y-0.5">
                                                                <div>{formatCurrency(calculatedDownside)} × {displayUpside}x</div>
                                                                <div className="border-t border-gray-600 pt-0.5 mt-0.5">= {formatCurrency(expectedValue || 0)}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-gray-300">Set an upside multiplier to calculate expected value.</div>
                                                        )}
                                                        {timelineYears > 0 && (
                                                            <div className="text-xs text-gray-300 mt-1">
                                                                Downside: {timelineYears.toFixed(2)} yrs × ${userSettings?.annual_salary.toLocaleString() ?? '150,000'}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-300 mt-1">Potential monetary outcome if bet succeeds</div>
                                                    </div>
                                                }>
                                                    <span className="cursor-help">
                                                        {expectedValue !== null ? formatCurrency(expectedValue || 0) : '-'}
                                                    </span>
                                                </Tooltip>
                                            </td>
                                            {/* Downside - Read-Only with Rich Tooltip */}
                                            <td className="px-5 py-3 text-center text-xs text-red-600 dark:text-red-400 font-medium">
                                                {(() => {
                                                    const calculatedDownside = timelineYears * (userSettings?.annual_salary ?? 150000);

                                                    return (
                                                        <Tooltip content={
                                                            <div className="space-y-1">
                                                                <div className="font-semibold text-white">Downside:</div>
                                                                <div className="text-xs text-gray-300 mt-1">Financial cost of pursuing this bet if it goes to zero.</div>
                                                                <div className="text-xs space-y-0.5 font-mono mt-2">
                                                                    {timelineYears > 0 && (
                                                                        <>
                                                                            <div>{timelineYears.toFixed(2)} yrs × ${userSettings?.annual_salary.toLocaleString() ?? '150,000'}</div>
                                                                            <div className="border-t border-gray-600 pt-0.5 mt-0.5">= {formatCurrency(calculatedDownside)}</div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        }>
                                                            <span className="cursor-help">
                                                                {formatDownside(calculatedDownside, true)}
                                                            </span>
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                                </>
                                            )}
                                        </SortableRow>

                                        {/* Expanded Details - Column-Aligned Nested Rows */}
                                        {isExpanded && (
                                            <>
                                                {linkedBeliefs.map((belief) => {
                                                    const beliefGroupKey = `belief-${belief.id}`;
                                                    const beliefActions = getOrderedActions(
                                                        linkedTakes.filter(t => t.belief_id === belief.id),
                                                        beliefGroupKey
                                                    );
                                                    const beliefActionIds = beliefActions.map((take) => take.id);
                                                    return (
                                                        <React.Fragment key={`belief-${belief.id}`}>
                                                            {/* Belief Row */}
                                                            {showBeliefs && (
                                                                <tr className="border-b border-gray-100 dark:border-gray-800/50 bg-indigo-50/30 dark:bg-indigo-900/10">
                                                                    <td className="px-6 py-2">
                                                                        <div className="flex items-center gap-2 pl-5">
                                                                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-200 dark:bg-indigo-700 rounded font-medium">B</span>
                                                                            {editingField?.betId === belief.id && editingField?.field === `belief-text-${belief.id}` ? (
                                                                                <input
                                                                                    autoFocus
                                                                                    value={editValue}
                                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                                    onBlur={() => handleUpdateBeliefText(belief.id, editValue)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleUpdateBeliefText(belief.id, editValue);
                                                                                        if (e.key === 'Escape') setEditingField(null);
                                                                                    }}
                                                                                    className="w-full min-w-[220px] px-2 py-0.5 text-xs border border-indigo-300 dark:border-indigo-700 rounded bg-white dark:bg-gray-900"
                                                                                />
                                                                            ) : (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleStartEdit(belief.id, `belief-text-${belief.id}`, belief.belief);
                                                                                    }}
                                                                                    className="text-left text-xs text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-300"
                                                                                >
                                                                                    {belief.belief}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center">
                                                                        <Tooltip content={(() => {
                                                                            const derived = calculateBeliefDuration(belief.id, linkedTakes);
                                                                            const fallback = belief.duration_days ?? 0;
                                                                            const days = derived > 0 ? derived : fallback;
                                                                            return (
                                                                                <div className="space-y-1">
                                                                                    <div>Auto-calculated from sum of linked actions.</div>
                                                                                    <div className="text-xs text-gray-300">Estimated: {formatEstimatedDate(days) ?? '—'}</div>
                                                                                </div>
                                                                            );
                                                                        })()}>
                                                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-help">
                                                                                {(() => {
                                                                                    const derived = calculateBeliefDuration(belief.id, linkedTakes);
                                                                                    const fallback = belief.duration_days ?? 0;
                                                                                    const days = derived > 0 ? derived : fallback;
                                                                                    return `${days}d`;
                                                                                })()}
                                                                            </span>
                                                                        </Tooltip>
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                                className="text-xs text-gray-700 dark:text-gray-200 font-medium hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                                                            >
                                                                                {belief.confidence ?? 50}%
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                                className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-xs text-gray-700 dark:text-gray-200 cursor-help"
                                                                            >
                                                                                <option value="untested">Untested</option>
                                                                                <option value="testing">Testing</option>
                                                                                <option value="proven">Proven</option>
                                                                                <option value="disproven">Disproven</option>
                                                                            </select>
                                                                        </Tooltip>
                                                                    </td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                </tr>
                                                            )}

                                                            {/* Action Rows (nested under belief) */}
                                                            {showActions && beliefActions.length > 0 && (
                                                                <DndContext
                                                                    sensors={sensors}
                                                                    onDragEnd={(event) => handleActionDragEnd(event, beliefGroupKey)}
                                                                >
                                                                    <SortableContext items={beliefActionIds} strategy={verticalListSortingStrategy}>
                                                                        {beliefActions.map(take => (
                                                                            <SortableRow
                                                                                key={`action-${take.id}`}
                                                                                id={take.id}
                                                                                className="border-b border-gray-100 dark:border-gray-800/50 bg-green-50/20 dark:bg-green-900/5"
                                                                                rowProps={{
                                                                                    onMouseEnter: () => setHoveredActionId(take.id),
                                                                                    onMouseLeave: () => setHoveredActionId(null),
                                                                                }}
                                                                            >
                                                                                {({ attributes, listeners }) => (
                                                                                    <>
                                                                                        <td className="px-6 py-2">
                                                                                            <div className="flex items-center gap-2 pl-10">
                                                                                                <DragHandle attributes={attributes} listeners={listeners} />
                                                                                                <span className="text-[10px] px-1.5 py-0.5 bg-green-200 dark:bg-green-700 rounded font-medium">A</span>
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    {editingField?.betId === take.id && editingField?.field === `action-description-${take.id}` ? (
                                                                                                        <input
                                                                                                            autoFocus
                                                                                                            value={editValue}
                                                                                                            onChange={(e) => setEditValue(e.target.value)}
                                                                                                            onBlur={() => handleUpdateActionDescription(take.id, editValue)}
                                                                                                            onKeyDown={(e) => {
                                                                                                                if (e.key === 'Enter') handleUpdateActionDescription(take.id, editValue);
                                                                                                                if (e.key === 'Escape') setEditingField(null);
                                                                                                            }}
                                                                                                            className="w-full px-2 py-0.5 text-xs border border-green-300 dark:border-green-700 rounded bg-white dark:bg-gray-900"
                                                                                                        />
                                                                                                    ) : (
                                                                                                        <button
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                handleStartEdit(take.id, `action-description-${take.id}`, take.description);
                                                                                                            }}
                                                                                                            className="w-full text-left text-xs text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-300"
                                                                                                        >
                                                                                                            {take.description}
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                    <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                            <Tooltip content={`Estimated: ${formatEstimatedDate(take.duration_days ?? 30) ?? '—'}`}>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingField({ betId: take.id, field: `action-duration-${take.id}` });
                                                                                        setEditValue(String(take.duration_days ?? 30));
                                                                                    }}
                                                                                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-help"
                                                                                >
                                                                                    {take.duration_days ?? 30}d
                                                                                </button>
                                                                            </Tooltip>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                                className="text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                                                            >
                                                                                {take.confidence ?? 50}%
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                                className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-xs text-gray-700 dark:text-gray-200 cursor-help"
                                                                            >
                                                                                <option value="committed">Committed</option>
                                                                                <option value="done">Done</option>
                                                                                <option value="skipped">Skipped</option>
                                                                            </select>
                                                                        </Tooltip>
                                                                    </td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                    <td className="px-5 py-2"></td>
                                                                                    </>
                                                                                )}
                                                                            </SortableRow>
                                                                        ))}
                                                                    </SortableContext>
                                                                </DndContext>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Actions without linked beliefs */}
                                                {(() => {
                                                    const unlinkedGroupKey = `unlinked-${bet.id}`;
                                                    const unlinkedActions = getOrderedActions(
                                                        linkedTakes.filter(t => t.bet_id === bet.id && !t.belief_id),
                                                        unlinkedGroupKey
                                                    );
                                                    const unlinkedActionIds = unlinkedActions.map((take) => take.id);

                                                    if (!showActions || unlinkedActions.length === 0) return null;

                                                    return (
                                                        <DndContext
                                                            sensors={sensors}
                                                            onDragEnd={(event) => handleActionDragEnd(event, unlinkedGroupKey)}
                                                        >
                                                            <SortableContext items={unlinkedActionIds} strategy={verticalListSortingStrategy}>
                                                                {unlinkedActions.map(take => (
                                                                    <SortableRow
                                                                        key={`unlinked-action-${take.id}`}
                                                                        id={take.id}
                                                                        className="border-b border-gray-100 dark:border-gray-800/50 bg-green-50/20 dark:bg-green-900/5"
                                                                        rowProps={{
                                                                            onMouseEnter: () => setHoveredActionId(take.id),
                                                                            onMouseLeave: () => setHoveredActionId(null),
                                                                        }}
                                                                    >
                                                                        {({ attributes, listeners }) => (
                                                                            <>
                                                                                <td className="px-4 py-1">
                                                                                    <div className="flex items-center gap-2 pl-5">
                                                                                        <DragHandle attributes={attributes} listeners={listeners} />
                                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-green-200 dark:bg-green-700 rounded font-medium">A</span>
                                                                                        <div className="min-w-0 flex-1">
                                                                                            {editingField?.betId === take.id && editingField?.field === `action-description-${take.id}` ? (
                                                                                                <input
                                                                                                    autoFocus
                                                                                                    value={editValue}
                                                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                                                    onBlur={() => handleUpdateActionDescription(take.id, editValue)}
                                                                                                    onKeyDown={(e) => {
                                                                                                        if (e.key === 'Enter') handleUpdateActionDescription(take.id, editValue);
                                                                                                        if (e.key === 'Escape') setEditingField(null);
                                                                                                    }}
                                                                                                    className="w-full px-2 py-0.5 text-xs border border-green-300 dark:border-green-700 rounded bg-white dark:bg-gray-900"
                                                                                                />
                                                                                            ) : (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleStartEdit(take.id, `action-description-${take.id}`, take.description);
                                                                                                    }}
                                                                                                    className="w-full text-left text-xs text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-300"
                                                                                                >
                                                                                                    {take.description}
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                        <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                <Tooltip content={`Estimated: ${formatEstimatedDate(take.duration_days ?? 30) ?? '—'}`}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingField({ betId: take.id, field: `action-duration-${take.id}` });
                                                                            setEditValue(String(take.duration_days ?? 30));
                                                                        }}
                                                                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-help"
                                                                    >
                                                                        {take.duration_days ?? 30}d
                                                                    </button>
                                                                </Tooltip>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                        <td className="px-5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
                                                                    className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-xs text-gray-700 dark:text-gray-200 cursor-help"
                                                                >
                                                                    <option value="committed">Committed</option>
                                                                    <option value="done">Done</option>
                                                                    <option value="skipped">Skipped</option>
                                                                </select>
                                                            </Tooltip>
                                                        </td>
                                                        <td className="px-5 py-2"></td>
                                                        <td className="px-5 py-2"></td>
                                                        <td className="px-5 py-2"></td>
                                                        <td className="px-5 py-2"></td>
                                                        <td className="px-5 py-2"></td>
                                                                            </>
                                                                        )}
                                                                    </SortableRow>
                                                                ))}
                                                            </SortableContext>
                                                        </DndContext>
                                                    );
                                                })()}

                                                {/* Empty State */}
                                                {showEmptyState && (
                                                    <tr className="border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10">
                                                        <td colSpan={8} className="px-4 py-3 text-center">
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                                                                {detailFilter === 'beliefs'
                                                                    ? 'No beliefs linked yet'
                                                                    : detailFilter === 'actions'
                                                                        ? 'No actions linked yet'
                                                                        : 'No beliefs or actions linked yet'}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )}
                                    </React.Fragment>
                                );
                                    })}

                                </tbody>
                            </SortableContext>
                        </DndContext>
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

            {/* Create Belief Modal */}
            {isBeliefFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Belief</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Belief
                                </label>
                                <input
                                    type="text"
                                    value={beliefText}
                                    onChange={(e) => setBeliefText(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    placeholder="What do you believe?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Link to Bet (optional)
                                </label>
                                <select
                                    value={beliefBetId ?? ''}
                                    onChange={(e) => setBeliefBetId(e.target.value || null)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="">Unlinked</option>
                                    {orderedBets.map((bet) => (
                                        <option key={bet.id} value={bet.id}>
                                            {bet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Status
                                </label>
                                <select
                                    value={beliefStatus}
                                    onChange={(e) => setBeliefStatus(e.target.value as typeof beliefStatus)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="untested">Untested</option>
                                    <option value="testing">Testing</option>
                                    <option value="proven">Proven</option>
                                    <option value="disproven">Disproven</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsBeliefFormOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateBelief}
                                    disabled={!beliefText.trim() || isBeliefSaving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                                >
                                    {isBeliefSaving ? 'Saving...' : 'Create Belief'}
                                </button>
                            </div>
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
                            <BetForm
                                bet={editingBet}
                                onSave={handleUpdateBet}
                                onCancel={() => setEditingBet(null)}
                                onDelete={async () => {
                                    await handleDeleteBet(editingBet.id);
                                    setEditingBet(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
