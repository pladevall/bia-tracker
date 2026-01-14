'use client';

import { useState, useMemo } from 'react';
import { SleepEntry } from '@/lib/types';
import { SleepScoreBadge } from './SleepScoreBadge';
import { SleepStageBar } from './SleepStageBar';
import { ChevronDown, ChevronRight, Moon, Bed, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VolumePeriod } from '@/lib/types'; // reusing VolumePeriod for consistency

interface SleepTableProps {
    entries: SleepEntry[];
    isLoading?: boolean;
}

export function SleepTable({ entries, isLoading }: SleepTableProps) {
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    // Sort and filter entries based on period
    // Assuming entries are passed in, likely already filtered or we filter here
    // For simplicity, we just take the last N entries
    const displayedEntries = useMemo(() => {
        if (!entries) return [];
        const sorted = [...entries].sort((a, b) => new Date(b.sleepDate).getTime() - new Date(a.sleepDate).getTime());
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        return sorted.slice(0, days);
    }, [entries, period]);

    const toggleExpand = (date: string) => {
        if (expandedDate === date) {
            setExpandedDate(null);
        } else {
            setExpandedDate(date);
        }
    };

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return `${h}h ${m}m`;
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return '-';
        try {
            return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch {
            return '-';
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading sleep data...</div>;
    }

    if (!entries || entries.length === 0) {
        return (
            <div className="p-8 text-center border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <Moon className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No Sleep Data</h3>
                <p className="text-sm text-gray-500 mt-2">
                    Connect Health Auto Export to start tracking your sleep.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Moon className="w-5 h-5 text-indigo-500" />
                    Sleep Tracking
                </h2>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 text-xs font-medium">
                    {(['7d', '30d', '90d'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "px-3 py-1 rounded-md transition-colors",
                                period === p
                                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            {p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-medium border-b border-gray-200 dark:border-gray-800">
                            <tr>
                                <th className="px-4 py-3 w-8"></th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Score</th>
                                <th className="px-4 py-3">Duration</th>
                                <th className="px-4 py-3 hidden sm:table-cell">Bedtime</th>
                                <th className="px-4 py-3 hidden sm:table-cell">Wake Up</th>
                                <th className="px-4 py-3 hidden md:table-cell">Stages</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {displayedEntries.map((entry) => {
                                if (!entry.data?.stages) return null;
                                return (
                                    <>
                                        <tr
                                            key={entry.id}
                                            onClick={() => toggleExpand(entry.sleepDate)}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3 text-gray-400">
                                                {expandedDate === entry.sleepDate ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {new Date(entry.sleepDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <SleepScoreBadge score={entry.sleepScore} />
                                            </td>
                                            <td className="px-4 py-3">
                                                {formatDuration(entry.data.stages.totalSleepMinutes)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                                                {formatTime(entry.data.sleepStart)}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                                                {formatTime(entry.data.sleepEnd)}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell w-32">
                                                <SleepStageBar stages={entry.data.stages} />
                                            </td>
                                        </tr>

                                        {expandedDate === entry.sleepDate && (
                                            <tr className="bg-gray-50/50 dark:bg-gray-900/30">
                                                <td colSpan={7} className="px-4 py-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                                        {/* Section 1: Score Breakdown */}
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Score Components</h4>
                                                            <div className="space-y-2">
                                                                <ScoreRow
                                                                    label="Duration"
                                                                    score={entry.durationScore}
                                                                    max={50}
                                                                    value={formatDuration(entry.data.stages.totalSleepMinutes)}
                                                                />
                                                                <ScoreRow
                                                                    label="Bedtime"
                                                                    score={entry.bedtimeScore}
                                                                    max={30}
                                                                    value={formatTime(entry.data.sleepStart)}
                                                                />
                                                                <ScoreRow
                                                                    label="Interruptions"
                                                                    score={entry.interruptionScore}
                                                                    max={20}
                                                                    value={`${entry.data.interruptions.count}x (${Math.round(entry.data.interruptions.totalMinutes)}m)`}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Section 2: Stages */}
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Stage Analysis</h4>
                                                            <div className="space-y-2 text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-indigo-600"></span> Deep</span>
                                                                    <div>
                                                                        <span className="font-medium mr-2">{formatDuration(entry.data.stages.deepMinutes)}</span>
                                                                        <span className="text-gray-400 text-xs">({Math.round((entry.data.stages.deepMinutes / entry.data.stages.totalSleepMinutes) * 100)}%)</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-cyan-300"></span> REM</span>
                                                                    <div>
                                                                        <span className="font-medium mr-2">{formatDuration(entry.data.stages.remMinutes)}</span>
                                                                        <span className="text-gray-400 text-xs">({Math.round((entry.data.stages.remMinutes / entry.data.stages.totalSleepMinutes) * 100)}%)</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-blue-400"></span> Core</span>
                                                                    <div>
                                                                        <span className="font-medium mr-2">{formatDuration(entry.data.stages.coreMinutes)}</span>
                                                                        <span className="text-gray-400 text-xs">({Math.round((entry.data.stages.coreMinutes / entry.data.stages.totalSleepMinutes) * 100)}%)</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between text-gray-500">
                                                                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded bg-gray-300"></span> Awake</span>
                                                                    <span>{formatDuration(entry.data.stages.awakeMinutes)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Section 3: Recommendations / Insights */}
                                                        <div className="space-y-3">
                                                            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Insights</h4>
                                                            <div className="text-sm space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <Bed className="w-4 h-4 text-gray-400" />
                                                                    <span>Time in Bed: {formatDuration(entry.data.stages.inBedMinutes)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                                    <span>Efficiency: {Math.round((entry.data.stages.totalSleepMinutes / entry.data.stages.inBedMinutes) * 100)}%</span>
                                                                </div>
                                                                {entry.interruptionScore < 10 && (
                                                                    <div className="flex items-start gap-2 text-amber-600 dark:text-amber-500 text-xs mt-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                                                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                                                        <span>High interruption detected. Check bedroom temperature or noise levels.</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ScoreRow({ label, score, max, value }: { label: string, score: number, max: number, value: string }) {
    const isLow = score < max * 0.6;
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{label}</span>
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{value}</span>
                <div className="flex items-center gap-1 w-16 justify-end">
                    <span className={cn("font-medium", isLow ? "text-amber-500" : "text-emerald-500")}>{score}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-400">{max}</span>
                </div>
            </div>
        </div>
    );
}
