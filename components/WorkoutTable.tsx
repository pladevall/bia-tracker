'use client';

import { useState, useMemo } from 'react';
import { RunningActivity, LiftingWorkout, WorkoutType, VolumePeriod, BODY_PARTS, RUNNING_MILESTONES } from '@/lib/types';
import { TimeSeriesTable, TimeSeriesRow, SectionHeaderRow } from './TimeSeriesTable';

interface WorkoutTableProps {
    runningActivities: RunningActivity[];
    liftingWorkouts: LiftingWorkout[];
}

// Format seconds as mm:ss or h:mm:ss
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format pace (seconds per mile) as m:ss
function formatPace(secondsPerMile: number): string {
    const minutes = Math.floor(secondsPerMile / 60);
    const secs = Math.round(secondsPerMile % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Get date string in YYYY-MM-DD format
function toDateKey(dateString: string): string {
    return new Date(dateString).toISOString().split('T')[0];
}

// Format date for column header
function formatDateHeader(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get cumulative time at a specific mile distance
function getTimeAtMile(splits: { mile: number; cumulativeSeconds: number }[] | null, targetMiles: number): number | null {
    if (!splits || splits.length === 0) return null;

    // Find the split closest to the target distance
    const targetSplit = splits.find(s => Math.abs(s.mile - targetMiles) < 0.2);
    if (targetSplit) {
        return targetSplit.cumulativeSeconds;
    }

    // For fractional distances (like 5K = 3.1 miles), interpolate
    const lastCompleteMile = Math.floor(targetMiles);
    const fraction = targetMiles - lastCompleteMile;

    const baseSplit = splits.find(s => s.mile === lastCompleteMile);
    const nextSplit = splits.find(s => s.mile === lastCompleteMile + 1);

    if (baseSplit && nextSplit) {
        const timeForFraction = (nextSplit.cumulativeSeconds - baseSplit.cumulativeSeconds) * fraction;
        return baseSplit.cumulativeSeconds + timeForFraction;
    }

    if (baseSplit && fraction === 0) {
        return baseSplit.cumulativeSeconds;
    }

    return null;
}

export default function WorkoutTable({ runningActivities, liftingWorkouts }: WorkoutTableProps) {
    const [workoutType, setWorkoutType] = useState<WorkoutType>('all');
    const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>('7');

    // Get unique dates from all workouts, sorted newest first
    const allDates = useMemo(() => {
        const dateSet = new Set<string>();

        if (workoutType !== 'lifting') {
            runningActivities.forEach(a => dateSet.add(toDateKey(a.activityDate)));
        }
        if (workoutType !== 'run') {
            liftingWorkouts.forEach(w => dateSet.add(toDateKey(w.workoutDate)));
        }

        return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    }, [runningActivities, liftingWorkouts, workoutType]);

    // Index workouts by date
    const runningByDate = useMemo(() => {
        const map = new Map<string, RunningActivity>();
        runningActivities.forEach(a => map.set(toDateKey(a.activityDate), a));
        return map;
    }, [runningActivities]);

    const liftingByDate = useMemo(() => {
        const map = new Map<string, LiftingWorkout>();
        liftingWorkouts.forEach(w => map.set(toDateKey(w.workoutDate), w));
        return map;
    }, [liftingWorkouts]);

    // Calculate volume period range
    const volumeStartDate = useMemo(() => {
        const now = new Date();
        switch (volumePeriod) {
            case '7':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case '30':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            case '90':
                return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            case 'YTD':
                return new Date(now.getFullYear(), 0, 1);
            case 'PY':
                return new Date(now.getFullYear() - 1, 0, 1);
            default:
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
    }, [volumePeriod]);

    const volumeEndDate = useMemo(() => {
        if (volumePeriod === 'PY') {
            return new Date(new Date().getFullYear() - 1, 11, 31);
        }
        return new Date();
    }, [volumePeriod]);

    // Calculate volume totals
    const liftingVolume = useMemo(() => {
        const workoutsInRange = liftingWorkouts.filter(w => {
            const date = new Date(w.workoutDate);
            return date >= volumeStartDate && date <= volumeEndDate;
        });

        let totalSets = 0;
        let totalDuration = 0;
        let totalReps = 0;
        const bodyPartTotals: Record<string, number> = {};

        workoutsInRange.forEach(w => {
            totalSets += w.totalSets;
            totalDuration += w.durationSeconds;
            totalReps += w.totalReps;

            if (w.bodyParts) {
                Object.entries(w.bodyParts).forEach(([part, stats]) => {
                    bodyPartTotals[part] = (bodyPartTotals[part] || 0) + stats.sets;
                });
            }
        });

        return { totalSets, totalDuration, totalReps, bodyPartTotals };
    }, [liftingWorkouts, volumeStartDate, volumeEndDate]);

    const runningVolume = useMemo(() => {
        const activitiesInRange = runningActivities.filter(a => {
            const date = new Date(a.activityDate);
            return date >= volumeStartDate && date <= volumeEndDate;
        });

        let totalMiles = 0;
        let totalDuration = 0;

        activitiesInRange.forEach(a => {
            totalMiles += a.distanceMiles;
            totalDuration += a.durationSeconds;
        });

        return { totalMiles, totalDuration };
    }, [runningActivities, volumeStartDate, volumeEndDate]);

    // Get body parts that have data
    const activeBodyParts = useMemo(() => {
        const parts = new Set<string>();
        liftingWorkouts.forEach(w => {
            if (w.bodyParts) {
                Object.keys(w.bodyParts).forEach(p => parts.add(p));
            }
        });
        // Sort by BODY_PARTS order
        return BODY_PARTS.filter(p => parts.has(p));
    }, [liftingWorkouts]);

    // Get running milestones that have data
    const activeMilestones = useMemo(() => {
        return RUNNING_MILESTONES.filter(m => {
            return runningActivities.some(a => a.distanceMiles >= m.miles * 0.95);
        });
    }, [runningActivities]);

    // Limit to recent dates for display
    const displayDates = allDates.slice(0, 10);

    if (runningActivities.length === 0 && liftingWorkouts.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No workout data yet. Connect Strava or Hevy to sync your workouts.
            </div>
        );
    }

    const colCount = displayDates.length;
    const stickyWidth = "min-w-[140px]";

    return (
        <TimeSeriesTable
            headerLabel={
                <span>Metric</span>
            }
            headerFixedContent={
                <th className="px-2 py-2 text-center min-w-[80px] border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/50 dark:bg-blue-900/20">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Volume</span>
                        <div className="flex gap-0.5">
                            {(['7', '30', '90', 'YTD', 'PY'] as VolumePeriod[]).map(period => (
                                <button
                                    key={period}
                                    onClick={() => setVolumePeriod(period)}
                                    className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${volumePeriod === period
                                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {period === 'YTD' || period === 'PY' ? period : `${period}d`}
                                </button>
                            ))}
                        </div>
                    </div>
                </th>
            }
            columns={displayDates}
            renderColumnHeader={(date) => (
                <th key={date} className="px-3 py-2 text-center min-w-[80px] border-l border-gray-100 dark:border-gray-800/50">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {formatDateHeader(date)}
                    </span>
                </th>
            )}
            stickyColumnWidth={stickyWidth}
        >
            {/* Workout type filter row */}
            <SectionHeaderRow
                label={
                    <div className="flex gap-0.5">
                        {(['all', 'lifting', 'run'] as WorkoutType[]).map(type => (
                            <button
                                key={type}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setWorkoutType(type);
                                }}
                                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${workoutType === type
                                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {type === 'run' ? 'Run' : type === 'lifting' ? 'Lift' : 'All'}
                            </button>
                        ))}
                    </div>
                }
                color="gray"
                columnCount={colCount}
                fixedCellsCount={1}
            />

            {/* Lifting Section */}
            {workoutType !== 'run' && liftingWorkouts.length > 0 && (
                <>
                    <SectionHeaderRow
                        label="Lifting"
                        color="purple"
                        columnCount={colCount}
                        fixedCellsCount={1}
                    />
                    {/* Sets */}
                    <TimeSeriesRow
                        label="Sets"
                        fixedContent={
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                    {liftingVolume.totalSets}
                                </span>
                            </td>
                        }
                        stickyColumnWidth={stickyWidth}
                    >
                        {displayDates.map(date => {
                            const workout = liftingByDate.get(date);
                            return (
                                <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    {workout ? (
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {workout.totalSets}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    )}
                                </td>
                            );
                        })}
                    </TimeSeriesRow>
                    {/* Duration */}
                    <TimeSeriesRow
                        label="Duration"
                        fixedContent={
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                    {formatDuration(liftingVolume.totalDuration)}
                                </span>
                            </td>
                        }
                        stickyColumnWidth={stickyWidth}
                    >
                        {displayDates.map(date => {
                            const workout = liftingByDate.get(date);
                            return (
                                <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    {workout ? (
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {formatDuration(workout.durationSeconds)}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    )}
                                </td>
                            );
                        })}
                    </TimeSeriesRow>
                    {/* Reps */}
                    <TimeSeriesRow
                        label="Reps"
                        fixedContent={
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                    {liftingVolume.totalReps.toLocaleString()}
                                </span>
                            </td>
                        }
                        stickyColumnWidth={stickyWidth}
                    >
                        {displayDates.map(date => {
                            const workout = liftingByDate.get(date);
                            return (
                                <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    {workout ? (
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {workout.totalReps.toLocaleString()}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    )}
                                </td>
                            );
                        })}
                    </TimeSeriesRow>
                    {/* Body parts */}
                    {activeBodyParts.map(part => (
                        <TimeSeriesRow
                            key={part}
                            label={<span className="capitalize">{part}</span>}
                            fixedContent={
                                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                    <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                        {liftingVolume.bodyPartTotals[part] || '—'}
                                    </span>
                                </td>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const workout = liftingByDate.get(date);
                                const sets = workout?.bodyParts?.[part]?.sets;
                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {sets ? (
                                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                {sets}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </TimeSeriesRow>
                    ))}
                </>
            )}

            {/* Running Section */}
            {workoutType !== 'lifting' && runningActivities.length > 0 && (
                <>
                    <SectionHeaderRow
                        label="Running"
                        color="orange"
                        columnCount={colCount}
                        fixedCellsCount={1}
                    />
                    {/* Miles */}
                    <TimeSeriesRow
                        label="Miles"
                        fixedContent={
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                    {runningVolume.totalMiles.toFixed(1)}
                                </span>
                            </td>
                        }
                        stickyColumnWidth={stickyWidth}
                    >
                        {displayDates.map(date => {
                            const activity = runningByDate.get(date);
                            return (
                                <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    {activity ? (
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {activity.distanceMiles.toFixed(1)}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    )}
                                </td>
                            );
                        })}
                    </TimeSeriesRow>
                    {/* Duration */}
                    <TimeSeriesRow
                        label="Duration"
                        fixedContent={
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                    {formatDuration(runningVolume.totalDuration)}
                                </span>
                            </td>
                        }
                        stickyColumnWidth={stickyWidth}
                    >
                        {displayDates.map(date => {
                            const activity = runningByDate.get(date);
                            return (
                                <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    {activity ? (
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {formatDuration(activity.durationSeconds)}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    )}
                                </td>
                            );
                        })}
                    </TimeSeriesRow>
                    {/* Pace */}
                    <TimeSeriesRow
                        label="Avg Pace"
                        fixedContent={
                            <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                <span className="text-xs tabular-nums font-medium text-gray-400">—</span>
                            </td>
                        }
                        stickyColumnWidth={stickyWidth}
                    >
                        {displayDates.map(date => {
                            const activity = runningByDate.get(date);
                            return (
                                <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                    {activity?.averagePaceSeconds ? (
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {formatPace(activity.averagePaceSeconds)}/mi
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    )}
                                </td>
                            );
                        })}
                    </TimeSeriesRow>
                    {/* Split times at milestones */}
                    {activeMilestones.map(milestone => (
                        <TimeSeriesRow
                            key={milestone.key}
                            label={milestone.label}
                            fixedContent={
                                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                    <span className="text-xs tabular-nums font-medium text-gray-400">—</span>
                                </td>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                if (!activity || activity.distanceMiles < milestone.miles * 0.95) {
                                    return (
                                        <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        </td>
                                    );
                                }
                                const time = getTimeAtMile(activity.splits, milestone.miles);
                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {time ? (
                                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                {formatDuration(Math.round(time))}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </TimeSeriesRow>
                    ))}
                </>
            )}
        </TimeSeriesTable>
    );
}
