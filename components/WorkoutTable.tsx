'use client';

import React, { useState, useMemo } from 'react';
import { RunningActivity, LiftingWorkout, WorkoutType, VolumePeriod, BODY_PARTS, RUNNING_MILESTONES } from '@/lib/types';
import { TimeSeriesTable, TimeSeriesRow, SectionHeaderRow } from './TimeSeriesTable';
import { Goal } from '@/lib/supabase';
import GoalEditor from './GoalEditor';
import Tooltip from './Tooltip';
import { MilestoneBadge } from './MilestoneBadge';
import { calculateLiftingMilestones, calculateRunningMilestones, ExerciseMilestones, RunningMilestone } from '@/lib/milestones';

interface WorkoutTableProps {
    runningActivities: RunningActivity[];
    liftingWorkouts: LiftingWorkout[];
    goals: Goal[];
    onSaveGoal: (metricKey: string, value: number) => void;
    onDeleteGoal: (metricKey: string) => void;
}

type VolumeDisplayMode = 'sets' | 'volume';
type TrendPeriod = 'WTD' | 'MTD' | 'QTD' | 'YTD';

// Format seconds as mm:ss or h:mm:ss
function formatDuration(seconds: number): string {
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

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

// Get date string in YYYY-MM-DD format (in local timezone)
function toDateKey(dateString: string): string {
    const date = new Date(dateString);
    // Use local date components to avoid timezone shifting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format date for column header
function formatDateHeader(dateString: string): string {
    // Parse the YYYY-MM-DD string as local midnight by appending time
    // This prevents the date from shifting due to timezone conversion
    const date = new Date(dateString + 'T12:00:00');
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

// Format volume in thousands (e.g., 12500 -> "12.5k")
function formatVolume(volumeLbs: number | undefined | null): string {
    if (volumeLbs == null || volumeLbs === 0) {
        return '0';
    }
    if (volumeLbs >= 1000) {
        return `${(volumeLbs / 1000).toFixed(1)}k`;
    }
    return volumeLbs.toFixed(0);
}

// Format trend value with sign and color
function formatTrendValue(diff: number, isVolume: boolean): { text: string; color: string } {
    if (Math.abs(diff) < 0.5) return { text: '—', color: 'text-gray-300 dark:text-gray-700' };

    const sign = diff > 0 ? '+' : '';
    const text = isVolume
        ? `${sign}${formatVolume(diff)}`
        : `${sign}${diff.toFixed(0)}`;

    // For both sets and volume, higher is better (more work done)
    const color = diff > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-500 dark:text-red-400';

    return { text, color };
}

export default function WorkoutTable({ runningActivities, liftingWorkouts, goals, onSaveGoal, onDeleteGoal }: WorkoutTableProps) {
    const [workoutType, setWorkoutType] = useState<WorkoutType>('all');
    const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>('WTD');
    const [volumeDisplayMode, setVolumeDisplayMode] = useState<VolumeDisplayMode>('sets');
    const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('WTD');
    const [expandedBodyParts, setExpandedBodyParts] = useState<Set<string>>(new Set());

    type HighlightSentiment = 'good' | 'bad' | 'neutral';
    const [highlightedRanges, setHighlightedRanges] = useState<{ metricKey: string; current: { start: Date; end: Date }; previous: { start: Date; end: Date }; sentiment: HighlightSentiment } | null>(null);
    const [editingGoal, setEditingGoal] = useState<{ metricKey: string; label: string; type?: 'number' | 'duration' | 'pace' } | null>(null);

    const goalsMap = useMemo(() => new Map(goals.map(g => [g.metricKey, g.targetValue])), [goals]);

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

    // Calculate milestones
    const liftingMilestones = useMemo(() => calculateLiftingMilestones(liftingWorkouts), [liftingWorkouts]);
    const runningMilestones = useMemo(() => calculateRunningMilestones(runningActivities), [runningActivities]);

    const liftingByDate = useMemo(() => {
        const map = new Map<string, LiftingWorkout>();
        liftingWorkouts.forEach(w => map.set(toDateKey(w.workoutDate), w));
        return map;
    }, [liftingWorkouts]);

    // Calculate volume period range
    const volumeStartDate = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day

        switch (volumePeriod) {
            case 'WTD': {
                // Return start of current week (Monday)
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                return new Date(now.setDate(diff));
            }
            case 'MTD': {
                // Return start of current month
                return new Date(now.getFullYear(), now.getMonth(), 1);
            }
            case 'QTD': {
                // Return start of current quarter
                const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
                return new Date(now.getFullYear(), quarterMonth, 1);
            }
            case 'YTD':
                return new Date(now.getFullYear(), 0, 1);
            case 'PY':
                return new Date(now.getFullYear() - 1, 0, 1);
            default:
                // Default to WTD (Monday) logic
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(now.setDate(diff));
        }
    }, [volumePeriod]);

    const volumeEndDate = useMemo(() => {
        if (volumePeriod === 'PY') {
            return new Date(new Date().getFullYear() - 1, 11, 31);
        }
        return new Date();
    }, [volumePeriod]);

    // Calculate total sets goal (sum of all body part goals)
    const totalSetsGoal = useMemo(() => {
        return BODY_PARTS.reduce((sum, part) => {
            return sum + (goalsMap.get(`lift_sets_${part}`) || 0);
        }, 0);
    }, [goalsMap]);

    // Calculate volume totals
    const liftingVolume = useMemo(() => {
        const workoutsInRange = liftingWorkouts.filter(w => {
            const date = new Date(w.workoutDate);
            return date >= volumeStartDate && date <= volumeEndDate;
        });

        let totalSets = 0;
        let totalDuration = 0;
        let totalReps = 0;
        let totalVolumeLbs = 0;
        const bodyPartSets: Record<string, number> = {};
        const bodyPartVolume: Record<string, number> = {};

        workoutsInRange.forEach(w => {
            totalSets += w.totalSets;
            totalDuration += w.durationSeconds;
            totalReps += w.totalReps;
            totalVolumeLbs += w.totalVolumeLbs || 0;

            if (w.bodyParts) {
                Object.entries(w.bodyParts).forEach(([part, stats]) => {
                    bodyPartSets[part] = (bodyPartSets[part] || 0) + stats.sets;
                    bodyPartVolume[part] = (bodyPartVolume[part] || 0) + (stats.volumeLbs || 0);
                });
            }
        });

        return { totalSets, totalDuration, totalReps, totalVolumeLbs, bodyPartSets, bodyPartVolume };
    }, [liftingWorkouts, volumeStartDate, volumeEndDate]);

    const runningVolume = useMemo(() => {
        const activitiesInRange = runningActivities.filter(a => {
            const date = new Date(a.activityDate);
            return date >= volumeStartDate && date <= volumeEndDate;
        });

        let totalMiles = 0;
        let totalDuration = 0;
        let totalElevationGain = 0;
        let maxHr = 0;

        // Weighted averages accumulators
        let totalHrDuration = 0;
        let weightedHrSum = 0;
        let totalCadenceDuration = 0;
        let weightedCadenceSum = 0;

        activitiesInRange.forEach(a => {
            totalMiles += a.distanceMiles;
            totalDuration += a.durationSeconds;
            totalElevationGain += a.elevationGainFeet || 0;
            if (a.maxHeartrate) maxHr = Math.max(maxHr, a.maxHeartrate);

            if (a.averageHeartrate) {
                totalHrDuration += a.durationSeconds;
                weightedHrSum += a.averageHeartrate * a.durationSeconds;
            }

            if (a.averageCadence) {
                totalCadenceDuration += a.durationSeconds;
                weightedCadenceSum += a.averageCadence * a.durationSeconds;
            }
        });

        const averagePace = totalMiles > 0 ? totalDuration / totalMiles : 0;
        const weightedAvgHr = totalHrDuration > 0 ? weightedHrSum / totalHrDuration : 0;
        const weightedAvgCadence = totalCadenceDuration > 0 ? weightedCadenceSum / totalCadenceDuration : 0;

        return { totalMiles, totalDuration, averagePace, totalElevationGain, maxHr, weightedAvgHr, weightedAvgCadence };
    }, [runningActivities, volumeStartDate, volumeEndDate]);

    // Calculate workout counts (for the "Workouts" row)
    const workoutCounts = useMemo(() => {
        // Get dates in range based on workoutType
        const liftingDatesInRange = new Set(
            liftingWorkouts
                .filter(w => {
                    const date = new Date(w.workoutDate);
                    return date >= volumeStartDate && date <= volumeEndDate;
                })
                .map(w => toDateKey(w.workoutDate))
        );

        const runningDatesInRange = new Set(
            runningActivities
                .filter(a => {
                    const date = new Date(a.activityDate);
                    return date >= volumeStartDate && date <= volumeEndDate;
                })
                .map(a => toDateKey(a.activityDate))
        );

        // Total count based on workoutType toggle
        let totalWorkouts = 0;
        if (workoutType === 'all') {
            // Count all unique workout days (lift + run, with overlap counting as 2)
            const allDates = new Set([...liftingDatesInRange, ...runningDatesInRange]);
            allDates.forEach(date => {
                if (liftingDatesInRange.has(date)) totalWorkouts++;
                if (runningDatesInRange.has(date)) totalWorkouts++;
            });
        } else if (workoutType === 'lifting') {
            totalWorkouts = liftingDatesInRange.size;
        } else {
            totalWorkouts = runningDatesInRange.size;
        }

        return { totalWorkouts, liftingDatesInRange, runningDatesInRange };
    }, [liftingWorkouts, runningActivities, volumeStartDate, volumeEndDate, workoutType]);

    const getWorkoutCountForDate = (date: string): number => {
        const hasLift = liftingByDate.has(date);
        const hasRun = runningByDate.has(date);
        return (hasLift ? 1 : 0) + (hasRun ? 1 : 0);
    };

    // Calculate streaks
    const streakData = useMemo(() => {
        // We need to look back far enough to calculate streaks
        // Since we have all workouts loaded, we can just iterate from the earliest date to today.

        // 1. Gather all activity dates based on filter
        const datesSet = new Set<string>();
        if (workoutType !== 'lifting') {
            runningActivities.forEach(a => datesSet.add(toDateKey(a.activityDate)));
        }
        if (workoutType !== 'run') {
            liftingWorkouts.forEach(w => datesSet.add(toDateKey(w.workoutDate)));
        }

        // Convert to sorted array (oldest to newest for correct streak calculation)
        const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));

        if (sortedDates.length === 0) {
            return { streakByDate: new Map<string, number>(), currentMaxStreak: 0, previousMaxStreak: 0, maxStreakDiff: 0 };
        }

        // 2. Identify all dates in timeline (filling gaps) to compute continuous streaks
        const streakByDate = new Map<string, number>();
        const earlistDate = new Date(sortedDates[0]);
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        let currentStreak = 0;
        const oneDayMs = 24 * 60 * 60 * 1000;

        // Iterate day by day from first workout to today
        for (let d = new Date(earlistDate); d <= now; d = new Date(d.getTime() + oneDayMs)) {
            const dateKey = toDateKey(d.toISOString());

            if (datesSet.has(dateKey)) {
                currentStreak++;
            } else {
                currentStreak = 0;
            }

            if (currentStreak > 0) {
                streakByDate.set(dateKey, currentStreak);
            }
        }

        // 3. Calculate Trend (Max Streak in Current vs Previous Period)
        // Re-use logic for period definition from trendData (which mirrors calculation inside useMemo but we can't share scope easily without refactoring)
        // Let's copy the period logic briefly since it's dependent on state 'trendPeriod'

        const nowTrend = new Date();
        nowTrend.setHours(23, 59, 59, 999);
        let currentStart = new Date();
        let previousStart = new Date();
        let previousEnd: Date;

        // Determine dates (same logic as trendData)
        currentStart.setHours(0, 0, 0, 0);
        if (trendPeriod === 'WTD') {
            const day = currentStart.getDay();
            const diff = currentStart.getDate() - day + (day === 0 ? -6 : 1);
            currentStart.setDate(diff);
        } else if (trendPeriod === 'MTD') {
            currentStart.setDate(1);
        } else if (trendPeriod === 'QTD') {
            const quarterMonth = Math.floor(currentStart.getMonth() / 3) * 3;
            currentStart.setMonth(quarterMonth, 1);
        } else if (trendPeriod === 'YTD') {
            currentStart.setMonth(0, 1);
        }

        previousStart = new Date(currentStart);
        if (trendPeriod === 'WTD') previousStart.setDate(previousStart.getDate() - 7);
        else if (trendPeriod === 'MTD') previousStart.setMonth(previousStart.getMonth() - 1);
        else if (trendPeriod === 'QTD') previousStart.setMonth(previousStart.getMonth() - 3);
        else if (trendPeriod === 'YTD') previousStart.setFullYear(previousStart.getFullYear() - 1);

        const duration = nowTrend.getTime() - currentStart.getTime();
        previousEnd = new Date(previousStart.getTime() + duration);

        // Helper to find max streak in a date range
        const getMaxStreakInRange = (start: Date, end: Date) => {
            let maxS = 0;
            // Iterate through every active streak date and check if it falls in range
            // (Efficient enough since streakByDate is mapped)

            // To be precise: we should look at all days in range[start, end]
            // and see existing entries in streakByDate.

            // Optimization: iterate range day by day
            for (let d = new Date(start); d <= end; d = new Date(d.getTime() + oneDayMs)) {
                const k = toDateKey(d.toISOString());
                const s = streakByDate.get(k) || 0;
                if (s > maxS) maxS = s;
            }
            return maxS;
        };

        const currentMaxStreak = getMaxStreakInRange(currentStart, nowTrend);
        const previousMaxStreak = getMaxStreakInRange(previousStart, previousEnd);

        return {
            streakByDate,
            currentMaxStreak,
            previousMaxStreak,
            maxStreakDiff: currentMaxStreak - previousMaxStreak
        };

    }, [liftingWorkouts, runningActivities, workoutType, trendPeriod]);

    // Calculate trend data (compare current period vs previous period)
    const trendData = useMemo(() => {
        // Reset calculations based on new period types
        const now = new Date();
        now.setHours(23, 59, 59, 999); // Include full current day in comparison

        let currentStart = new Date();
        let previousStart = new Date();
        let previousEnd: Date;

        // 1. Determine Current Start Date
        currentStart.setHours(0, 0, 0, 0);
        if (trendPeriod === 'WTD') {
            const day = currentStart.getDay();
            const diff = currentStart.getDate() - day + (day === 0 ? -6 : 1); // Monday
            currentStart.setDate(diff);
        } else if (trendPeriod === 'MTD') {
            currentStart.setDate(1);
        } else if (trendPeriod === 'QTD') {
            const quarterMonth = Math.floor(currentStart.getMonth() / 3) * 3;
            currentStart.setMonth(quarterMonth, 1);
        } else if (trendPeriod === 'YTD') {
            currentStart.setMonth(0, 1);
        }

        // 2. Determine Previous Start Date
        previousStart = new Date(currentStart);
        if (trendPeriod === 'WTD') {
            previousStart.setDate(previousStart.getDate() - 7);
        } else if (trendPeriod === 'MTD') {
            previousStart.setMonth(previousStart.getMonth() - 1);
        } else if (trendPeriod === 'QTD') {
            previousStart.setMonth(previousStart.getMonth() - 3);
        } else if (trendPeriod === 'YTD') {
            previousStart.setFullYear(previousStart.getFullYear() - 1);
        }

        // 3. Determine Previous End Date (same duration into period)
        // Duration in milliseconds from start to now
        const duration = now.getTime() - currentStart.getTime();
        previousEnd = new Date(previousStart.getTime() + duration);

        // Current period totals
        const currentWorkouts = liftingWorkouts.filter(w => {
            const date = new Date(w.workoutDate);
            return date >= currentStart && date <= now;
        });

        // Previous period totals
        const previousWorkouts = liftingWorkouts.filter(w => {
            const date = new Date(w.workoutDate);
            return date >= previousStart && date <= previousEnd;
        });

        const calculateTotals = (workouts: LiftingWorkout[]) => {
            let totalSets = 0;
            let totalVolumeLbs = 0;
            let totalDuration = 0;
            let totalReps = 0;
            const bodyPartSets: Record<string, number> = {};
            const bodyPartVolume: Record<string, number> = {};

            workouts.forEach(w => {
                totalSets += w.totalSets;
                totalVolumeLbs += w.totalVolumeLbs || 0;
                totalDuration += w.durationSeconds;
                totalReps += w.totalReps;

                if (w.bodyParts) {
                    Object.entries(w.bodyParts).forEach(([part, stats]) => {
                        bodyPartSets[part] = (bodyPartSets[part] || 0) + stats.sets;
                        bodyPartVolume[part] = (bodyPartVolume[part] || 0) + (stats.volumeLbs || 0);
                    });
                }
            });

            return { totalSets, totalVolumeLbs, totalDuration, totalReps, bodyPartSets, bodyPartVolume };
        };

        const current = calculateTotals(currentWorkouts);
        const previous = calculateTotals(previousWorkouts);

        // Calculate diffs
        const setsDiff = current.totalSets - previous.totalSets;
        const volumeDiff = current.totalVolumeLbs - previous.totalVolumeLbs;
        const durationDiff = current.totalDuration - previous.totalDuration;
        const repsDiff = current.totalReps - previous.totalReps;

        const bodyPartSetsDiff: Record<string, number> = {};
        const bodyPartVolumeDiff: Record<string, number> = {};

        // Get all body parts from both periods
        const allParts = new Set([...Object.keys(current.bodyPartSets), ...Object.keys(previous.bodyPartSets)]);
        allParts.forEach(part => {
            bodyPartSetsDiff[part] = (current.bodyPartSets[part] || 0) - (previous.bodyPartSets[part] || 0);
            bodyPartVolumeDiff[part] = (current.bodyPartVolume[part] || 0) - (previous.bodyPartVolume[part] || 0);
        });

        // Running trend
        const currentRuns = runningActivities.filter(a => {
            const date = new Date(a.activityDate);
            return date >= currentStart && date <= now;
        });
        const previousRuns = runningActivities.filter(a => {
            const date = new Date(a.activityDate);
            return date >= previousStart && date <= previousEnd;
        });

        const currentMiles = currentRuns.reduce((sum, a) => sum + a.distanceMiles, 0);
        const previousMiles = previousRuns.reduce((sum, a) => sum + a.distanceMiles, 0);
        const milesDiff = currentMiles - previousMiles;

        // Workout count trend (based on workoutType toggle)
        const currentLiftDates = new Set(currentWorkouts.map(w => toDateKey(w.workoutDate)));
        const previousLiftDates = new Set(previousWorkouts.map(w => toDateKey(w.workoutDate)));
        const currentRunDates = new Set(currentRuns.map(a => toDateKey(a.activityDate)));
        const previousRunDates = new Set(previousRuns.map(a => toDateKey(a.activityDate)));

        let currentWorkoutCount = 0;
        let previousWorkoutCount = 0;

        if (workoutType === 'all') {
            // Count all workouts (lift + run, overlap counts as 2)
            const allCurrentDates = new Set([...currentLiftDates, ...currentRunDates]);
            allCurrentDates.forEach(date => {
                if (currentLiftDates.has(date)) currentWorkoutCount++;
                if (currentRunDates.has(date)) currentWorkoutCount++;
            });
            const allPreviousDates = new Set([...previousLiftDates, ...previousRunDates]);
            allPreviousDates.forEach(date => {
                if (previousLiftDates.has(date)) previousWorkoutCount++;
                if (previousRunDates.has(date)) previousWorkoutCount++;
            });
        } else if (workoutType === 'lifting') {
            currentWorkoutCount = currentLiftDates.size;
            previousWorkoutCount = previousLiftDates.size;
        } else {
            currentWorkoutCount = currentRunDates.size;
            previousWorkoutCount = previousRunDates.size;
        }

        const workoutCountDiff = currentWorkoutCount - previousWorkoutCount;

        return {
            setsDiff,
            volumeDiff,
            durationDiff,
            repsDiff,
            bodyPartSetsDiff,
            bodyPartVolumeDiff,
            milesDiff,
            workoutCountDiff,
            comparisonDate: previousStart,
            // Raw stats for tooltip
            lifting: { current, previous },
            running: {
                currentMiles,
                previousMiles,
                // Aggregated Running Stats
                currentDuration: currentRuns.reduce((sum, a) => sum + a.durationSeconds, 0),
                previousDuration: previousRuns.reduce((sum, a) => sum + a.durationSeconds, 0),

                currentAvgHr: (() => {
                    const runsWithHr = currentRuns.filter(a => a.averageHeartrate);
                    if (!runsWithHr.length) return 0;
                    const totalDuration = runsWithHr.reduce((sum, a) => sum + a.durationSeconds, 0);
                    if (totalDuration === 0) return 0;
                    return Math.round(runsWithHr.reduce((sum, a) => sum + (a.averageHeartrate! * a.durationSeconds), 0) / totalDuration);
                })(),
                previousAvgHr: (() => {
                    const runsWithHr = previousRuns.filter(a => a.averageHeartrate);
                    if (!runsWithHr.length) return 0;
                    const totalDuration = runsWithHr.reduce((sum, a) => sum + a.durationSeconds, 0);
                    if (totalDuration === 0) return 0;
                    return Math.round(runsWithHr.reduce((sum, a) => sum + (a.averageHeartrate! * a.durationSeconds), 0) / totalDuration);
                })(),

                currentMaxHr: currentRuns.reduce((max, a) => Math.max(max, a.maxHeartrate || 0), 0),
                previousMaxHr: previousRuns.reduce((max, a) => Math.max(max, a.maxHeartrate || 0), 0),

                currentAvgCadence: (() => {
                    const runsWithCadence = currentRuns.filter(a => a.averageCadence);
                    if (!runsWithCadence.length) return 0;
                    const totalDuration = runsWithCadence.reduce((sum, a) => sum + a.durationSeconds, 0);
                    if (totalDuration === 0) return 0;
                    return Math.round(runsWithCadence.reduce((sum, a) => sum + (a.averageCadence! * a.durationSeconds), 0) / totalDuration);
                })(),
                previousAvgCadence: (() => {
                    const runsWithCadence = previousRuns.filter(a => a.averageCadence);
                    if (!runsWithCadence.length) return 0;
                    const totalDuration = runsWithCadence.reduce((sum, a) => sum + a.durationSeconds, 0);
                    if (totalDuration === 0) return 0;
                    return Math.round(runsWithCadence.reduce((sum, a) => sum + (a.averageCadence! * a.durationSeconds), 0) / totalDuration);
                })(),

                currentElevationGain: currentRuns.reduce((sum, a) => sum + (a.elevationGainFeet || 0), 0),
                previousElevationGain: previousRuns.reduce((sum, a) => sum + (a.elevationGainFeet || 0), 0),
            },
            workouts: {
                currentCount: currentWorkoutCount,
                previousCount: previousWorkoutCount,
            },
            ranges: {
                current: { start: currentStart, end: now },
                previous: { start: previousStart, end: previousEnd }
            }
        };
    }, [liftingWorkouts, runningActivities, trendPeriod, workoutType]);

    // Trend label mapping
    const periodLabels: Record<TrendPeriod, string> = {
        'WTD': 'prev week',
        'MTD': 'prev month',
        'QTD': 'prev quarter',
        'YTD': 'prev year',
    };

    // Get body parts that have data
    const activeBodyParts = useMemo(() => {
        const parts = new Set<string>();
        liftingWorkouts.forEach(w => {
            if (w.bodyParts) {
                Object.keys(w.bodyParts).forEach(p => parts.add(p));
            }
        });
        // Sort by BODY_PARTS order, then append any others found
        const sortedStandard = BODY_PARTS.filter(p => parts.has(p));
        const others = Array.from(parts).filter(p => !BODY_PARTS.includes(p as any)).sort();
        return [...sortedStandard, ...others];
    }, [liftingWorkouts]);

    // Get running milestones that have data
    const activeMilestones = useMemo(() => {
        return RUNNING_MILESTONES.filter(m => {
            return runningActivities.some(a => a.distanceMiles >= m.miles * 0.95);
        });
    }, [runningActivities]);

    // Limit to recent dates for display
    const displayDates = allDates.slice(0, 10);

    // Collect unique exercises per body part from visible workouts
    const exercisesByBodyPart = useMemo(() => {
        const result: Record<string, Map<string, { name: string; bodyPart: string; occurrences: Map<string, { sets: number; reps: number; weightLbs: number | null }> }>> = {};

        displayDates.forEach(date => {
            const workout = liftingByDate.get(date);
            workout?.exercises?.forEach(exercise => {
                if (!result[exercise.bodyPart]) {
                    result[exercise.bodyPart] = new Map();
                }
                const existing = result[exercise.bodyPart].get(exercise.name);
                if (existing) {
                    const existingOccurrence = existing.occurrences.get(date);
                    if (existingOccurrence) {
                        existing.occurrences.set(date, {
                            sets: existingOccurrence.sets + exercise.sets,
                            reps: existingOccurrence.reps + exercise.reps, // Aggregate total reps
                            weightLbs: Math.max(existingOccurrence.weightLbs || 0, exercise.weightLbs || 0) // Use max weight
                        });
                    } else {
                        existing.occurrences.set(date, {
                            sets: exercise.sets,
                            reps: exercise.reps,
                            weightLbs: exercise.weightLbs
                        });
                    }
                } else {
                    result[exercise.bodyPart].set(exercise.name, {
                        name: exercise.name,
                        bodyPart: exercise.bodyPart,
                        occurrences: new Map([[date, {
                            sets: exercise.sets,
                            reps: exercise.reps,
                            weightLbs: exercise.weightLbs
                        }]])
                    });
                }
            });
        });

        // Convert to sorted arrays
        const formatted: Record<string, Array<{ name: string; bodyPart: string; occurrences: Map<string, { sets: number; reps: number; weightLbs: number | null }> }>> = {};
        Object.entries(result).forEach(([bodyPart, exerciseMap]) => {
            formatted[bodyPart] = Array.from(exerciseMap.values())
                .sort((a, b) => a.name.localeCompare(b.name));
        });
        return formatted;
    }, [displayDates, liftingByDate]);

    // Toggle body part expansion
    const toggleBodyPart = (part: string) => {
        setExpandedBodyParts(prev => {
            const next = new Set(prev);
            if (next.has(part)) {
                next.delete(part);
            } else {
                next.add(part);
            }
            return next;
        });
    };



    if (runningActivities.length === 0 && liftingWorkouts.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No workout data yet. Connect Strava or Hevy to sync your workouts.
            </div>
        );
    }

    const colCount = displayDates.length;
    const stickyWidth = "min-w-[170px]";

    const renderGoalCell = (metricKey: string, label: string, currentValue: number | undefined, type: 'number' | 'duration' | 'pace' = 'number', unit?: string, explicitGoalValue?: number) => {
        const goalValue = explicitGoalValue !== undefined ? explicitGoalValue : goalsMap.get(metricKey);

        let displayValue = '—';
        let colorClass = 'text-gray-300 dark:text-gray-700';
        let tooltipContent: React.ReactNode = null;

        if (goalValue) {
            // Determine progress status and color
            if (currentValue !== undefined && currentValue !== null) {
                const isPace = type === 'pace';
                // For pace, lower is better. For others, higher is better.
                let ratio = isPace
                    ? (currentValue > 0 ? goalValue / currentValue : 0) // If current=0 (no run), ratio 0. If current is really fast (small), ratio high.
                    : currentValue / goalValue;

                // Correction for pace: actually we want to check if current <= goal.
                // Let's use simple comparisons instead of ratio for status
                let isMet = false;
                let isFar = false;

                if (isPace) {
                    // Goal 8:00 (480s), Current 9:00 (540s) -> Not met.
                    // Met if current <= goal
                    if (currentValue > 0) {
                        isMet = currentValue <= goalValue;
                        isFar = currentValue > goalValue * 1.15; // >15% slower
                    }
                } else {
                    isMet = currentValue >= goalValue;
                    isFar = currentValue < goalValue * 0.7; // <70% complete
                }

                if (isMet) {
                    colorClass = 'text-emerald-600 dark:text-emerald-400';
                } else if (isFar) {
                    colorClass = 'text-red-500 dark:text-red-400';
                } else {
                    colorClass = 'text-amber-600 dark:text-amber-400'; // Close/Progressing
                }

                // Calculate Gap
                const gap = Math.abs(goalValue - currentValue);
                let gapStr = '';
                if (type === 'duration') gapStr = formatDuration(gap);
                else if (type === 'pace') gapStr = formatPace(gap);
                else gapStr = gap.toLocaleString(undefined, { maximumFractionDigits: 1 });

                const gapLabel = isMet ? 'Exceeded by' : 'Gap';
                tooltipContent = (
                    <div className="flex flex-col gap-0.5 text-xs">
                        <span><span className="font-bold">Goal:</span> {type === 'duration' ? formatDuration(goalValue) : type === 'pace' ? formatPace(goalValue) : goalValue.toLocaleString()} {unit}</span>
                        <span><span className="font-bold">Current:</span> {type === 'duration' ? formatDuration(currentValue) : type === 'pace' ? formatPace(currentValue) : currentValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}</span>
                        <span><span className="font-bold">{gapLabel}:</span> {gapStr} {unit}</span>
                    </div>
                );
            } else {
                colorClass = 'text-blue-600 dark:text-blue-400 font-medium';
                tooltipContent = (
                    <span><span className="font-bold">Goal:</span> {type === 'duration' ? formatDuration(goalValue) : type === 'pace' ? formatPace(goalValue) : goalValue.toLocaleString()}</span>
                );
            }

            if (type === 'duration') {
                displayValue = formatDuration(goalValue);
            } else if (type === 'pace') {
                displayValue = formatPace(goalValue);
            } else {
                displayValue = goalValue.toLocaleString();
            }
        } else {
            displayValue = explicitGoalValue !== undefined ? '—' : '+';
            colorClass = 'text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors';
            tooltipContent = explicitGoalValue !== undefined ? 'Add goals to body parts to see total' : 'Set Goal';
        }

        return (
            <td
                className={`group px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/50 dark:bg-blue-900/20 ${explicitGoalValue !== undefined ? '' : 'cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/40'}`}
                onClick={() => explicitGoalValue === undefined && setEditingGoal({ metricKey, label, type })}
            >
                {goalValue ? (
                    <Tooltip content={tooltipContent}>
                        <span className={`text-xs tabular-nums ${colorClass}`}>
                            {displayValue}
                        </span>
                    </Tooltip>
                ) : (
                    <span className={`text-xs ${colorClass}`}>
                        {displayValue}
                    </span>
                )}
            </td>
        );
    };

    return (
        <TimeSeriesTable
            headerLabel={
                <span>Metric</span>
            }
            headerFixedContent={
                <>
                    <th className="px-2 py-2 text-center min-w-[60px] border-l border-gray-100 dark:border-gray-800 bg-blue-50/70 dark:bg-blue-900/20">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Goal</span>
                    </th>
                    <th className="px-2 py-2 text-center min-w-[80px] border-l border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/40">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Workload</span>
                            <div className="flex gap-0.5">
                                {(['sets', 'volume'] as VolumeDisplayMode[]).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setVolumeDisplayMode(mode)}
                                        className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${volumeDisplayMode === mode
                                            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {mode === 'sets' ? 'Sets' : 'Vol'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </th>
                    <th className="px-2 py-2 text-center min-w-[60px] border-l border-gray-100 dark:border-gray-800 bg-indigo-50 dark:bg-indigo-900/20">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Avg</span>
                    </th>
                    <th className="px-2 py-2 text-center min-w-[70px] border-l border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Trend</span>
                    </th>
                    <th className="px-2 py-2 text-center min-w-[120px] border-l border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Next</span>
                    </th>
                </>
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
                fixedCellsCount={5}
                fixedContent={
                    <>
                        <td className="bg-gray-50 dark:bg-gray-900/50 border-l border-gray-100 dark:border-gray-800/50" />
                        <td className="px-2 py-1 bg-gray-50 dark:bg-gray-900/50 border-l border-gray-100 dark:border-gray-800/50 text-center">
                            <div className="flex justify-center gap-0.5">
                                {(['WTD', 'MTD', 'QTD', 'YTD', 'PY'] as VolumePeriod[]).map(period => {
                                    // Generate tooltip content - WTD uses dynamic date
                                    let tooltipContent = '';
                                    if (period === 'WTD') {
                                        const now = new Date();
                                        const day = now.getDay();
                                        const monday = new Date(now);
                                        monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
                                        const dayName = monday.toLocaleDateString('en-US', { weekday: 'short' });
                                        const monthDay = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                        tooltipContent = `Week to Date (${dayName}. ${monthDay} – Today)`;
                                    } else {
                                        tooltipContent = {
                                            'MTD': 'Month to Date (1st – Today)',
                                            'QTD': 'Quarter to Date (Q start – Today)',
                                            'YTD': 'Year to Date (Jan 1 – Today)',
                                            'PY': 'Previous Year (Full year)'
                                        }[period] || period;
                                    }

                                    return (
                                        <button
                                            key={period}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVolumePeriod(period);
                                                // Also sync trendPeriod for periods that are valid for both
                                                if (period !== 'PY') {
                                                    setTrendPeriod(period);
                                                }
                                            }}
                                            className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${volumePeriod === period
                                                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium'
                                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <Tooltip content={tooltipContent}>
                                                {period}
                                            </Tooltip>
                                        </button>
                                    );
                                })}
                            </div>
                        </td>
                        <td className="bg-gray-50 dark:bg-gray-900/50 border-l border-gray-100 dark:border-gray-800/50" />
                        <td className="bg-gray-50 dark:bg-gray-900/50 border-l border-gray-100 dark:border-gray-800/50" />
                        <td className="bg-gray-50 dark:bg-gray-900/50 border-l border-gray-100 dark:border-gray-800/50" />
                    </>
                }

            />

            {/* Streaks row - shows consecutive days of activity */}
            <TimeSeriesRow
                label="Streaks"
                fixedContent={
                    <>
                        {renderGoalCell('streak_goal', 'Target Streak', (() => {
                            // Find current active streak (streak today)
                            const todayKey = toDateKey(new Date().toISOString());
                            const todayStreak = streakData.streakByDate.get(todayKey) || 0;
                            // If no workout today, check yesterday
                            // actually, if we want "current active streak", usually means "streak continuing into today or finished yesterday"
                            // But usually streak counts up. If I did workout yesterday (3) and today nothing yet, my "current" streak is theoretically 3 pending today.
                            // But for simple visualization, let's just show the streak of the most recent workout day if it was yesterday or today.

                            // Let's just show the streak value for TODAY (0 or N).
                            // Or better: the current "alive" streak.
                            // If today has activity ? todayStreak : (yesterday has activity ? yesterdayStreak : 0)

                            // Check yesterday in local time
                            const now = new Date();
                            const yesterday = new Date(now);
                            yesterday.setDate(yesterday.getDate() - 1);
                            const yesterdayKey = toDateKey(yesterday.toISOString());

                            const yesterdayStreak = streakData.streakByDate.get(yesterdayKey) || 0;

                            const currentAliveStreak = todayStreak > 0 ? todayStreak : yesterdayStreak;
                            return currentAliveStreak;
                        })(), 'number', 'days')}

                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                            <Tooltip content="Current Active Streak">
                                <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                                    {(() => {
                                        const todayKey = toDateKey(new Date().toISOString());
                                        const todayStreak = streakData.streakByDate.get(todayKey) || 0;

                                        // Calculate "Yesterday" correctly in local time
                                        const now = new Date();
                                        const yesterday = new Date(now);
                                        yesterday.setDate(yesterday.getDate() - 1);
                                        const yesterdayKey = toDateKey(yesterday.toISOString());

                                        const yesterdayStreak = streakData.streakByDate.get(yesterdayKey) || 0;

                                        // If we have a streak today, use it. If not, but we had one yesterday, use that.
                                        // Otherwise 0.
                                        return todayStreak > 0 ? todayStreak : yesterdayStreak;
                                    })()}
                                </span>
                            </Tooltip>
                        </td>
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                        </td>
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                            {(() => {
                                const diff = streakData.maxStreakDiff;
                                const { text, color } = formatTrendValue(diff, false);

                                return (
                                    <div
                                        onMouseEnter={() => {
                                            const sentiment = color.includes('emerald') ? 'good' : color.includes('red') ? 'bad' : 'neutral';
                                            setHighlightedRanges({ ...trendData.ranges, metricKey: 'streaks', sentiment });
                                        }}
                                        onMouseLeave={() => setHighlightedRanges(null)}
                                    >
                                        <Tooltip content={
                                            <div className="flex flex-col gap-1 text-xs">
                                                <div className="font-bold border-b border-gray-600 pb-1 mb-0.5">Max Streak Trend</div>
                                                <div className="flex justify-between gap-4">
                                                    <span>Previous period:</span>
                                                    <span className="font-mono">{streakData.previousMaxStreak}</span>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <span>Current period:</span>
                                                    <span className="font-mono">{streakData.currentMaxStreak}</span>
                                                </div>
                                                <div className="flex justify-between gap-4 border-t border-gray-600 pt-1 mt-0.5">
                                                    <span>Difference:</span>
                                                    <span className={`font-mono ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : ''}`}>
                                                        {diff > 0 ? '+' : ''}{diff}
                                                    </span>
                                                </div>
                                            </div>
                                        }>
                                            <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>
                                                {text}
                                            </span>
                                        </Tooltip>
                                    </div>
                                );
                            })()}
                        </td>
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                        </td>
                    </>
                }
                columns={displayDates} // Use same columns as main table
                renderCell={(date) => {
                    const streak = streakData.streakByDate.get(date) || 0;

                    if (streak === 0) {
                        return (
                            <td key={date} className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                            </td>
                        );
                    }

                    // Highlight high streaks?
                    const isHigh = streak >= 3;

                    const cellContent = (
                        <span className={`text-xs tabular-nums ${isHigh ? 'font-bold text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {streak}
                        </span>
                    );

                    return (
                        <td key={date} className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-orange-50/30 dark:bg-orange-900/10">
                            {isHigh ? (
                                <Tooltip content="High Streak (3+ days)">
                                    <div className="cursor-help">{cellContent}</div>
                                </Tooltip>
                            ) : (
                                cellContent
                            )}
                        </td>
                    );
                }}
            />



            {/* Workouts row - always visible, shows count per date */}
            <TimeSeriesRow
                label="Workouts"
                fixedContent={
                    <>
                        {renderGoalCell('workouts_count', 'Target Workouts', workoutCounts.totalWorkouts, 'number', 'workouts')}
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                {volumeDisplayMode === 'sets'
                                    ? liftingVolume.totalSets
                                    : formatVolume(liftingVolume.totalVolumeLbs)}
                            </span>
                        </td>
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                {(() => {
                                    if (workoutType === 'all') {
                                        // Avg workouts per week
                                        // Time period in weeks
                                        const days = (volumeEndDate.getTime() - volumeStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
                                        const weeks = Math.max(1, days / 7);
                                        const avg = workoutCounts.totalWorkouts / weeks;
                                        return `${avg.toFixed(1)}/wk`;
                                    }
                                    // Or just — if it's cleaner
                                    return '—';
                                })()}
                            </span>
                        </td>
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                            {(() => {
                                const diff = trendData.workoutCountDiff;
                                const { text, color } = formatTrendValue(diff, false);
                                const currentVal = trendData.workouts.currentCount;
                                const prevVal = trendData.workouts.previousCount;

                                return (
                                    <div
                                        onMouseEnter={() => {
                                            const sentiment = color.includes('emerald') ? 'good' : color.includes('red') ? 'bad' : 'neutral';
                                            setHighlightedRanges({ ...trendData.ranges, metricKey: 'workouts', sentiment });
                                        }}
                                        onMouseLeave={() => setHighlightedRanges(null)}
                                    >
                                        <Tooltip content={
                                            <div className="text-left text-xs">
                                                <div className="font-medium mb-1">Change: <span className={color}>{text} workouts</span></div>
                                                <div className="text-gray-400 mb-2">vs {periodLabels[trendPeriod]}</div>
                                                <div className="pt-2 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
                                                    <span className={`${color.includes('emerald') ? 'text-emerald-500 dark:text-emerald-500' : color.includes('red') ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'} font-bold`}>Current:</span>
                                                    <span className="text-right font-medium">{currentVal}</span>
                                                    <span className={`${color.includes('emerald') ? 'text-emerald-300 dark:text-emerald-300' : color.includes('red') ? 'text-red-300 dark:text-red-300' : 'text-gray-300 dark:text-gray-300'} font-medium`}>Previous:</span>
                                                    <span className="text-right font-medium">{prevVal}</span>
                                                </div>
                                            </div>
                                        }>
                                            <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                        </Tooltip>
                                    </div>
                                );
                            })()}
                        </td>
                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                        </td>
                    </>
                }
                stickyColumnWidth={stickyWidth}
            >
                {displayDates.map(date => {
                    const count = getWorkoutCountForDate(date);
                    const d = new Date(date);
                    const isRowHighlighted = highlightedRanges?.metricKey === 'workouts';
                    const isCurrent = isRowHighlighted && highlightedRanges && d >= highlightedRanges.current.start && d <= highlightedRanges.current.end;
                    const isPrevious = isRowHighlighted && highlightedRanges && d >= highlightedRanges.previous.start && d <= highlightedRanges.previous.end;

                    let bgClass = '';
                    if (isCurrent) {
                        if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-100/50 dark:bg-emerald-900/30';
                        else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-100/50 dark:bg-red-900/30';
                        else bgClass = 'bg-gray-100/50 dark:bg-gray-800/30';
                    } else if (isPrevious) {
                        if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-50/50 dark:bg-emerald-900/10';
                        else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-50/50 dark:bg-red-900/10';
                        else bgClass = 'bg-gray-50/50 dark:bg-gray-900/10';
                    }

                    return (
                        <td key={date} className={`px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 ${bgClass}`}>
                            <span className={`text-xs tabular-nums ${count === 0 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-900 dark:text-gray-100'}`}>
                                {count}
                            </span>
                        </td>
                    );
                })}
            </TimeSeriesRow>

            {/* Lifting Section */}
            {
                workoutType !== 'run' && liftingWorkouts.length > 0 && (
                    <>
                        <SectionHeaderRow
                            label="Lifting"
                            color="purple"
                            columnCount={colCount}
                            fixedCellsCount={5}
                        />
                        {/* Sets */}
                        <TimeSeriesRow
                            label="Sets"
                            fixedContent={
                                <>
                                    {renderGoalCell('lift_sets', 'Target Sets', liftingVolume.totalSets, 'number', 'sets', totalSetsGoal)}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {volumeDisplayMode === 'sets'
                                                ? liftingVolume.totalSets
                                                : formatVolume(liftingVolume.totalVolumeLbs)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                            {(() => {
                                                const workoutCount = workoutCounts.liftingDatesInRange.size;
                                                if (workoutCount === 0) return '—';

                                                if (volumeDisplayMode === 'sets') {
                                                    return (liftingVolume.totalSets / workoutCount).toFixed(1);
                                                } else {
                                                    return formatVolume(liftingVolume.totalVolumeLbs / workoutCount);
                                                }
                                            })()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const diff = volumeDisplayMode === 'sets' ? trendData.setsDiff : trendData.volumeDiff;
                                            const { text, color } = formatTrendValue(diff, volumeDisplayMode === 'volume');
                                            const currentVal = volumeDisplayMode === 'sets' ? trendData.lifting.current.totalSets : trendData.lifting.current.totalVolumeLbs;
                                            const prevVal = volumeDisplayMode === 'sets' ? trendData.lifting.previous.totalSets : trendData.lifting.previous.totalVolumeLbs;
                                            const formatFn = (v: number) => volumeDisplayMode === 'volume' ? formatVolume(v) : v;



                                            return (
                                                <div
                                                    onMouseEnter={() => {
                                                        const sentiment = color.includes('emerald') ? 'good' : color.includes('red') ? 'bad' : 'neutral';
                                                        setHighlightedRanges({ ...trendData.ranges, metricKey: 'lift_total', sentiment });
                                                    }}
                                                    onMouseLeave={() => setHighlightedRanges(null)}
                                                >
                                                    <Tooltip content={
                                                        <div className="text-left text-xs">
                                                            <div className="font-medium mb-1">Change: <span className={color}>{text} sets</span></div>
                                                            <div className="text-gray-400 mb-2">vs {periodLabels[trendPeriod]}</div>
                                                            <div className="pt-2 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
                                                                <span className={`${color.includes('emerald') ? 'text-emerald-500 dark:text-emerald-500' : color.includes('red') ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'} font-bold`}>Current:</span>
                                                                <span className="text-right font-medium">{formatFn(currentVal)}</span>
                                                                <span className={`${color.includes('emerald') ? 'text-emerald-300 dark:text-emerald-300' : color.includes('red') ? 'text-red-300 dark:text-red-300' : 'text-gray-300 dark:text-gray-300'} font-medium`}>Previous:</span>
                                                                <span className="text-right font-medium">{formatFn(prevVal)}</span>
                                                            </div>
                                                        </div>
                                                    }>
                                                        <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                                    </Tooltip>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const workout = liftingByDate.get(date);
                                const d = new Date(date);
                                const isRowHighlighted = highlightedRanges?.metricKey === 'lift_total';
                                const isCurrent = isRowHighlighted && highlightedRanges && d >= highlightedRanges.current.start && d <= highlightedRanges.current.end;
                                const isPrevious = isRowHighlighted && highlightedRanges && d >= highlightedRanges.previous.start && d <= highlightedRanges.previous.end;

                                let bgClass = '';
                                if (isCurrent) {
                                    if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-100/50 dark:bg-emerald-900/30';
                                    else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-100/50 dark:bg-red-900/30';
                                    else bgClass = 'bg-gray-100/50 dark:bg-gray-800/30';
                                } else if (isPrevious) {
                                    if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-50/50 dark:bg-emerald-900/10';
                                    else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-50/50 dark:bg-red-900/10';
                                    else bgClass = 'bg-gray-50/50 dark:bg-gray-900/10';
                                }

                                return (
                                    <td key={date} className={`px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 ${bgClass}`}>
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
                                <>
                                    {renderGoalCell('lift_duration', 'Target Duration', liftingVolume.totalDuration, 'duration')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {formatDuration(liftingVolume.totalDuration)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                            {(() => {
                                                const workoutCount = workoutCounts.liftingDatesInRange.size;
                                                if (workoutCount === 0) return '—';
                                                return formatDuration(liftingVolume.totalDuration / workoutCount);
                                            })()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const diff = trendData.durationDiff;
                                            const { text, color } = formatTrendValue(diff, false);
                                            // Override text format for duration
                                            const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
                                            const formattedText = Math.abs(diff) < 30 ? '—' : `${sign}${formatDuration(Math.abs(diff))}`;
                                            const colorClass = Math.abs(diff) < 30 ? 'text-gray-300 dark:text-gray-700' : diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

                                            return (
                                                <div
                                                    onMouseEnter={() => {
                                                        const sentiment = colorClass.includes('emerald') ? 'good' : colorClass.includes('red') ? 'bad' : 'neutral';
                                                        setHighlightedRanges({ ...trendData.ranges, metricKey: 'lift_duration', sentiment });
                                                    }}
                                                    onMouseLeave={() => setHighlightedRanges(null)}
                                                >
                                                    <Tooltip content={
                                                        <div className="text-left text-xs">
                                                            <div className="font-medium mb-1">Change: <span className={colorClass}>{sign}{formatDuration(diff)}</span></div>
                                                            <div className="text-gray-400 mb-2">vs {periodLabels[trendPeriod]}</div>
                                                            <div className="pt-2 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
                                                                <span className={`${colorClass.includes('emerald') ? 'text-emerald-500 dark:text-emerald-500' : colorClass.includes('red') ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'} font-bold`}>Current:</span>
                                                                <span className="text-right font-medium">{formatDuration(trendData.lifting.current.totalDuration)}</span>
                                                                <span className={`${colorClass.includes('emerald') ? 'text-emerald-300 dark:text-emerald-300' : colorClass.includes('red') ? 'text-red-300 dark:text-red-300' : 'text-gray-300 dark:text-gray-300'} font-medium`}>Previous:</span>
                                                                <span className="text-right font-medium">{formatDuration(trendData.lifting.previous.totalDuration)}</span>
                                                            </div>
                                                        </div>
                                                    }>
                                                        <span className={`text-xs tabular-nums font-medium cursor-help ${colorClass}`}>{formattedText}</span>
                                                    </Tooltip>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
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
                                <>
                                    {renderGoalCell('lift_reps', 'Target Reps', liftingVolume.totalReps, 'number', 'reps')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {liftingVolume.totalReps.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                            {(() => {
                                                const workoutCount = workoutCounts.liftingDatesInRange.size;
                                                if (workoutCount === 0) return '—';
                                                return Math.round(liftingVolume.totalReps / workoutCount).toLocaleString();
                                            })()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const diff = trendData.repsDiff;
                                            const { text, color } = formatTrendValue(diff, false);

                                            return (
                                                <div
                                                    onMouseEnter={() => {
                                                        const sentiment = color.includes('emerald') ? 'good' : color.includes('red') ? 'bad' : 'neutral';
                                                        setHighlightedRanges({ ...trendData.ranges, metricKey: 'lift_reps', sentiment });
                                                    }}
                                                    onMouseLeave={() => setHighlightedRanges(null)}
                                                >
                                                    <Tooltip content={
                                                        <div className="text-left text-xs">
                                                            <div className="font-medium mb-1">Change: <span className={color}>{text} reps</span></div>
                                                            <div className="text-gray-400 mb-2">vs {periodLabels[trendPeriod]}</div>
                                                            <div className="pt-2 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
                                                                <span className={`${color.includes('emerald') ? 'text-emerald-500 dark:text-emerald-500' : color.includes('red') ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'} font-bold`}>Current:</span>
                                                                <span className="text-right font-medium">{trendData.lifting.current.totalReps.toLocaleString()}</span>
                                                                <span className={`${color.includes('emerald') ? 'text-emerald-300 dark:text-emerald-300' : color.includes('red') ? 'text-red-300 dark:text-red-300' : 'text-gray-300 dark:text-gray-300'} font-medium`}>Previous:</span>
                                                                <span className="text-right font-medium">{trendData.lifting.previous.totalReps.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    }>
                                                        <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                                    </Tooltip>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
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
                        {activeBodyParts.map(part => {
                            const volumeValue = volumeDisplayMode === 'sets'
                                ? liftingVolume.bodyPartSets[part]
                                : liftingVolume.bodyPartVolume[part];
                            const trendDiff = volumeDisplayMode === 'sets'
                                ? trendData.bodyPartSetsDiff[part] || 0
                                : trendData.bodyPartVolumeDiff[part] || 0;
                            const { text: trendText, color: trendColor } = formatTrendValue(trendDiff, volumeDisplayMode === 'volume');
                            const exercises = exercisesByBodyPart[part] || [];
                            const isExpanded = expandedBodyParts.has(part);
                            const hasExercises = exercises.length > 0;

                            return (
                                <React.Fragment key={part}>
                                    <TimeSeriesRow
                                        label={
                                            <span
                                                className={`capitalize inline-flex items-center gap-1 ${hasExercises ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                                                onClick={() => hasExercises && toggleBodyPart(part)}
                                            >
                                                {hasExercises && (
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 w-3 inline-block transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                        ▶
                                                    </span>
                                                )}
                                                {part}
                                            </span>
                                        }
                                        fixedContent={
                                            <>
                                                {renderGoalCell(`lift_sets_${part}`, `${part.charAt(0).toUpperCase() + part.slice(1)} Sets`, volumeValue, 'number', 'sets')}
                                                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                                    <span className={`text-xs tabular-nums ${volumeValue ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700'}`}>
                                                        {volumeValue
                                                            ? (volumeDisplayMode === 'volume' ? formatVolume(volumeValue) : volumeValue)
                                                            : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                                    <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                                        {(() => {
                                                            // Calculate days where this body part was trained
                                                            const workoutsWithPart = liftingWorkouts.filter(w => {
                                                                const date = new Date(w.workoutDate);
                                                                return date >= volumeStartDate && date <= volumeEndDate && w.bodyParts && w.bodyParts[part];
                                                            }).length;

                                                            if (workoutsWithPart === 0) return '—';

                                                            if (volumeDisplayMode === 'sets') {
                                                                return (liftingVolume.bodyPartSets[part] / workoutsWithPart).toFixed(1);
                                                            } else {
                                                                return formatVolume(liftingVolume.bodyPartVolume[part] / workoutsWithPart);
                                                            }
                                                        })()}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                                    <div
                                                        onMouseEnter={() => {
                                                            const sentiment = trendColor.includes('emerald') ? 'good' : trendColor.includes('red') ? 'bad' : 'neutral';
                                                            setHighlightedRanges({ ...trendData.ranges, metricKey: part, sentiment });
                                                        }}
                                                        onMouseLeave={() => setHighlightedRanges(null)}
                                                    >
                                                        <Tooltip content={
                                                            <div className="text-left text-xs">
                                                                <div className="font-medium mb-1">Change: <span className={trendColor}>{trendText} {volumeDisplayMode === 'volume' ? 'lbs' : 'sets'}</span></div>
                                                                <div className="text-gray-400 mb-2">vs {periodLabels[trendPeriod]}</div>
                                                                <div className="pt-2 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
                                                                    <span className={`${trendColor.includes('emerald') ? 'text-emerald-500 dark:text-emerald-500' : trendColor.includes('red') ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'} font-bold`}>Current:</span>
                                                                    <span className="text-right font-medium">{volumeDisplayMode === 'volume' ? formatVolume(volumeValue) : volumeValue}</span>
                                                                    <span className={`${trendColor.includes('emerald') ? 'text-emerald-300 dark:text-emerald-300' : trendColor.includes('red') ? 'text-red-300 dark:text-red-300' : 'text-gray-300 dark:text-gray-300'} font-medium`}>Previous:</span>
                                                                    <span className="text-right font-medium">
                                                                        {volumeDisplayMode === 'volume'
                                                                            ? formatVolume((trendData.lifting.previous.bodyPartVolume[part] || 0))
                                                                            : (trendData.lifting.previous.bodyPartSets[part] || 0)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        }>
                                                            <span className={`text-xs tabular-nums font-medium cursor-help ${trendColor}`}>
                                                                {trendText}
                                                            </span>
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                                    <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                </td>
                                            </>
                                        }
                                        stickyColumnWidth={stickyWidth}
                                    >
                                        {displayDates.map(date => {
                                            const workout = liftingByDate.get(date);
                                            const stats = workout?.bodyParts?.[part];
                                            const displayValue = volumeDisplayMode === 'sets'
                                                ? stats?.sets
                                                : stats?.volumeLbs;

                                            const d = new Date(date);
                                            const isRowHighlighted = highlightedRanges?.metricKey === part;
                                            const isCurrent = isRowHighlighted && highlightedRanges && d >= highlightedRanges.current.start && d <= highlightedRanges.current.end;
                                            const isPrevious = isRowHighlighted && highlightedRanges && d >= highlightedRanges.previous.start && d <= highlightedRanges.previous.end;

                                            let bgClass = '';
                                            if (isCurrent) {
                                                if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-100/50 dark:bg-emerald-900/30';
                                                else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-100/50 dark:bg-red-900/30';
                                                else bgClass = 'bg-gray-100/50 dark:bg-gray-800/30';
                                            } else if (isPrevious) {
                                                if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-50/50 dark:bg-emerald-900/10';
                                                else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-50/50 dark:bg-red-900/10';
                                                else bgClass = 'bg-gray-50/50 dark:bg-gray-900/10';
                                            }

                                            return (
                                                <td key={date} className={`px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 ${bgClass}`}>
                                                    {displayValue ? (
                                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                            {volumeDisplayMode === 'volume' ? formatVolume(displayValue) : displayValue}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </TimeSeriesRow>
                                    {/* Exercise sub-rows (expanded view) */}
                                    {isExpanded && exercises.map(exercise => {
                                        const exerciseKey = `${part}:${exercise.name}`;

                                        return (
                                            <TimeSeriesRow
                                                key={exerciseKey}
                                                label={
                                                    <span className="pl-5 text-[11px] text-gray-600 dark:text-gray-400">
                                                        {exercise.name}
                                                    </span>
                                                }
                                                fixedContent={
                                                    <>
                                                        <td className="px-2 py-1 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/20 dark:bg-blue-900/10">
                                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/20 dark:bg-blue-900/5">
                                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/20 dark:bg-gray-800/10">
                                                            <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                                                {(() => {
                                                                    // For exercises, maybe show max weight?
                                                                    // Let's calculate average weight across all occurrences
                                                                    let totalWeight = 0;
                                                                    let count = 0;
                                                                    displayDates.forEach(date => {
                                                                        const occ = exercise.occurrences.get(date);
                                                                        if (occ && occ.weightLbs) {
                                                                            totalWeight += occ.weightLbs;
                                                                            count++;
                                                                        }
                                                                    });
                                                                    if (count === 0) return '—';
                                                                    return `${Math.round(totalWeight / count)} lbs`;
                                                                })()}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/20 dark:bg-gray-800/10">
                                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                        </td>
                                                        <td className="px-2 py-1 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                        </td>
                                                    </>
                                                }
                                                stickyColumnWidth={stickyWidth}
                                            >
                                                {displayDates.map(date => {
                                                    const occurrence = exercise.occurrences.get(date);
                                                    if (!occurrence) {
                                                        return (
                                                            <td key={date} className="px-3 py-1 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10">
                                                                <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                                            </td>
                                                        );
                                                    }

                                                    // Calculate volume for this exercise on this date
                                                    const exerciseVolume = occurrence.sets * occurrence.reps * (occurrence.weightLbs || 0);
                                                    const displayVal = volumeDisplayMode === 'sets'
                                                        ? occurrence.sets
                                                        : exerciseVolume;

                                                    return (
                                                        <td key={date} className="px-3 py-1 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/10">
                                                            <Tooltip content={
                                                                <div className="text-xs text-left">
                                                                    <div className="font-medium mb-1">{exercise.name}</div>
                                                                    <div>
                                                                        {occurrence.sets} sets × {
                                                                            occurrence.sets > 0 && occurrence.reps % occurrence.sets === 0
                                                                                ? occurrence.reps / occurrence.sets
                                                                                : occurrence.reps
                                                                        } {
                                                                            occurrence.sets > 0 && occurrence.reps % occurrence.sets === 0
                                                                                ? 'reps'
                                                                                : 'total reps'
                                                                        }
                                                                    </div>
                                                                    {occurrence.weightLbs && <div>@ {occurrence.weightLbs} lbs</div>}
                                                                    {exerciseVolume > 0 && <div className="text-gray-400 mt-1">Volume: {formatVolume(exerciseVolume)}</div>}
                                                                </div>
                                                            }>
                                                                <span className="text-[11px] tabular-nums text-gray-700 dark:text-gray-300 cursor-help">
                                                                    {volumeDisplayMode === 'volume' && exerciseVolume > 0
                                                                        ? formatVolume(displayVal)
                                                                        : occurrence.sets}
                                                                </span>
                                                            </Tooltip>
                                                            {(() => {
                                                                const m = liftingMilestones.get(exercise.name);
                                                                if (!m) return null;

                                                                const dateKey = date; // date is already YYYY-MM-DD from displayDates
                                                                const records: string[] = [];

                                                                if (m.heaviestWeight && toDateKey(m.heaviestWeight.date) === dateKey) records.push(`Heaviest: ${m.heaviestWeight.value} lbs`);
                                                                if (m.bestSetVolume && toDateKey(m.bestSetVolume.date) === dateKey) records.push(`Best Set Vol: ${formatVolume(m.bestSetVolume.value)} lbs`);
                                                                if (m.best1RM && toDateKey(m.best1RM.date) === dateKey) records.push(`Best 1RM: ${Math.round(m.best1RM.value)} lbs`);
                                                                if (m.bestSessionVolume && toDateKey(m.bestSessionVolume.date) === dateKey) records.push(`Best Ses Vol: ${formatVolume(m.bestSessionVolume.value)} lbs`);

                                                                if (records.length > 0) {
                                                                    return (
                                                                        <div className="ml-1 inline-flex">
                                                                            <MilestoneBadge
                                                                                type="pr"
                                                                                date={m.heaviestWeight?.date || m.bestSetVolume?.date || m.best1RM?.date as string}
                                                                                details={
                                                                                    <ul className="list-disc list-inside">
                                                                                        {records.map((r, i) => <li key={i}>{r}</li>)}
                                                                                    </ul>
                                                                                }
                                                                            />
                                                                        </div>
                                                                    )
                                                                }
                                                                return null;
                                                            })()}
                                                        </td>
                                                    );
                                                })}
                                            </TimeSeriesRow>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </>
                )
            }

            {/* Running Section */}
            {
                workoutType !== 'lifting' && runningActivities.length > 0 && (
                    <>
                        <SectionHeaderRow
                            label="Running"
                            color="orange"
                            columnCount={colCount}
                            fixedCellsCount={5}
                        />
                        {/* Miles */}
                        <TimeSeriesRow
                            label="Miles"
                            fixedContent={
                                <>
                                    {renderGoalCell('run_miles', 'Target Miles', runningVolume.totalMiles, 'number', 'mi')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {runningVolume.totalMiles.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                            {(() => {
                                                const runCount = workoutCounts.runningDatesInRange.size;
                                                if (runCount === 0) return '—';
                                                return (runningVolume.totalMiles / runCount).toFixed(1);
                                            })()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const diff = trendData.milesDiff;
                                            if (Math.abs(diff) < 0.1) return <span className="text-xs text-gray-300 dark:text-gray-700">—</span>;
                                            const sign = diff > 0 ? '+' : '';
                                            const color = diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
                                            return (
                                                <div
                                                    onMouseEnter={() => {
                                                        const sentiment = color.includes('emerald') ? 'good' : color.includes('red') ? 'bad' : 'neutral';
                                                        setHighlightedRanges({ ...trendData.ranges, metricKey: 'run_miles', sentiment });
                                                    }}
                                                    onMouseLeave={() => setHighlightedRanges(null)}
                                                >
                                                    <Tooltip content={
                                                        <div className="text-left text-xs">
                                                            <div className="font-medium mb-1">Change: <span className={color}>{sign}{diff.toFixed(1)} miles</span></div>
                                                            <div className="text-gray-400 mb-2">vs {periodLabels[trendPeriod]}</div>
                                                            <div className="pt-2 border-t border-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
                                                                <span className={`${color.includes('emerald') ? 'text-emerald-500 dark:text-emerald-500' : color.includes('red') ? 'text-red-500 dark:text-red-500' : 'text-gray-500 dark:text-gray-500'} font-bold`}>Current:</span>
                                                                <span className="text-right font-medium">{trendData.running.currentMiles.toFixed(1)}</span>
                                                                <span className={`${color.includes('emerald') ? 'text-emerald-300 dark:text-emerald-300' : color.includes('red') ? 'text-red-300 dark:text-red-300' : 'text-gray-300 dark:text-gray-300'} font-medium`}>Previous:</span>
                                                                <span className="text-right font-medium">{trendData.running.previousMiles.toFixed(1)}</span>
                                                            </div>
                                                        </div>
                                                    }>
                                                        <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{sign}{diff.toFixed(1)}</span>
                                                    </Tooltip>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                const d = new Date(date);
                                const isRowHighlighted = highlightedRanges?.metricKey === 'run_miles';
                                const isCurrent = isRowHighlighted && highlightedRanges && d >= highlightedRanges.current.start && d <= highlightedRanges.current.end;
                                const isPrevious = isRowHighlighted && highlightedRanges && d >= highlightedRanges.previous.start && d <= highlightedRanges.previous.end;

                                let bgClass = '';
                                if (isCurrent) {
                                    if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-100/50 dark:bg-emerald-900/30';
                                    else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-100/50 dark:bg-red-900/30';
                                    else bgClass = 'bg-gray-100/50 dark:bg-gray-800/30';
                                } else if (isPrevious) {
                                    if (highlightedRanges.sentiment === 'good') bgClass = 'bg-emerald-50/50 dark:bg-emerald-900/10';
                                    else if (highlightedRanges.sentiment === 'bad') bgClass = 'bg-red-50/50 dark:bg-red-900/10';
                                    else bgClass = 'bg-gray-50/50 dark:bg-gray-900/10';
                                }

                                return (
                                    <td key={date} className={`px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 ${bgClass}`}>
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
                                <>
                                    {renderGoalCell('run_duration', 'Target Duration', runningVolume.totalDuration, 'duration')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {formatDuration(runningVolume.totalDuration)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                            {(() => {
                                                const runCount = workoutCounts.runningDatesInRange.size;
                                                if (runCount === 0) return '—';
                                                return formatDuration(runningVolume.totalDuration / runCount);
                                            })()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
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
                                <>
                                    {renderGoalCell('run_pace', 'Target Pace', runningVolume.averagePace, 'pace', '/mi')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {formatPace(runningVolume.averagePace)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {activity?.averagePaceSeconds ? (
                                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                {formatPace(activity.averagePaceSeconds)}<span className="text-gray-400">/mi</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </TimeSeriesRow>
                        {/* Avg Heart Rate */}
                        <TimeSeriesRow
                            label="Avg HR"
                            fixedContent={
                                <>
                                    {renderGoalCell('run_avg_hr', 'Target Avg HR', runningVolume.weightedAvgHr, 'number', 'bpm')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {runningVolume.weightedAvgHr > 0 ? `${Math.round(runningVolume.weightedAvgHr)}` : '—'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const current = trendData.running.currentAvgHr;
                                            const previous = trendData.running.previousAvgHr;
                                            if (!current || !previous) return <span className="text-xs text-gray-300 dark:text-gray-700">—</span>;

                                            const diff = current - previous;
                                            const { text, color } = formatTrendValue(diff, false);

                                            return (
                                                <Tooltip content={
                                                    <div className="text-left text-xs">
                                                        <div className="font-medium mb-1">Change: <span className={color}>{diff > 0 ? '+' : ''}{diff} bpm</span></div>
                                                        <div className="text-gray-400">Current: {current} bpm</div>
                                                        <div className="text-gray-400">Previous: {previous} bpm</div>
                                                    </div>
                                                }>
                                                    <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                                </Tooltip>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {activity?.averageHeartrate ? (
                                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                {activity.averageHeartrate} <span className="text-gray-400">bpm</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </TimeSeriesRow>
                        {/* Max Heart Rate */}
                        <TimeSeriesRow
                            label="Max HR"
                            fixedContent={
                                <>
                                    {renderGoalCell('run_max_hr', 'Target Max HR', runningVolume.maxHr, 'number', 'bpm')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {runningVolume.maxHr > 0 ? runningVolume.maxHr : '—'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const current = trendData.running.currentMaxHr;
                                            const previous = trendData.running.previousMaxHr;
                                            if (!current || !previous) return <span className="text-xs text-gray-300 dark:text-gray-700">—</span>;

                                            const diff = current - previous;
                                            const { text, color } = formatTrendValue(diff, false);

                                            return (
                                                <Tooltip content={
                                                    <div className="text-left text-xs">
                                                        <div className="font-medium mb-1">Change: <span className={color}>{diff > 0 ? '+' : ''}{diff} bpm</span></div>
                                                        <div className="text-gray-400">Current: {current} bpm</div>
                                                        <div className="text-gray-400">Previous: {previous} bpm</div>
                                                    </div>
                                                }>
                                                    <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                                </Tooltip>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {activity?.maxHeartrate ? (
                                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                {activity.maxHeartrate} <span className="text-gray-400">bpm</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </TimeSeriesRow>
                        {/* Cadence */}
                        <TimeSeriesRow
                            label="Cadence"
                            fixedContent={
                                <>
                                    {renderGoalCell('run_cadence', 'Target Cadence', runningVolume.weightedAvgCadence, 'number', 'spm')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {runningVolume.weightedAvgCadence > 0 ? Math.round(runningVolume.weightedAvgCadence) : '—'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const current = trendData.running.currentAvgCadence;
                                            const previous = trendData.running.previousAvgCadence;
                                            if (!current || !previous) return <span className="text-xs text-gray-300 dark:text-gray-700">—</span>;

                                            const diff = current - previous;
                                            const { text, color } = formatTrendValue(diff, false);

                                            return (
                                                <Tooltip content={
                                                    <div className="text-left text-xs">
                                                        <div className="font-medium mb-1">Change: <span className={color}>{diff > 0 ? '+' : ''}{diff} spm</span></div>
                                                        <div className="text-gray-400">Current: {current} spm</div>
                                                        <div className="text-gray-400">Previous: {previous} spm</div>
                                                    </div>
                                                }>
                                                    <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                                </Tooltip>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {activity?.averageCadence ? (
                                            <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                {activity.averageCadence} <span className="text-gray-400">spm</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </TimeSeriesRow>
                        {/* Elevation */}
                        <TimeSeriesRow
                            label="Elevation"
                            fixedContent={
                                <>
                                    {renderGoalCell('run_elevation', 'Target Elevation', runningVolume.totalElevationGain, 'number', 'ft')}
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                        <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                            {runningVolume.totalElevationGain > 0 ? formatVolume(runningVolume.totalElevationGain) : '—'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                                            {(() => {
                                                const runCount = workoutCounts.runningDatesInRange.size;
                                                if (runCount === 0 || runningVolume.totalElevationGain === 0) return '—';
                                                return formatVolume(runningVolume.totalElevationGain / runCount);
                                            })()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                        {(() => {
                                            const current = trendData.running.currentElevationGain;
                                            const previous = trendData.running.previousElevationGain;
                                            if (current === 0 && previous === 0) return <span className="text-xs text-gray-300 dark:text-gray-700">—</span>;

                                            const diff = current - previous;
                                            const { text, color } = formatTrendValue(diff, false);

                                            return (
                                                <Tooltip content={
                                                    <div className="text-left text-xs">
                                                        <div className="font-medium mb-1">Change: <span className={color}>{diff > 0 ? '+' : ''}{formatVolume(diff)} ft</span></div>
                                                        <div className="text-gray-400">Current: {formatVolume(current)} ft</div>
                                                        <div className="text-gray-400">Previous: {formatVolume(previous)} ft</div>
                                                    </div>
                                                }>
                                                    <span className={`text-xs tabular-nums font-medium cursor-help ${color}`}>{text}</span>
                                                </Tooltip>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                        <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                    </td>
                                </>
                            }
                            stickyColumnWidth={stickyWidth}
                        >
                            {displayDates.map(date => {
                                const activity = runningByDate.get(date);
                                const hasElevation = activity?.elevationGainFeet != null;
                                const hasElevDetails = activity?.elevHighFeet != null || activity?.elevLowFeet != null;

                                if (!hasElevation) {
                                    return (
                                        <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        </td>
                                    );
                                }

                                const elevContent = (
                                    <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                        +{activity.elevationGainFeet} <span className="text-gray-400">ft</span>
                                    </span>
                                );

                                return (
                                    <td key={date} className="px-3 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50">
                                        {hasElevDetails ? (
                                            <Tooltip content={
                                                <div className="text-xs tabular-nums grid grid-cols-[auto_1fr_auto] gap-x-1">
                                                    <span className="font-bold">High:</span>
                                                    <span className="text-right">{activity.elevHighFeet?.toLocaleString()}</span>
                                                    <span>ft</span>
                                                    <span className="font-bold">Low:</span>
                                                    <span className="text-right">{activity.elevLowFeet?.toLocaleString()}</span>
                                                    <span>ft</span>
                                                </div>
                                            }>
                                                <span className="cursor-help">{elevContent}</span>
                                            </Tooltip>
                                        ) : elevContent}
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
                                    <>
                                        {renderGoalCell(`run_time_${milestone.key}`, `${milestone.label} Time`, undefined, 'duration')}
                                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                                            <span className="text-xs tabular-nums text-gray-300 dark:text-gray-700">—</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center border-l border-gray-100 dark:border-gray-800/50 bg-green-50/30 dark:bg-green-900/10">
                                            <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                        </td>
                                    </>
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
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-xs tabular-nums text-gray-900 dark:text-gray-100">
                                                        {formatDuration(Math.round(time))}
                                                    </span>
                                                    {(() => {
                                                        const performances = runningMilestones.get(milestone.key);
                                                        const perf = performances?.find(p => toDateKey(p.date) === date);
                                                        if (perf) {
                                                            return (
                                                                <MilestoneBadge
                                                                    type={perf.rank === 1 ? '1st' : perf.rank === 2 ? '2nd' : '3rd'}
                                                                    date={perf.date}
                                                                    details={`${perf.rank === 1 ? '1st' : perf.rank === 2 ? '2nd' : '3rd'} Fastest ${milestone.label}`}
                                                                />
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </TimeSeriesRow>
                        ))}
                    </>
                )
            }

            {
                editingGoal && (
                    <GoalEditor
                        metricKey={editingGoal.metricKey}
                        metricLabel={editingGoal.label}
                        inputType={editingGoal.type}
                        currentValue={goalsMap.get(editingGoal.metricKey) || null}
                        onSave={onSaveGoal}
                        onDelete={onDeleteGoal}
                        onClose={() => setEditingGoal(null)}
                    />
                )
            }
        </TimeSeriesTable >
    );
}
