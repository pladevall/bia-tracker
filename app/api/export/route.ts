import { NextRequest, NextResponse } from 'next/server';
import { getEntriesFromDb } from '@/lib/supabase';
import { getScans } from '@/lib/supabase-bodyspec';
import { getRunningActivities } from '@/lib/supabase-strava';
import { getLiftingWorkouts } from '@/lib/supabase-hevy';
import { getSleepEntries } from '@/lib/supabase-sleep';
import { generateHealthDataExport } from '@/lib/export-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export
 * Returns all health data in a structured format
 * Query params:
 *   - format: 'json' (default) - returns the complete data export
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';

    // Fetch all data in parallel
    const [biaEntries, bodyspecScans, runningActivities, liftingWorkouts, sleepEntries] = await Promise.all([
      getEntriesFromDb(),
      getScans().catch(err => {
        console.error('Error fetching Bodyspec scans:', err);
        return [];
      }),
      getRunningActivities().catch(err => {
        console.error('Error fetching running activities:', err);
        return [];
      }),
      getLiftingWorkouts().catch(err => {
        console.error('Error fetching lifting workouts:', err);
        return [];
      }),
      getSleepEntries(365).catch(err => {
        console.error('Error fetching sleep entries:', err);
        return [];
      }),
    ]);

    // Generate the export data
    const exportData = generateHealthDataExport(
      biaEntries,
      bodyspecScans,
      runningActivities,
      liftingWorkouts,
      sleepEntries
    );

    if (format === 'json') {
      return NextResponse.json(exportData);
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
