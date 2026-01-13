/**
 * Supabase Database Functions for Strava Integration
 * Handles all database operations for Strava connections and running activities
 */

import { supabase } from './supabase';
import { StravaConnection, RunningActivity, RunningSplit } from './types';

// Simple encryption/decryption for tokens
function encryptToken(token: string): string {
    if (typeof window === 'undefined') {
        return Buffer.from(token).toString('base64');
    }
    return btoa(token);
}

function decryptToken(encryptedToken: string): string {
    if (typeof window === 'undefined') {
        return Buffer.from(encryptedToken, 'base64').toString('utf-8');
    }
    return atob(encryptedToken);
}

// ========================================
// Connection Management
// ========================================

/**
 * Save a new Strava connection from OAuth flow
 */
export async function saveStravaConnection(params: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: string;
    athleteId: string;
    athleteName: string | null;
}): Promise<StravaConnection> {
    const encryptedAccessToken = encryptToken(params.accessToken);
    const encryptedRefreshToken = encryptToken(params.refreshToken);

    // Check if connection already exists for this athlete
    const { data: existing } = await supabase
        .from('strava_connections')
        .select('id')
        .eq('athlete_id', params.athleteId)
        .single();

    if (existing) {
        // Update existing connection
        const { data, error } = await supabase
            .from('strava_connections')
            .update({
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                token_expires_at: params.tokenExpiresAt,
                athlete_name: params.athleteName,
                sync_status: 'connected',
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating Strava connection:', error);
            throw new Error(`Failed to update connection: ${error.message}`);
        }

        return mapRowToConnection(data);
    }

    // Create new connection
    const { data, error } = await supabase
        .from('strava_connections')
        .insert({
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
            token_expires_at: params.tokenExpiresAt,
            athlete_id: params.athleteId,
            athlete_name: params.athleteName,
            sync_status: 'connected',
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving Strava connection:', error);
        throw new Error(`Failed to save connection: ${error.message}`);
    }

    return mapRowToConnection(data);
}

/**
 * Update tokens for an existing connection (used after token refresh)
 */
export async function updateStravaTokens(
    connectionId: string,
    tokens: {
        accessToken: string;
        refreshToken: string;
        expiresAt: number; // Unix timestamp
    }
): Promise<void> {
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    const { error } = await supabase
        .from('strava_connections')
        .update({
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
            token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
        })
        .eq('id', connectionId);

    if (error) {
        console.error('Error updating Strava tokens:', error);
        throw new Error(`Failed to update tokens: ${error.message}`);
    }
}

/**
 * Get all Strava connections
 */
export async function getStravaConnections(): Promise<StravaConnection[]> {
    const { data, error } = await supabase
        .from('strava_connections')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching Strava connections:', error);
        return [];
    }

    return (data || []).map(mapRowToConnection);
}

/**
 * Get a specific connection by ID
 */
export async function getStravaConnection(connectionId: string): Promise<StravaConnection | null> {
    const { data, error } = await supabase
        .from('strava_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

    if (error) {
        console.error('Error fetching Strava connection:', error);
        return null;
    }

    return data ? mapRowToConnection(data) : null;
}

/**
 * Update sync status for a connection
 */
export async function updateStravaSyncStatus(
    connectionId: string,
    status: 'connected' | 'error' | 'pending',
    lastSync?: string
): Promise<void> {
    const updates: Record<string, unknown> = {
        sync_status: status,
    };

    if (lastSync) {
        updates.last_sync = lastSync;
    } else if (status === 'connected') {
        updates.last_sync = new Date().toISOString();
    }

    const { error } = await supabase
        .from('strava_connections')
        .update(updates)
        .eq('id', connectionId);

    if (error) {
        console.error('Error updating sync status:', error);
        throw new Error(`Failed to update sync status: ${error.message}`);
    }
}

/**
 * Delete a Strava connection and all associated activities
 */
export async function deleteStravaConnection(connectionId: string): Promise<void> {
    const { error } = await supabase
        .from('strava_connections')
        .delete()
        .eq('id', connectionId);

    if (error) {
        console.error('Error deleting Strava connection:', error);
        throw new Error(`Failed to delete connection: ${error.message}`);
    }
}

// ========================================
// Activity Management
// ========================================

/**
 * Save or update running activities
 */
export async function saveRunningActivities(
    connectionId: string,
    activities: Array<{
        stravaId: string;
        activityDate: string;
        name: string;
        distanceMiles: number;
        durationSeconds: number;
        elevationGainFeet: number | null;
        elevHighFeet: number | null;
        elevLowFeet: number | null;
        averagePaceSeconds: number | null;
        averageHeartrate: number | null;
        maxHeartrate: number | null;
        averageCadence: number | null;
        splits: Array<{ mile: number; timeSeconds: number; cumulativeSeconds: number }>;
    }>
): Promise<RunningActivity[]> {
    if (activities.length === 0) {
        return [];
    }

    const rows = activities.map(a => ({
        connection_id: connectionId,
        strava_id: a.stravaId,
        activity_date: a.activityDate,
        name: a.name,
        distance_miles: a.distanceMiles,
        duration_seconds: a.durationSeconds,
        elevation_gain_feet: a.elevationGainFeet,
        elev_high_feet: a.elevHighFeet,
        elev_low_feet: a.elevLowFeet,
        average_pace_seconds: a.averagePaceSeconds,
        average_heartrate: a.averageHeartrate,
        max_heartrate: a.maxHeartrate,
        average_cadence: a.averageCadence,
        splits: a.splits,
    }));

    const { data, error } = await supabase
        .from('running_activities')
        .upsert(rows, {
            onConflict: 'connection_id,strava_id',
        })
        .select();

    if (error) {
        console.error('Error saving running activities:', error);
        throw new Error(`Failed to save activities: ${error.message}`);
    }

    return (data || []).map(mapRowToActivity);
}

/**
 * Get all running activities, optionally filtered by connection
 */
export async function getRunningActivities(connectionId?: string): Promise<RunningActivity[]> {
    let query = supabase.from('running_activities').select('*');

    if (connectionId) {
        query = query.eq('connection_id', connectionId);
    }

    const { data, error } = await query.order('activity_date', { ascending: false });

    if (error) {
        console.error('Error fetching running activities:', error);
        return [];
    }

    return (data || []).map(mapRowToActivity);
}

/**
 * Get the most recent activity date for a connection
 * Used to determine what to fetch on sync
 */
export async function getLastActivityDate(connectionId: string): Promise<Date | null> {
    const { data, error } = await supabase
        .from('running_activities')
        .select('activity_date')
        .eq('connection_id', connectionId)
        .order('activity_date', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        return null;
    }

    return new Date(data.activity_date);
}

/**
 * Get activities within a date range
 */
export async function getActivitiesInDateRange(
    startDate: string,
    endDate: string,
    connectionId?: string
): Promise<RunningActivity[]> {
    let query = supabase
        .from('running_activities')
        .select('*')
        .gte('activity_date', startDate)
        .lte('activity_date', endDate);

    if (connectionId) {
        query = query.eq('connection_id', connectionId);
    }

    const { data, error } = await query.order('activity_date', { ascending: false });

    if (error) {
        console.error('Error fetching activities in date range:', error);
        return [];
    }

    return (data || []).map(mapRowToActivity);
}

// ========================================
// Helper Functions
// ========================================

function mapRowToConnection(row: Record<string, unknown>): StravaConnection {
    return {
        id: row.id as string,
        userId: row.user_id as string | undefined,
        accessToken: decryptToken(row.access_token as string),
        refreshToken: decryptToken(row.refresh_token as string),
        tokenExpiresAt: row.token_expires_at as string,
        athleteId: row.athlete_id as string,
        athleteName: row.athlete_name as string | null,
        lastSync: row.last_sync as string | null,
        syncStatus: row.sync_status as 'connected' | 'error' | 'pending',
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

function mapRowToActivity(row: Record<string, unknown>): RunningActivity {
    return {
        id: row.id as string,
        connectionId: row.connection_id as string,
        stravaId: row.strava_id as string,
        activityDate: row.activity_date as string,
        name: row.name as string | null,
        distanceMiles: row.distance_miles as number,
        durationSeconds: row.duration_seconds as number,
        elevationGainFeet: row.elevation_gain_feet as number | null,
        elevHighFeet: row.elev_high_feet as number | null,
        elevLowFeet: row.elev_low_feet as number | null,
        averagePaceSeconds: row.average_pace_seconds as number | null,
        averageHeartrate: row.average_heartrate as number | null,
        maxHeartrate: row.max_heartrate as number | null,
        averageCadence: row.average_cadence as number | null,
        splits: row.splits as RunningSplit[] | null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}
