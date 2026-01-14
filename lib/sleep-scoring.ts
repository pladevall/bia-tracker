import { SleepEntry, SleepStages } from './types';

interface ScoreComponent {
    score: number;
    maxScore: number;
    reason: string;
}

export function calculateDurationScore(
    actualMinutes: number,
    targetMinutes: number = 480 // 8 hours default
): number {
    const MAX_SCORE = 50;

    if (actualMinutes >= targetMinutes) return MAX_SCORE;

    // Penalize for being under target
    // Linear drop-off: 0 points if < 50% of target
    const percentage = actualMinutes / targetMinutes;
    if (percentage < 0.5) return 0;

    // Scale remaining 50% linearly
    // 0.5 -> 0 points
    // 1.0 -> 50 points
    const score = Math.round(((percentage - 0.5) * 2) * MAX_SCORE);
    return Math.max(0, Math.min(MAX_SCORE, score));
}

export function calculateBedtimeScore(
    actualBedtime: string, // ISO string or time string
    targetBedtime: string = '22:30:00',
    windowMinutes: number = 30
): number {
    const MAX_SCORE = 30;

    try {
        // Parse times to minutes from midnight
        const getMinutes = (timeStr: string) => {
            // Handle full ISO date strings by extracting time part
            const timePart = timeStr.includes('T')
                ? new Date(timeStr).toLocaleTimeString('en-US', { hour12: false })
                : timeStr;

            const [hours, minutes] = timePart.split(':').map(Number);
            // Handle late night times (e.g., 01:00) as next day for comparison if target is late
            // For simplicity, we'll normalize everything to minutes from previous day's noon
            // Noon = 720, Midnight = 1440/0
            // 10:30 PM = 1350
            // 1:00 AM = 1500 (24h + 1h)

            let totalMinutes = hours * 60 + minutes;
            if (hours < 12) totalMinutes += 24 * 60; // Treat early morning as "late night"
            return totalMinutes;
        };

        const actual = getMinutes(actualBedtime);
        const target = getMinutes(targetBedtime);
        const diff = Math.abs(actual - target);

        if (diff <= windowMinutes) return MAX_SCORE;

        // Penalize 1 point per 5 minutes outside window
        const penalty = Math.floor((diff - windowMinutes) / 5);
        return Math.max(0, MAX_SCORE - penalty);
    } catch (e) {
        console.warn('Error calculating bedtime score:', e);
        return 0;
    }
}

export function calculateInterruptionScore(
    wakeCount: number,
    awakeMinutes: number
): number {
    const MAX_SCORE = 20;

    // Base deduction on wake count
    // 0-1 wakes: 0 deduction
    // 2-3 wakes: 2 deduction
    // 4+ wakes: 5 deduction
    let countPenalty = 0;
    if (wakeCount > 3) countPenalty = 5;
    else if (wakeCount > 1) countPenalty = 2;

    // Deduct based on total awake time
    // < 15 mins: 0 deduction
    // 15-30 mins: 5 deduction
    // 30-45 mins: 10 deduction
    // 45-60 mins: 15 deduction
    // > 60 mins: 20 deduction
    let durationPenalty = 0;
    if (awakeMinutes > 60) durationPenalty = 20;
    else if (awakeMinutes > 45) durationPenalty = 15;
    else if (awakeMinutes > 30) durationPenalty = 10;
    else if (awakeMinutes > 15) durationPenalty = 5;

    return Math.max(0, MAX_SCORE - countPenalty - durationPenalty);
}

export function calculateSleepScore(
    data: {
        totalSleepMinutes: number;
        bedtime: string;
        wakeCount: number;
        awakeMinutes: number;
    },
    preferences: {
        targetDurationMinutes: number;
        targetBedtime: string;
        bedtimeWindowMinutes: number;
    } = {
            targetDurationMinutes: 480,
            targetBedtime: '22:30:00',
            bedtimeWindowMinutes: 30
        }
): {
    totalScore: number;
    durationScore: number;
    bedtimeScore: number;
    interruptionScore: number;
} {
    const durationScore = calculateDurationScore(data.totalSleepMinutes, preferences.targetDurationMinutes);
    const bedtimeScore = calculateBedtimeScore(data.bedtime, preferences.targetBedtime, preferences.bedtimeWindowMinutes);
    const interruptionScore = calculateInterruptionScore(data.wakeCount, data.awakeMinutes);

    return {
        totalScore: durationScore + bedtimeScore + interruptionScore,
        durationScore,
        bedtimeScore,
        interruptionScore
    };
}

export function getScoreLevel(score: number): { label: string; color: string } {
    if (score >= 85) return { label: 'Very High', color: 'text-emerald-500' };
    if (score >= 70) return { label: 'High', color: 'text-green-500' };
    if (score >= 50) return { label: 'OK', color: 'text-amber-500' };
    if (score >= 30) return { label: 'Low', color: 'text-orange-500' };
    return { label: 'Very Low', color: 'text-red-500' };
}
