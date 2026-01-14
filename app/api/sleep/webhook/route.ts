import { NextRequest, NextResponse } from 'next/server';
import { calculateSleepScore } from '@/lib/sleep-scoring';
import { saveSleepEntry, getSleepPreferences } from '@/lib/supabase-sleep';
import { SleepStages } from '@/lib/types';

// Type definitions for Health Auto Export payload
interface HealthExportMetrics {
    name: string;
    units: string;
    data: any[]; // Can be varying shapes
}

interface WebhookPayload {
    data: {
        metrics: HealthExportMetrics[];
    };
}

export async function POST(req: NextRequest) {
    try {
        const payload: WebhookPayload = await req.json();

        // Find sleep analysis data
        const sleepMetric = payload.data.metrics.find(m => m.name === 'sleep_analysis');

        if (!sleepMetric || !sleepMetric.data || sleepMetric.data.length === 0) {
            return NextResponse.json({ message: 'No sleep data found in payload' }, { status: 200 });
        }

        const preferences = await getSleepPreferences();
        const results = [];
        const invalidSamples: any[] = [];

        // Check format of the first sample to determine processing mode
        const firstSample = sleepMetric.data[0];
        const isAggregated = firstSample.sleepStart !== undefined && firstSample.totalSleep !== undefined;

        console.log(`Processing mode: ${isAggregated ? 'AGGREGATED' : 'RAW SEGMENTS'}`);

        if (isAggregated) {
            // --- AGGREGATED FORMAT HANDLING ---
            // Format: { date, sleepStart, sleepEnd, totalSleep (hrs), deep (hrs), rem (hrs), ... }

            for (const sample of sleepMetric.data) {
                try {
                    // Validations
                    if (!sample.date || !sample.sleepStart || !sample.sleepEnd) {
                        invalidSamples.push({ reason: 'Missing core fields', sample });
                        continue;
                    }

                    // Parse dates
                    const sleepDate = sample.date.split(' ')[0]; // "2026-01-07 00:00:00 -0800" -> "2026-01-07"
                    const sleepStart = sample.sleepStart; // Keep ISO or whatever strings they are
                    const sleepEnd = sample.sleepEnd;

                    // Parse durations (Strings in hours -> Float Minutes)
                    const hoursToMinutes = (val: any) => {
                        const v = parseFloat(val);
                        return isNaN(v) ? 0 : v * 60;
                    };

                    const totalSleepMinutes = hoursToMinutes(sample.totalSleep);
                    const stages: SleepStages = {
                        awakeMinutes: hoursToMinutes(sample.awake),
                        remMinutes: hoursToMinutes(sample.rem),
                        coreMinutes: hoursToMinutes(sample.core),
                        deepMinutes: hoursToMinutes(sample.deep),
                        inBedMinutes: hoursToMinutes(sample.inBed),
                        totalSleepMinutes: totalSleepMinutes
                    };

                    // Fallback for InBed
                    if (stages.inBedMinutes < stages.totalSleepMinutes) {
                        stages.inBedMinutes = stages.totalSleepMinutes + stages.awakeMinutes;
                    }

                    // Calculate Scores
                    const { totalScore, durationScore, bedtimeScore, interruptionScore } = calculateSleepScore({
                        totalSleepMinutes: stages.totalSleepMinutes,
                        bedtime: sleepStart,
                        wakeCount: 0, // Aggregated data often lacks wake count, assume 0 or low impact
                        awakeMinutes: stages.awakeMinutes
                    }, preferences);

                    // Save
                    const saved = await saveSleepEntry({
                        sleepDate: sleepDate,
                        sleepScore: totalScore,
                        durationScore,
                        bedtimeScore,
                        interruptionScore,
                        data: {
                            stages,
                            interruptions: { count: 0, totalMinutes: stages.awakeMinutes },
                            sleepStart,
                            sleepEnd
                        }
                    });

                    results.push(saved);

                } catch (e: any) {
                    console.error('Error processing aggregated sample:', e);
                    invalidSamples.push({ reason: 'Processing error', error: e.message, sample });
                }
            }

        } else {
            // --- RAW SEGMENTS HANDLING (Existing Logic) ---

            // 1. Filter valid raw samples
            const validSamples = sleepMetric.data.filter(s => {
                const start = new Date(s.startDate).getTime();
                const end = new Date(s.endDate).getTime();
                if (isNaN(start) || isNaN(end)) {
                    invalidSamples.push({ reason: 'NaN dates', sample: s });
                    return false;
                }
                return true;
            });

            if (validSamples.length === 0 && results.length === 0) {
                // return error later if results empty
            } else {
                // Sort
                validSamples.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                // Group by Date
                const groupedByDate: Record<string, any[]> = {};
                validSamples.forEach(sample => {
                    const start = new Date(sample.startDate);
                    if (start.getHours() < 15) {
                        const prev = new Date(start);
                        prev.setDate(prev.getDate() - 1);
                        groupedByDate[prev.toISOString().split('T')[0]] = groupedByDate[prev.toISOString().split('T')[0]] || [];
                        groupedByDate[prev.toISOString().split('T')[0]].push(sample);
                    } else {
                        const dateKey = start.toISOString().split('T')[0];
                        groupedByDate[dateKey] = groupedByDate[dateKey] || [];
                        groupedByDate[dateKey].push(sample);
                    }
                });

                // Process Groups
                for (const [date, daysSamples] of Object.entries(groupedByDate)) {
                    // (Same logic as before for raw aggregation)
                    const stages: SleepStages = {
                        awakeMinutes: 0, remMinutes: 0, coreMinutes: 0, deepMinutes: 0, inBedMinutes: 0, totalSleepMinutes: 0
                    };
                    let sleepStartMs = Number.MAX_SAFE_INTEGER;
                    let sleepEndMs = 0;
                    let wakeCount = 0;

                    daysSamples.forEach(s => {
                        const duration = s.duration / 60; // seconds -> minutes (Wait, check units! usually seconds in raw)
                        // Actually in previous code we assumed seconds. Let's verify.
                        // Standard HealthKit raw export is seconds.

                        const startMs = new Date(s.startDate).getTime();
                        const endMs = new Date(s.endDate).getTime();
                        if (startMs < sleepStartMs) sleepStartMs = startMs;
                        if (endMs > sleepEndMs) sleepEndMs = endMs;

                        switch (s.value) {
                            case 'Awake': stages.awakeMinutes += duration; wakeCount++; break;
                            case 'REM': stages.remMinutes += duration; stages.totalSleepMinutes += duration; break;
                            case 'Deep': stages.deepMinutes += duration; stages.totalSleepMinutes += duration; break;
                            case 'Core': stages.coreMinutes += duration; stages.totalSleepMinutes += duration; break;
                            case 'Asleep': stages.coreMinutes += duration; stages.totalSleepMinutes += duration; break;
                            case 'InBed': stages.inBedMinutes += duration; break;
                        }
                    });

                    if (stages.inBedMinutes < stages.totalSleepMinutes) stages.inBedMinutes = stages.totalSleepMinutes + stages.awakeMinutes;

                    const sleepStart = new Date(sleepStartMs).toISOString();
                    const sleepEnd = new Date(sleepEndMs).toISOString();

                    const { totalScore, durationScore, bedtimeScore, interruptionScore } = calculateSleepScore({
                        totalSleepMinutes: stages.totalSleepMinutes,
                        bedtime: sleepStart,
                        wakeCount,
                        awakeMinutes: stages.awakeMinutes
                    }, preferences);

                    const saved = await saveSleepEntry({
                        sleepDate: date,
                        sleepScore: totalScore, durationScore, bedtimeScore, interruptionScore,
                        data: { stages, interruptions: { count: wakeCount, totalMinutes: stages.awakeMinutes }, sleepStart, sleepEnd }
                    });
                    results.push(saved);
                }
            }
        }

        if (results.length === 0) {
            return NextResponse.json({
                message: 'No sleep entries created',
                debug: { invalidCount: invalidSamples.length, sampleInvalid: invalidSamples[0] }
            }, { status: 200 });
        }

        return NextResponse.json({ success: true, processed: results.length, results });

    } catch (error: any) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message || JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json(
        { message: 'This endpoint only accepts POST requests from Health Auto Export' },
        { status: 405, headers: { 'Allow': 'POST' } }
    );
}
