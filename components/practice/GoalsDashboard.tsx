'use client';

import { useState, useCallback } from 'react';
import type { PracticeGoal } from '@/lib/practice/types';

interface GoalsDashboardProps {
    goals: PracticeGoal[];
    onUpdateProgress: (id: string, value: number) => Promise<void>;
}

export default function GoalsDashboard({ goals, onUpdateProgress }: GoalsDashboardProps) {
    const [editingGoal, setEditingGoal] = useState<{ goalId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Filter to only 2 specific goals: Managed Customers and Monthly Recurring Revenue
    const displayGoals = goals.filter(goal => {
        const nameLower = goal.name.toLowerCase();
        return nameLower.includes('managed customers') ||
               nameLower.includes('monthly recurring revenue');
    });

    const handleUpdateTarget = useCallback(async (goalId: string, newTarget: number) => {
        try {
            const res = await fetch(`/api/practice/goals/${goalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_value: newTarget }),
            });
            if (res.ok) {
                setEditingGoal(null);
            }
        } catch (error) {
            console.error('Error updating target:', error);
        }
    }, []);

    // Calculate progress percentage
    const getProgress = (goal: PracticeGoal) => {
        if (goal.target_value === 0) return 0;
        return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
    };

    // Get color based on progress
    const getProgressColor = (pct: number) => {
        if (pct >= 100) return 'text-green-500';
        if (pct >= 75) return 'text-emerald-500';
        if (pct >= 50) return 'text-yellow-500';
        if (pct >= 25) return 'text-orange-500';
        return 'text-red-500';
    };

    if (displayGoals.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Goals</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No goals configured.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Goals</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800">
                            <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">
                                Metric
                            </th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                                Current
                            </th>
                            <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                                Target
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">
                                Progress
                            </th>
                            <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[60px]">
                                %
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayGoals.map((goal) => {
                            const pct = getProgress(goal);

                            return (
                                <tr
                                    key={goal.id}
                                    className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                                >
                                    <td className="px-4 py-1.5 text-xs text-gray-900 dark:text-gray-100">
                                        {goal.name}
                                    </td>
                                    <td
                                        className="px-3 py-1.5 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {editingGoal?.goalId === goal.id && editingGoal?.field === 'current' ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => {
                                                    const val = parseFloat(editValue);
                                                    if (!isNaN(val) && val >= 0) {
                                                        onUpdateProgress(goal.id, val);
                                                    }
                                                    setEditingGoal(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseFloat(editValue);
                                                        if (!isNaN(val) && val >= 0) {
                                                            onUpdateProgress(goal.id, val);
                                                        }
                                                        setEditingGoal(null);
                                                    }
                                                    if (e.key === 'Escape') setEditingGoal(null);
                                                }}
                                                className="w-20 px-2 py-0.5 text-xs text-center border border-indigo-500 rounded bg-indigo-50 dark:bg-indigo-900/20"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingGoal({ goalId: goal.id, field: 'current' });
                                                    setEditValue(String(goal.current_value));
                                                }}
                                                className="text-xs text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                            >
                                                {goal.current_value}
                                            </button>
                                        )}
                                    </td>
                                    <td
                                        className="px-3 py-1.5 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {editingGoal?.goalId === goal.id && editingGoal?.field === 'target' ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => {
                                                    const val = parseFloat(editValue);
                                                    if (!isNaN(val) && val >= 0) {
                                                        handleUpdateTarget(goal.id, val);
                                                    }
                                                    setEditingGoal(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseFloat(editValue);
                                                        if (!isNaN(val) && val >= 0) {
                                                            handleUpdateTarget(goal.id, val);
                                                        }
                                                        setEditingGoal(null);
                                                    }
                                                    if (e.key === 'Escape') setEditingGoal(null);
                                                }}
                                                className="w-20 px-2 py-0.5 text-xs text-center border border-indigo-500 rounded bg-indigo-50 dark:bg-indigo-900/20"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingGoal({ goalId: goal.id, field: 'target' });
                                                    setEditValue(String(goal.target_value));
                                                }}
                                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                            >
                                                {goal.target_value}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${pct >= 100 ? 'bg-green-500' :
                                                        pct >= 75 ? 'bg-emerald-500' :
                                                            pct >= 50 ? 'bg-yellow-500' :
                                                                pct >= 25 ? 'bg-orange-500' :
                                                                    'bg-red-500'
                                                    }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </td>
                                    <td className={`px-3 py-1.5 text-right text-xs font-medium tabular-nums ${getProgressColor(pct)}`}>
                                        {pct}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
