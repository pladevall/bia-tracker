/**
 * Hevy Sync API
 * POST - Fetch all workouts from Hevy and save to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { HevyClient, convertHevyWorkout } from '@/lib/hevy-client';
import {
    getHevyConnection,
    updateHevySyncStatus,
    saveLiftingWorkouts,
} from '@/lib/supabase-hevy';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { connectionId } = body;

        if (!connectionId) {
            return NextResponse.json(
                { error: 'Connection ID is required' },
                { status: 400 }
            );
        }

        // Get the connection
        const connection = await getHevyConnection(connectionId);
        if (!connection) {
            return NextResponse.json(
                { error: 'Connection not found' },
                { status: 404 }
            );
        }

        // Update status to pending
        await updateHevySyncStatus(connectionId, 'pending');

        try {
            // Create Hevy client
            const client = new HevyClient(connection.apiKey);

            // Always fetch ALL workouts - the upsert will update existing records
            // This ensures we always have the latest data including sets/reps/bodyparts
            const hevyWorkouts = await client.getAllWorkouts();

            // WRITE DEBUG LOG TO FILE
            try {
                const fs = require('fs');
                const debugData = {
                    timestamp: new Date().toISOString(),
                    count: hevyWorkouts.length,
                    firstWorkoutRaw: hevyWorkouts.length > 0 ? hevyWorkouts[0] : null,
                };
                fs.writeFileSync('./public/hevy-debug.json', JSON.stringify(debugData, null, 2));
            } catch (err) {
                console.error('Failed to write debug log:', err);
            }

            // Pre-fetch exercise templates to populate cache and avoid rate limiting
            // during parallel conversion below
            console.log('[Hevy Sync] Pre-fetching exercise templates...');
            await client.getExerciseTemplates();
            console.log('[Hevy Sync] Exercise templates fetched and cached');

            // Convert workouts
            const convertedWorkouts = await Promise.all(
                hevyWorkouts.map(w => convertHevyWorkout(w, client))
            );

            // Debug first converted workout
            if (convertedWorkouts.length > 0) {
                console.log('[Hevy Sync] First converted workout:', JSON.stringify(convertedWorkouts[0], null, 2));
            }

            // Save to database (upsert updates existing records)
            const savedWorkouts = await saveLiftingWorkouts(connectionId, convertedWorkouts);

            // Update sync status
            await updateHevySyncStatus(connectionId, 'connected');

            return NextResponse.json({
                success: true,
                workoutsCount: savedWorkouts.length,
                message: `Synced ${savedWorkouts.length} lifting workouts`,
            });
        } catch (syncError) {
            console.error('Error during Hevy sync:', syncError);
            await updateHevySyncStatus(connectionId, 'error');
            throw syncError;
        }
    } catch (error) {
        console.error('Error syncing Hevy workouts:', error);
        return NextResponse.json(
            { error: 'Failed to sync workouts' },
            { status: 500 }
        );
    }
}
