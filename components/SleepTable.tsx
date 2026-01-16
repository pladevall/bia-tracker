'use client';

import { useState } from 'react';
import { SleepEntry } from '@/lib/types';
import { TimeSeriesTable, TimeSeriesRow, SectionHeaderRow } from './TimeSeriesTable';
import Tooltip from './Tooltip';
import { TrendPeriod, getTrendPeriodLabel, getComparisonEntry, formatTrendValue } from '@/lib/trend-utils';

interface SleepTableProps {
    entries: SleepEntry[];
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
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

export function SleepTable({ entries }: SleepTableProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'timing', 'stages', 'interruptions']));
    const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('7');

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

    const comparisonEntry = getComparisonEntry(sortedEntries, trendPeriod, (e) => e.sleepDate);
    const latestEntry = sortedEntries[0];

    const renderTrendCell = (
        currentValue: number | undefined,
        comparisonValue: number | undefined,
        higherIsBetter: boolean = true
    ) => {
        if (currentValue === undefined || comparisonValue === undefined) {
            return <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20"><span className="text-xs text-gray-300 dark:text-gray-600">—</span></td>;
        }

        const diff = currentValue - comparisonValue;
        const improved = diff === 0 ? null : (higherIsBetter ? diff > 0 : diff < 0);
        const { text, color } = formatTrendValue(diff, improved);

        return (
            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                <span className={`text-xs tabular-nums font-medium ${color}`}>
                    {text}
                </span>
            </td>
        );
    };

    return (
        <TimeSeriesTable
            headerLabel="Sleep"
            columns={sortedEntries}
            headerFixedContent={
                <th className="px-2 py-2 text-center min-w-[70px] border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Trend</span>
                        <div className="flex gap-0.5">
                            {(['7', '30'] as TrendPeriod[]).map((period) => (
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
                fixedCellsCount={1}
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
                        fixedContent={renderTrendCell(latestEntry?.sleepScore, comparisonEntry?.sleepScore, true)}
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
                                            <span className="px-1 bg-gray-100/50 dark:bg-gray-800/50 rounded tabular-nums">{entry.durationScore}/50</span>
                                        </Tooltip>
                                        <Tooltip content={`Bedtime: ${entry.bedtimeScore}/30`}>
                                            <span className="px-1 bg-gray-100/50 dark:bg-gray-800/50 rounded tabular-nums">{entry.bedtimeScore}/30</span>
                                        </Tooltip>
                                        <Tooltip content={`Interruptions: ${entry.interruptionScore}/20`}>
                                            <span className="px-1 bg-gray-100/50 dark:bg-gray-800/50 rounded tabular-nums">{entry.interruptionScore}/20</span>
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
                        fixedContent={renderTrendCell(latestEntry?.data.stages.totalSleepMinutes, comparisonEntry?.data.stages.totalSleepMinutes, true)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.stages.totalSleepMinutes)}
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
                fixedCellsCount={1}
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
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                            </td>
                        }
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatTime(entry.data.sleepStart)}
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
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/20">
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                            </td>
                        }
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatTime(entry.data.sleepEnd)}
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
                        fixedContent={renderTrendCell(latestEntry?.data.stages.inBedMinutes, comparisonEntry?.data.stages.inBedMinutes, false)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.stages.inBedMinutes)}
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
                fixedCellsCount={1}
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
                        fixedContent={renderTrendCell(latestEntry?.data.stages.deepMinutes, comparisonEntry?.data.stages.deepMinutes, true)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.stages.deepMinutes)}
                                </span>
                            </td>
                        )}
                    />
                    <TimeSeriesRow
                        label="REM Sleep"
                        fixedContent={renderTrendCell(latestEntry?.data.stages.remMinutes, comparisonEntry?.data.stages.remMinutes, true)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.stages.remMinutes)}
                                </span>
                            </td>
                        )}
                    />
                    <TimeSeriesRow
                        label="Core Sleep"
                        fixedContent={renderTrendCell(latestEntry?.data.stages.coreMinutes, comparisonEntry?.data.stages.coreMinutes, true)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.stages.coreMinutes)}
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
                        fixedContent={renderTrendCell(latestEntry?.data.stages.awakeMinutes, comparisonEntry?.data.stages.awakeMinutes, false)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.stages.awakeMinutes)}
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
                fixedCellsCount={1}
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
                        fixedContent={renderTrendCell(latestEntry?.data.interruptions.wakeUpsCount ?? latestEntry?.data.interruptions.count, comparisonEntry?.data.interruptions.wakeUpsCount ?? comparisonEntry?.data.interruptions.count, false)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {entry.data.interruptions.wakeUpsCount ?? entry.data.interruptions.count}
                                </span>
                            </td>
                        )}
                    />
                    <TimeSeriesRow
                        label={
                            <div className="flex items-center gap-1">
                                Interruption Time
                                <Tooltip content="Total duration of all wake-ups and restless periods.">
                                    <svg className="w-3 h-3 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </Tooltip>
                            </div>
                        }
                        fixedContent={renderTrendCell(latestEntry?.data.interruptions.interruptionsDurationMinutes ?? latestEntry?.data.interruptions.totalMinutes, comparisonEntry?.data.interruptions.interruptionsDurationMinutes ?? comparisonEntry?.data.interruptions.totalMinutes, false)}
                        columns={sortedEntries}
                        renderCell={(entry) => (
                            <td key={entry.id} className="px-3 py-2 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                    {formatDuration(entry.data.interruptions.interruptionsDurationMinutes ?? entry.data.interruptions.totalMinutes)}
                                </span>
                            </td>
                        )}
                    />
                </>
            )}
        </TimeSeriesTable>
    );
}
