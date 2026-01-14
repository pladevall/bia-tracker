import { NextRequest, NextResponse } from 'next/server';
import { calculateSleepScore } from '@/lib/sleep-scoring';
import { saveSleepEntry, getSleepPreferences } from '@/lib/supabase-sleep';
import { SleepStages } from '@/lib/types';

// Type definitions for Health Auto Export payload
interface HealthExportMetrics {
    name: string;
    units: string;
    data: {
        qty: number;
        date: string;
        source?: string;
    }[];
}

interface SleepAnalysisMetric {
    name: "sleep_analysis";
    data: {
        qty: number; // Duration in seconds? No, value represents stage usually
        date: string;
        source: string;
        value: "InBed" | "Asleep" | "Awake" | "Core" | "Deep" | "REM";
        startDate: string;
        endDate: string;
        duration: number; // seconds
    }[];
}

interface WebhookPayload {
    data: {
        metrics: (HealthExportMetrics | SleepAnalysisMetric)[];
    };
}

export async function POST(req: NextRequest) {
    try {
        const payload: WebhookPayload = await req.json();

        // Find sleep analysis data
        const sleepMetric = payload.data.metrics.find(m => m.name === 'sleep_analysis') as SleepAnalysisMetric | undefined;

        if (!sleepMetric || !sleepMetric.data || sleepMetric.data.length === 0) {
            return NextResponse.json({ message: 'No sleep data found in payload' }, { status: 200 });
        }

        // Group by date (Health Auto Export might send multiple days)
        // We'll use the startDate of the sleep session to determine the "sleep date"
        // Usually, sleep starting before noon belongs to the previous day's "sleep night"
        // But simplistic approach: group by the date string of the start time

        // Better approach: HealthKit sleep sessions are usually grouped by the app
        // Let's assume the payload contains data relevant to a specific period.
        // We need to aggregate samples into a single night's sleep.

        // 1. Identify unique sleep sessions (nights)
        // A gap of > 4 hours usually implies a different sleep session
        // For now, let's process the most recent night found in the data

        // Sort samples by date
        const samples = sleepMetric.data.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        // Helpers
        const getDurationMinutes = (sample: typeof samples[0]) => sample.duration / 60;

        // Identify the main sleep chunk
        // Valid night sleep usually ends in the morning (e.g. 5am - 11am)
        // We will target the latest sleep session in the payload

        // Let's group samples by "Sleep Date". 
        // If a sample starts at 11PM on Jan 1, it's Jan 1 sleep.
        // If it starts at 1AM on Jan 2, it's Jan 1 sleep.
        // Rule: if start hour < 12 (noon), it belongs to previous day.

        const groupedByDate: Record<string, typeof samples> = {};

        samples.forEach(sample => {
            const start = new Date(sample.startDate);
            const hour = start.getHours();
            let dateKey: string;

            if (hour < 15) { // Arbitrary cutoff: sleep ending/starting before 3PM counts as previous night
                const prevDate = new Date(start);
                prevDate.setDate(prevDate.getDate() - 1);
                dateKey = prevDate.toISOString().split('T')[0];
            } else {
                dateKey = start.toISOString().split('T')[0];
            }

            if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
            groupedByDate[dateKey].push(sample);
        });

        // Process most recent date only, or all? Let's process all found
        const results = [];
        const preferences = await getSleepPreferences();

        for (const [date, daysSamples] of Object.entries(groupedByDate)) {
            // Aggregate stages
            const stages: SleepStages = {
                awakeMinutes: 0,
                remMinutes: 0,
                coreMinutes: 0,
                deepMinutes: 0,
                inBedMinutes: 0,
                totalSleepMinutes: 0
            };

            // Values: 'InBed', 'Asleep', 'Awake', 'Core', 'Deep', 'REM'
            // Note: 'Asleep' is often used if detailed stages aren't available (like older watches)
            // 'InBed' overlaps with others usually

            let sleepStartMs = Number.MAX_SAFE_INTEGER;
            let sleepEndMs = 0;

            // Track interruptions
            // A wake segment > 5 mins or distinct wake segments
            let wakeCount = 0;
            let lastEndMs = 0;

            daysSamples.forEach(s => {
                const duration = s.duration / 60; // minutes
                const startMs = new Date(s.startDate).getTime();
                const endMs = new Date(s.endDate).getTime();

                if (startMs < sleepStartMs) sleepStartMs = startMs;
                if (endMs > sleepEndMs) sleepEndMs = endMs;

                switch (s.value) {
                    case 'Awake':
                        stages.awakeMinutes += duration;
                        wakeCount++;
                        break;
                    case 'REM':
                        stages.remMinutes += duration;
                        stages.totalSleepMinutes += duration;
                        break;
                    case 'Deep':
                        stages.deepMinutes += duration;
                        stages.totalSleepMinutes += duration;
                        break;
                    case 'Core':
                        stages.coreMinutes += duration;
                        stages.totalSleepMinutes += duration;
                        break;
                    case 'Asleep':
                        // Generic sleep if stages not detailed
                        stages.coreMinutes += duration;
                        stages.totalSleepMinutes += duration;
                        break;
                    case 'InBed':
                        stages.inBedMinutes += duration;
                        break;
                }
            });

            // If InBed not provided effectively, approximate it
            if (stages.inBedMinutes < stages.totalSleepMinutes) {
                stages.inBedMinutes = stages.totalSleepMinutes + stages.awakeMinutes;
            }

            // Calculate Scores
            const sleepStart = new Date(sleepStartMs).toISOString();
            const sleepEnd = new Date(sleepEndMs).toISOString();

            const { totalScore, durationScore, bedtimeScore, interruptionScore } = calculateSleepScore({
                totalSleepMinutes: stages.totalSleepMinutes,
                bedtime: sleepStart,
                wakeCount: wakeCount,
                awakeMinutes: stages.awakeMinutes
            }, preferences);

            // Save to DB
            const saved = await saveSleepEntry({
                sleepDate: date,
                sleepScore: totalScore,
                durationScore,
                bedtimeScore,
                interruptionScore,
                data: {
                    stages,
                    interruptions: { count: wakeCount, totalMinutes: stages.awakeMinutes },
                    sleepStart,
                    sleepEnd
                }
            });

            results.push(saved);
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json(
        { message: 'This endpoint only accepts POST requests from Health Auto Export' },
        { status: 405, headers: { 'Allow': 'POST' } }
    );
}
