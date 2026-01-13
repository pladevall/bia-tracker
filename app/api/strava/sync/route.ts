/**
 * Strava Sync API
 * POST - Fetch new activities from Strava and save to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { StravaClient, convertStravaActivity } from '@/lib/strava-client';
import {
    getStravaConnection,
    updateStravaTokens,
    updateStravaSyncStatus,
    saveRunningActivities,
    getLastActivityDate,
} from '@/lib/supabase-strava';

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
        const connection = await getStravaConnection(connectionId);
        if (!connection) {
            return NextResponse.json(
                { error: 'Connection not found' },
                { status: 404 }
            );
        }

        // Update status to pending
        await updateStravaSyncStatus(connectionId, 'pending');

        try {
            // Create Strava client with token refresh callback
            const client = new StravaClient(
                connection.accessToken,
                connection.refreshToken,
                new Date(connection.tokenExpiresAt).getTime() / 1000,
                async (tokens) => {
                    await updateStravaTokens(connectionId, tokens);
                }
            );

            // Get the last activity date to fetch only new activities
            const lastActivityDate = await getLastActivityDate(connectionId);

            // Fetch activities since last sync (or all if first sync)
            // Subtract a day to account for timezone issues and ensure we don't miss any
            const since = lastActivityDate
                ? new Date(lastActivityDate.getTime() - 24 * 60 * 60 * 1000)
                : undefined;

            const stravaActivities = await client.getAllRunningActivities(since);

            // Fetch detailed data for each activity (includes HR, cadence, elev_high/low)
            // The list endpoint doesn't include these fields
            // Process sequentially to avoid rate limiting (Strava: 100 req/15min)
            const detailedActivities = [];
            for (const activity of stravaActivities) {
                try {
                    const detailed = await client.getActivity(activity.id);
                    detailedActivities.push(detailed);
                } catch (error) {
                    console.warn(`Failed to fetch details for activity ${activity.id}:`, error);
                    detailedActivities.push(activity); // Fall back to basic data
                }
                // Small delay between requests to be kind to API
                if (stravaActivities.length > 10) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Convert and save activities
            const convertedActivities = detailedActivities.map(convertStravaActivity);
            const savedActivities = await saveRunningActivities(connectionId, convertedActivities);

            // Update sync status
            await updateStravaSyncStatus(connectionId, 'connected');

            return NextResponse.json({
                success: true,
                activitiesCount: savedActivities.length,
                message: `Synced ${savedActivities.length} running activities`,
            });
        } catch (syncError) {
            console.error('Error during Strava sync:', syncError);
            await updateStravaSyncStatus(connectionId, 'error');
            throw syncError;
        }
    } catch (error) {
        console.error('Error syncing Strava activities:', error);
        return NextResponse.json(
            { error: 'Failed to sync activities' },
            { status: 500 }
        );
    }
}
