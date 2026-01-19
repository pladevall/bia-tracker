'use client';

import { useState, useMemo } from 'react';
import { SleepEntry } from '@/lib/types';
import { TimeSeriesTable, TimeSeriesRow, SectionHeaderRow } from './TimeSeriesTable';
import Tooltip from './Tooltip';
import { TrendPeriod, getTrendPeriodLabel, getComparisonEntry, formatTrendValue } from '@/lib/trend-utils';
import { Goal } from '@/lib/supabase';
import GoalEditor from './GoalEditor';

interface SleepTableProps {
    entries: SleepEntry[];
    goals: Goal[];
    onSaveGoal: (metricKey: string, value: number) => void;
    onDeleteGoal: (metricKey: string) => void;
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

function formatDurationDiff(minutes: number): string {
    const sign = minutes > 0 ? '+' : minutes < 0 ? '-' : '';
    const absMinutes = Math.abs(minutes);
    const h = Math.floor(absMinutes / 60);
    const m = Math.round(absMinutes % 60);

    if (absMinutes < 60) {
        return `${sign}${m}m`;
    }
    if (m === 0) {
        return `${sign}${h}h`;
    }
    return `${sign}${h}h ${m}m`;
}

// Format time difference (in minutes) as a timespan for bedtime/wake trends
function formatTimeDiff(diffMinutes: number): string {
    const sign = diffMinutes > 0 ? '+' : diffMinutes < 0 ? '-' : '';
    const absMinutes = Math.abs(diffMinutes);
    const h = Math.floor(absMinutes / 60);
    const m = Math.round(absMinutes % 60);

    if (absMinutes < 60) {
        return `${sign}${m}min`;
    }
    if (m === 0) {
        return `${sign}${h}hr`;
    }
    return `${sign}${h}hr ${m}min`;
}

// Convert ISO time to minutes from midnight (handling day wraparound for bedtime)
function timeToMinutes(isoString: string, isBedtime: boolean = false): number | undefined {
    if (!isoString) return undefined;
    try {
        const date = new Date(isoString);
        let minutes = date.getHours() * 60 + date.getMinutes();
        // For bedtime, if after midnight but before 6am, add 24hrs to properly average
        if (isBedtime && minutes < 360) {
            minutes += 1440; // Add 24 hours
        }
        return minutes;
    } catch {
        return undefined;
    }
}

function formatTime(isoString: string): string {
    if (!isoString) return '—';
    try {
        return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
        return '—';
    }
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getScoreColor(score: number): string {
    if (score >= 85) return 'text-emerald-500 font-medium';
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
}

function calculateAverage(
    entries: SleepEntry[],
    period: TrendPeriod,
    getValue: (entry: SleepEntry) => number | undefined
): number | undefined {
    if (entries.length === 0) return undefined;

    const now = new Date();
    let cutoffDate: Date;

    if (period === 'YTD') {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
    } else {
        const days = parseInt(period);
        cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Filter entries within the period
    const entriesInPeriod = entries.filter(entry => {
        const entryDate = new Date(entry.sleepDate);
        return entryDate >= cutoffDate;
    });

    if (entriesInPeriod.length === 0) return undefined;

    // Calculate average
    const values = entriesInPeriod.map(getValue).filter((v): v is number => v !== undefined);
    if (values.length === 0) return undefined;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

function calculateAverageTime(
    entries: SleepEntry[],
    period: TrendPeriod,
    getTime: (entry: SleepEntry) => string,
    isBedtime: boolean = false
): string | undefined {
    if (entries.length === 0) return undefined;

    const now = new Date();
    let cutoffDate: Date;

    if (period === 'YTD') {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
    } else {
        const days = parseInt(period);
        cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Filter entries within the period
    const entriesInPeriod = entries.filter(entry => {
        const entryDate = new Date(entry.sleepDate);
        return entryDate >= cutoffDate;
    });

    if (entriesInPeriod.length === 0) return undefined;

    // Convert times to minutes from midnight and average
    const times = entriesInPeriod.map(entry => {
        const timeStr = getTime(entry);
        if (!timeStr) return undefined;
        const date = new Date(timeStr);
        let mins = date.getHours() * 60 + date.getMinutes();
        // If calculating bedtime average and time is early morning (< 12 PM),
        // treat it as "next day" (add 24h) to ensure correct averaging around midnight.
        // e.g. 11 PM (23:00) and 1 AM (25:00) averages to Midnight (24:00).
        if (isBedtime && mins < 720) {
            mins += 1440;
        }
        return mins;
    }).filter((t): t is number => t !== undefined);

    if (times.length === 0) return undefined;

    let avgMinutes = times.reduce((acc, val) => acc + val, 0) / times.length;
    // Normalize back to 0-1439 range
    if (avgMinutes >= 1440) avgMinutes -= 1440;

    const hours = Math.floor(avgMinutes / 60);
    const minutes = Math.round(avgMinutes % 60);

    // Create a date object with the average time
    const avgDate = new Date();
    avgDate.setHours(hours, minutes, 0, 0);

    return avgDate.toISOString();
}

export function SleepTable({ entries, goals, onSaveGoal, onDeleteGoal }: SleepTableProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'timing', 'stages', 'interruptions']));
    const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('7');
    const [editingGoal, setEditingGoal] = useState<{ metricKey: string; label: string; type?: 'number' | 'duration' | 'time' } | null>(null);

    // Build goals map
    const goalsMap = useMemo(() => {
        const map = new Map<string, number>();
        goals.forEach(g => map.set(g.metricKey, g.targetValue));
        return map;
    }, [goals]);

    // Handle goal save with special logic for bedtime normalization
    const handleSaveGoal = (metricKey: string, value: number) => {
        // Special handling for bedtime: if value < 360 (6 AM), assume next day (add 24h)
        // This ensures e.g. 1 AM is stored as 1500, matching timeToMinutes logic
        if (metricKey === 'sleep_bedtime' && value < 360) {
            onSaveGoal(metricKey, value + 1440);
        } else {
            onSaveGoal(metricKey, value);
        }
    };

    const toggleSection = (section: string) => {
        const next = new Set(expandedSections);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        setExpandedSections(next);
    };

    if (!entries || entries.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No sleep entries found.
            </div>
        );
    }

    // Sort by date descending
    const sortedEntries = [...entries].sort((a, b) =>
        new Date(b.sleepDate).getTime() - new Date(a.sleepDate).getTime()
    );

    const comparisonEntry = getComparisonEntry(sortedEntries, trendPeriod, (e) => e.sleepDate) ?? undefined;
    const latestEntry = sortedEntries[0];

    const renderTrendCell = (
        currentValue: number | undefined,
        comparisonValue: number | undefined,
        higherIsBetter: boolean = true,
        isDuration: boolean = false
    ) => {
        if (currentValue === undefined || comparisonValue === undefined) {
            return <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20"><span className="text-xs text-gray-300 dark:text-gray-600">—</span></td>;
        }

        const diff = currentValue - comparisonValue;
        const improved = diff === 0 ? null : (higherIsBetter ? diff > 0 : diff < 0);

        // Format the text based on whether it's a duration
        let text: string;
        if (isDuration) {
            text = diff === 0 ? '—' : formatDurationDiff(diff);
        } else {
            const formatted = formatTrendValue(diff, improved);
            text = formatted.text;
        }

        const color = improved === null ? 'text-gray-600 dark:text-gray-300'
            : improved ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400';

        const periodLabel = getTrendPeriodLabel(trendPeriod);
        const tooltipValue = isDuration ? formatDuration(comparisonValue) : comparisonValue.toFixed(1);

        return (
            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                <Tooltip content={`Compared to ${periodLabel} ago: ${tooltipValue}`}>
                    <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>
                        {text}
                    </span>
                </Tooltip>
            </td>
        );
    };

    const renderAverageCell = (
        getValue: (entry: SleepEntry) => number | undefined,
        isDuration: boolean = false
    ) => {
        const avg = calculateAverage(sortedEntries, trendPeriod, getValue);

        if (avg === undefined) {
            return (
                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                    <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                </td>
            );
        }

        const displayValue = isDuration ? formatDuration(avg) : avg.toFixed(1);
        const periodLabel = getTrendPeriodLabel(trendPeriod);

        return (
            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                <Tooltip content={`Average over ${periodLabel}`}>
                    <span className="text-xs tabular-nums font-medium cursor-help text-gray-700 dark:text-gray-300">
                        {displayValue}
                    </span>
                </Tooltip>
            </td>
        );
    };

    const renderAverageTimeCell = (
        getTime: (entry: SleepEntry) => string,
        isBedtime: boolean = false
    ) => {
        const avgTime = calculateAverageTime(sortedEntries, trendPeriod, getTime, isBedtime);

        if (avgTime === undefined) {
            return (
                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                    <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                </td>
            );
        }

        const displayValue = formatTime(avgTime);
        const periodLabel = getTrendPeriodLabel(trendPeriod);

        return (
            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                <Tooltip content={`Average over ${periodLabel}`}>
                    <span className="text-xs tabular-nums font-medium cursor-help text-gray-700 dark:text-gray-300">
                        {displayValue}
                    </span>
                </Tooltip>
            </td>
        );
    };

    // Render time trend cell (for bedtime/wake time - shows diff from average as timespan)
    const renderTimeTrendCell = (
        getTime: (entry: SleepEntry) => string,
        latestEntry: SleepEntry | undefined,
        comparisonEntry: SleepEntry | undefined,
        isBedtime: boolean = false,
        earlierIsBetter: boolean = true
    ) => {
        if (!latestEntry || !comparisonEntry) {
            return <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20"><span className="text-xs text-gray-300 dark:text-gray-600">—</span></td>;
        }

        const latestMinutes = timeToMinutes(getTime(latestEntry), isBedtime);
        const comparisonMinutes = timeToMinutes(getTime(comparisonEntry), isBedtime);

        if (latestMinutes === undefined || comparisonMinutes === undefined) {
            return <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20"><span className="text-xs text-gray-300 dark:text-gray-600">—</span></td>;
        }

        const diff = latestMinutes - comparisonMinutes;
        if (diff === 0) {
            return (
                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                    <span className="text-xs text-gray-600 dark:text-gray-300">—</span>
                </td>
            );
        }

        // For bedtime: later (positive diff) means going to bed later - typically bad
        // For wake time: later (positive diff) means waking up later - context-dependent
        const improved = earlierIsBetter ? diff < 0 : diff > 0;
        const color = improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
        const text = formatTimeDiff(diff);
        const periodLabel = getTrendPeriodLabel(trendPeriod);

        // Format comparison time for tooltip
        const comparisonTimeStr = new Date(getTime(comparisonEntry)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        return (
            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                <Tooltip content={`Compared to ${periodLabel} ago: ${comparisonTimeStr}`}>
                    <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>
                        {text}
                    </span>
                </Tooltip>
            </td>
        );
    };

    // Render goal cell
    const renderGoalCell = (metricKey: string, label: string, currentValue: number | undefined, type: 'number' | 'duration' | 'time' = 'number', unit?: string, lowerIsBetter: boolean = false) => {
        const goalValue = goalsMap.get(metricKey);

        let displayValue = '+';
        let colorClass = 'text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-colors';
        let tooltipContent: React.ReactNode = 'Set Goal';

        if (goalValue) {
            if (currentValue !== undefined && currentValue !== null) {
                // Determine if goal is met based on direction
                let isMet = false;
                if (lowerIsBetter) {
                    isMet = currentValue <= goalValue;
                } else {
                    isMet = currentValue >= goalValue;
                }

                // Minimalist: use standard gray text
                colorClass = 'text-gray-700 dark:text-gray-300 font-medium';
                const statusColor = isMet ? 'text-emerald-500' : 'text-red-500';

                const gap = Math.abs(goalValue - currentValue);
                // Label depends on direction
                let gapLabel = 'Gap';
                if (lowerIsBetter) {
                    gapLabel = isMet ? 'Under by' : 'Over by';
                } else {
                    gapLabel = isMet ? 'Exceeded by' : 'Gap';
                }

                const fmt = (v: number) => {
                    if (type === 'duration') return formatDuration(v);
                    if (type === 'time') {
                        const h = Math.floor(v / 60) % 24;
                        const m = Math.round(v % 60);
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    }
                    return type === 'number' ? v.toFixed(1) : v.toString();
                };

                tooltipContent = (
                    <div className="flex flex-col gap-0.5 text-xs">
                        <span><span className="font-bold">Goal:</span> {lowerIsBetter ? '< ' : '> '}{fmt(goalValue)} {unit}</span>
                        <span><span className="font-bold">Current:</span> {fmt(currentValue)} {unit}</span>
                        <span className={statusColor}><span className="font-bold">{gapLabel}:</span> {type === 'duration' || type === 'time' ? formatDuration(gap) : gap.toFixed(1)} {unit}</span>
                    </div>
                );
            } else {
                colorClass = 'text-gray-500 dark:text-gray-400 font-medium';
                tooltipContent = (
                    <span><span className="font-bold">Goal:</span> {type === 'duration' ? formatDuration(goalValue) : goalValue} {unit}</span>
                );
            }

            if (type === 'time') {
                const h = Math.floor(goalValue / 60) % 24;
                const m = Math.round(goalValue % 60);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                displayValue = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            } else {
                displayValue = type === 'duration' ? formatDuration(goalValue) : goalValue.toString();
            }
        }

        // Add recommended time info for Bedtime/Wake Up
        if (metricKey === 'sleep_bedtime' || metricKey === 'sleep_wake_up') {
            const durationGoal = goalsMap.get('sleep_duration') || 480; // Default 8h
            let idealTimeStr = '';
            let idealLabel = '';

            if (metricKey === 'sleep_bedtime') {
                const wakeGoal = goalsMap.get('sleep_wake_up');
                if (wakeGoal) {
                    const idealParams = wakeGoal - durationGoal;
                    // Normalize for display
                    let displayMin = idealParams;
                    while (displayMin < 0) displayMin += 1440;
                    const d = new Date();
                    d.setHours(Math.floor(displayMin / 60) % 24, Math.round(displayMin % 60), 0, 0);
                    idealTimeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    idealLabel = 'Ideal based on Wake Up goal';
                }
            } else {
                const bedGoal = goalsMap.get('sleep_bedtime');
                if (bedGoal) {
                    const idealParams = bedGoal + durationGoal;
                    const d = new Date();
                    d.setHours(Math.floor(idealParams / 60) % 24, Math.round(idealParams % 60), 0, 0);
                    idealTimeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    idealLabel = 'Ideal based on Bedtime goal';
                }
            }

            if (idealTimeStr) {
                // If tooltipContent was just text, wrap it
                if (typeof tooltipContent === 'string') {
                    tooltipContent = <span>{tooltipContent}</span>;
                }

                tooltipContent = (
                    <div className="flex flex-col gap-1 text-xs">
                        {tooltipContent}
                        <div className="pt-1 mt-1 border-t border-gray-600">
                            <span className="text-gray-400">{idealLabel}:</span>
                            <br />
                            <span className="font-bold text-emerald-400">{idealTimeStr}</span>
                        </div>
                    </div>
                );
            }
        }

        return (
            <td
                className="group px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                onClick={() => setEditingGoal({ metricKey, label, type })}
            >
                <Tooltip content={tooltipContent}>
                    <span className={`text-xs tabular-nums ${colorClass}`}>
                        {displayValue}
                    </span>
                </Tooltip>
            </td>
        );
    };

    return (
        <>
            <TimeSeriesTable
                headerLabel="Metric"
                columns={sortedEntries}
                headerFixedContent={
                    <>
                        {/* Average column with period selector */}
                        <th className="px-2 py-2 text-center min-w-[70px] border-l border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Average</span>
                                <div className="flex gap-0.5">
                                    {(['7', '30', '90', 'YTD'] as TrendPeriod[]).map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => setTrendPeriod(period)}
                                            className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${trendPeriod === period
                                                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {getTrendPeriodLabel(period)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </th>

                        {/* Goal column - Minimalist header */}
                        <th className="px-2 py-2 text-center min-w-[100px] border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Goal</span>
                        </th>


                        {/* Trend column */}
                        <th className="px-2 py-2 text-center min-w-[100px] border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Trend</span>
                        </th>
                    </>
                }
                renderColumnHeader={(entry) => (
                    <th key={entry.id} className="px-3 py-2 text-center min-w-[100px] border-l border-gray-100 dark:border-gray-800/50">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {formatDate(entry.sleepDate)}
                        </span>
                    </th>
                )}
            >
                {/* Overview Section */}
                <SectionHeaderRow
                    label="Overview"
                    isExpanded={expandedSections.has('overview')}
                    onToggle={() => toggleSection('overview')}
                    columnCount={sortedEntries.length}
                    fixedCellsCount={3}
                />

                {expandedSections.has('overview') && (
                    <>
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Sleep Score
                                    <Tooltip content={
                                        <div className="space-y-2">
                                            <p>Overall sleep quality score (0-100) based on three key components:</p>
                                            <ul className="list-disc pl-4 space-y-1">
                                                <li><span className="font-medium text-emerald-500">Duration (50 pts):</span> Total time asleep vs target.</li>
                                                <li><span className="font-medium text-emerald-500">Bedtime (30 pts):</span> Consistency with target bedtime.</li>
                                                <li><span className="font-medium text-emerald-500">Interruptions (20 pts):</span> Number and duration of wake-ups.</li>
                                            </ul>
                                        </div>
                                    }>
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.sleepScore, false)}
                                    {renderGoalCell('sleep_score', 'Target Sleep Score', latestEntry?.sleepScore, 'number', 'pts')}
                                    {renderTrendCell(latestEntry?.sleepScore, comparisonEntry?.sleepScore, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`text-sm font-bold ${getScoreColor(entry.sleepScore)}`}>
                                            {entry.sleepScore}
                                        </span>
                                        {/* Breakdown */}
                                        <div className="flex gap-1 text-[9px] text-gray-400">
                                            <Tooltip content={`Duration: ${entry.durationScore}/50`}>
                                                <span className="flex items-center gap-1 px-1 bg-gray-100/50 dark:bg-gray-800/50 rounded tabular-nums">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    {entry.durationScore}/50
                                                </span>
                                            </Tooltip>
                                            <Tooltip content={`Bedtime: ${entry.bedtimeScore}/30`}>
                                                <span className="flex items-center gap-1 px-1 bg-gray-100/50 dark:bg-gray-800/50 rounded tabular-nums">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                                    {entry.bedtimeScore}/30
                                                </span>
                                            </Tooltip>
                                            <Tooltip content={`Interruptions: ${entry.interruptionScore}/20`}>
                                                <span className="flex items-center gap-1 px-1 bg-gray-100/50 dark:bg-gray-800/50 rounded tabular-nums">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                    {entry.interruptionScore}/20
                                                </span>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </td>
                            )}
                        />
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Duration
                                    <Tooltip content="Total time asleep. Target: 8 hours (50 pts).">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.stages.totalSleepMinutes, true)}
                                    {renderGoalCell('sleep_duration', 'Target Duration', latestEntry?.data.stages.totalSleepMinutes, 'duration')}
                                    {renderTrendCell(latestEntry?.data.stages.totalSleepMinutes, comparisonEntry?.data.stages.totalSleepMinutes, true, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatDuration(entry.data.stages.totalSleepMinutes)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                    </>
                )}

                {/* Timing Section */}
                <SectionHeaderRow
                    label="Timing"
                    isExpanded={expandedSections.has('timing')}
                    onToggle={() => toggleSection('timing')}
                    columnCount={sortedEntries.length}
                    fixedCellsCount={3}
                />

                {expandedSections.has('timing') && (
                    <>
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Bedtime
                                    <Tooltip content="Time you went to bed. Target: 10:30 PM (30 pts).">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageTimeCell((e) => e.data.sleepStart, true)}
                                    {renderGoalCell('sleep_bedtime', 'Target Bedtime', latestEntry ? timeToMinutes(latestEntry.data.sleepStart, true) : undefined, 'time')}
                                    {renderTimeTrendCell((e) => e.data.sleepStart, latestEntry, comparisonEntry, true, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatTime(entry.data.sleepStart)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Wake Up
                                    <Tooltip content="Time you woke up.">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageTimeCell((e) => e.data.sleepEnd)}
                                    {renderGoalCell('sleep_wake_up', 'Target Wake Up', latestEntry ? timeToMinutes(latestEntry.data.sleepEnd, false) : undefined, 'time')}
                                    {renderTimeTrendCell((e) => e.data.sleepEnd, latestEntry, comparisonEntry, false, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatTime(entry.data.sleepEnd)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Time in Bed
                                    <Tooltip content="Total time spent in bed, including time to fall asleep and time awake after waking.">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.stages.inBedMinutes, true)}
                                    {renderGoalCell('sleep_in_bed', 'Target Time in Bed', latestEntry?.data.stages.inBedMinutes, 'duration')}
                                    {renderTrendCell(latestEntry?.data.stages.inBedMinutes, comparisonEntry?.data.stages.inBedMinutes, false, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatDuration(entry.data.stages.inBedMinutes)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                    </>
                )}

                {/* Stages Section */}
                <SectionHeaderRow
                    label="Stages"
                    isExpanded={expandedSections.has('stages')}
                    onToggle={() => toggleSection('stages')}
                    columnCount={sortedEntries.length}
                    fixedCellsCount={3}
                />

                {expandedSections.has('stages') && (
                    <>
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Deep Sleep
                                    <Tooltip content="Physical recovery stage. Essential for muscle growth and repair.">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.stages.deepMinutes, true)}
                                    {renderGoalCell('sleep_deep', 'Target Deep Sleep', latestEntry?.data.stages.deepMinutes, 'duration')}
                                    {renderTrendCell(latestEntry?.data.stages.deepMinutes, comparisonEntry?.data.stages.deepMinutes, true, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatDuration(entry.data.stages.deepMinutes)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                        <TimeSeriesRow
                            label="REM Sleep"
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.stages.remMinutes, true)}
                                    {renderGoalCell('sleep_rem', 'Target REM Sleep', latestEntry?.data.stages.remMinutes, 'duration')}
                                    {renderTrendCell(latestEntry?.data.stages.remMinutes, comparisonEntry?.data.stages.remMinutes, true, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatDuration(entry.data.stages.remMinutes)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                        <TimeSeriesRow
                            label="Core Sleep"
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.stages.coreMinutes, true)}
                                    {renderGoalCell('sleep_core', 'Target Core Sleep', latestEntry?.data.stages.coreMinutes, 'duration')}
                                    {renderTrendCell(latestEntry?.data.stages.coreMinutes, comparisonEntry?.data.stages.coreMinutes, true, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatDuration(entry.data.stages.coreMinutes)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Awake
                                    <Tooltip content="Time spent awake during the sleep period.">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.stages.awakeMinutes, true)}
                                    {renderGoalCell('sleep_awake', 'Max Awake Time', latestEntry?.data.stages.awakeMinutes, 'duration', undefined, true)}
                                    {renderTrendCell(latestEntry?.data.stages.awakeMinutes, comparisonEntry?.data.stages.awakeMinutes, false, true)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {formatDuration(entry.data.stages.awakeMinutes)}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                    </>
                )}

                {/* Interruptions Section */}
                <SectionHeaderRow
                    label="Interruptions"
                    isExpanded={expandedSections.has('interruptions')}
                    onToggle={() => toggleSection('interruptions')}
                    columnCount={sortedEntries.length}
                    fixedCellsCount={3}
                />

                {expandedSections.has('interruptions') && (
                    <>
                        <TimeSeriesRow
                            label={
                                <div className="flex items-center gap-1">
                                    Wake Ups
                                    <Tooltip content="The number of times you were awake or restless during the night.">
                                        <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </Tooltip>
                                </div>
                            }
                            fixedContent={
                                <>
                                    {renderAverageCell((e) => e.data.interruptions.wakeUpsCount ?? e.data.interruptions.count, false)}
                                    {renderGoalCell('sleep_interruptions', 'Max Interruptions', latestEntry?.data.interruptions.wakeUpsCount ?? latestEntry?.data.interruptions.count, 'number', undefined, true)}
                                    {renderTrendCell(latestEntry?.data.interruptions.wakeUpsCount ?? latestEntry?.data.interruptions.count, comparisonEntry?.data.interruptions.wakeUpsCount ?? comparisonEntry?.data.interruptions.count, false)}
                                </>
                            }
                            columns={sortedEntries}
                            renderCell={(entry) => (
                                <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    <span className="text-xs inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                                        <span className="tabular-nums font-medium w-16 text-right whitespace-nowrap">
                                            {entry.data.interruptions.wakeUpsCount ?? entry.data.interruptions.count}
                                        </span>
                                        <span className="w-3"></span>
                                    </span>
                                </td>
                            )}
                        />
                    </>
                )}
            </TimeSeriesTable>

            {/* Goal Editor Modal */}
            {editingGoal && (
                <GoalEditor
                    metricKey={editingGoal.metricKey}
                    metricLabel={editingGoal.label}
                    inputType={editingGoal.type}
                    currentValue={goalsMap.get(editingGoal.metricKey) || null}
                    onSave={handleSaveGoal}
                    onDelete={onDeleteGoal}
                    onClose={() => setEditingGoal(null)}
                />
            )}
        </>
    );
}
