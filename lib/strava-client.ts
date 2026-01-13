/**
 * Strava API Client
 * Fetches running activities and calculates splits
 */

import { refreshStravaToken, StravaTokenResponse } from './strava-config';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// Meters to miles conversion
const METERS_TO_MILES = 0.000621371;
const METERS_TO_FEET = 3.28084;

/**
 * Strava activity from API
 */
export interface StravaActivity {
    id: number;
    name: string;
    type: string;           // 'Run', 'Ride', 'Walk', etc.
    sport_type: string;     // More specific type
    start_date: string;     // ISO 8601
    start_date_local: string;
    distance: number;       // meters
    moving_time: number;    // seconds
    elapsed_time: number;   // seconds
    total_elevation_gain: number; // meters
    elev_high?: number;     // meters - highest point
    elev_low?: number;      // meters - lowest point
    average_speed: number;  // meters/second
    max_speed: number;
    average_heartrate?: number;  // bpm
    max_heartrate?: number;      // bpm
    average_cadence?: number;    // rpm (for running: steps/min ÷ 2)
    splits_metric?: StravaSplit[];  // 1km splits
    splits_standard?: StravaSplit[]; // 1 mile splits
    laps?: StravaLap[];
}

export interface StravaSplit {
    split: number;          // Split number
    distance: number;       // meters
    elapsed_time: number;   // seconds
    moving_time: number;    // seconds
    average_speed: number;  // meters/second
    elevation_difference: number;
}

export interface StravaLap {
    id: number;
    name: string;
    distance: number;
    elapsed_time: number;
    moving_time: number;
    start_index: number;
    end_index: number;
}

/**
 * Create a Strava API client with automatic token refresh
 */
export class StravaClient {
    private accessToken: string;
    private refreshToken: string;
    private tokenExpiresAt: number;
    private onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => Promise<void>;

    constructor(
        accessToken: string,
        refreshToken: string,
        tokenExpiresAt: number,
        onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => Promise<void>
    ) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiresAt = tokenExpiresAt;
        this.onTokenRefresh = onTokenRefresh;
    }

    /**
     * Ensure we have a valid access token, refreshing if needed
     */
    private async ensureValidToken(): Promise<string> {
        const now = Math.floor(Date.now() / 1000);

        // Refresh if token expires in less than 5 minutes
        if (this.tokenExpiresAt - now < 300) {
            console.log('Strava token expired or expiring soon, refreshing...');
            const newTokens = await refreshStravaToken(this.refreshToken);

            this.accessToken = newTokens.access_token;
            this.refreshToken = newTokens.refresh_token;
            this.tokenExpiresAt = newTokens.expires_at;

            // Notify callback to persist new tokens
            if (this.onTokenRefresh) {
                await this.onTokenRefresh({
                    accessToken: newTokens.access_token,
                    refreshToken: newTokens.refresh_token,
                    expiresAt: newTokens.expires_at,
                });
            }
        }

        return this.accessToken;
    }

    /**
     * Make an authenticated request to Strava API
     */
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const token = await this.ensureValidToken();

        const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Strava API error: ${response.status} - ${error}`);
        }

        return response.json();
    }

    /**
     * Get the authenticated athlete's profile
     */
    async getAthlete(): Promise<StravaTokenResponse['athlete']> {
        return this.request('/athlete');
    }

    /**
     * Get running activities
     * @param after - Only return activities after this date
     * @param page - Page number (1-indexed)
     * @param perPage - Number of activities per page (max 200)
     */
    async getActivities(after?: Date, page = 1, perPage = 50): Promise<StravaActivity[]> {
        const params = new URLSearchParams({
            page: page.toString(),
            per_page: perPage.toString(),
        });

        if (after) {
            params.set('after', Math.floor(after.getTime() / 1000).toString());
        }

        const activities = await this.request<StravaActivity[]>(`/athlete/activities?${params}`);

        // Filter to only running activities
        return activities.filter(a =>
            a.type === 'Run' ||
            a.sport_type === 'Run' ||
            a.sport_type === 'TrailRun' ||
            a.sport_type === 'VirtualRun'
        );
    }

    /**
     * Get a single activity with detailed data (including splits)
     */
    async getActivity(activityId: number): Promise<StravaActivity> {
        return this.request(`/activities/${activityId}`);
    }

    /**
     * Get all running activities since a date, handling pagination
     */
    async getAllRunningActivities(since?: Date): Promise<StravaActivity[]> {
        const allActivities: StravaActivity[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            const activities = await this.getActivities(since, page, perPage);
            allActivities.push(...activities);

            // If we got fewer than requested, we've reached the end
            if (activities.length < perPage) {
                break;
            }

            page++;

            // Safety limit to prevent infinite loops
            if (page > 50) {
                console.warn('Strava pagination safety limit reached');
                break;
            }
        }

        return allActivities;
    }
}

/**
 * Calculate mile splits from standard splits data
 * Only returns splits for miles that were actually completed
 */
export function calculateMileSplits(activity: StravaActivity): { mile: number; timeSeconds: number; cumulativeSeconds: number }[] {
    const splits: { mile: number; timeSeconds: number; cumulativeSeconds: number }[] = [];

    // Use standard (mile) splits if available
    if (activity.splits_standard && activity.splits_standard.length > 0) {
        let cumulative = 0;
        for (const split of activity.splits_standard) {
            // Only include complete miles (distance should be ~1609 meters)
            if (split.distance >= 1500) {
                cumulative += split.moving_time;
                splits.push({
                    mile: split.split,
                    timeSeconds: split.moving_time,
                    cumulativeSeconds: cumulative,
                });
            }
        }
        return splits;
    }

    // Fallback: estimate from total distance and time
    const totalMiles = activity.distance * METERS_TO_MILES;
    const completeMiles = Math.floor(totalMiles);

    if (completeMiles > 0) {
        const avgPacePerMile = activity.moving_time / totalMiles;
        for (let i = 1; i <= completeMiles; i++) {
            splits.push({
                mile: i,
                timeSeconds: Math.round(avgPacePerMile),
                cumulativeSeconds: Math.round(avgPacePerMile * i),
            });
        }
    }

    return splits;
}

/**
 * Convert Strava activity to our format
 */
export function convertStravaActivity(activity: StravaActivity): {
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
    splits: { mile: number; timeSeconds: number; cumulativeSeconds: number }[];
} {
    const distanceMiles = activity.distance * METERS_TO_MILES;
    const durationSeconds = activity.moving_time;

    return {
        stravaId: activity.id.toString(),
        activityDate: activity.start_date,
        name: activity.name,
        distanceMiles: Math.round(distanceMiles * 100) / 100,
        durationSeconds,
        elevationGainFeet: activity.total_elevation_gain
            ? Math.round(activity.total_elevation_gain * METERS_TO_FEET)
            : null,
        elevHighFeet: activity.elev_high != null
            ? Math.round(activity.elev_high * METERS_TO_FEET)
            : null,
        elevLowFeet: activity.elev_low != null
            ? Math.round(activity.elev_low * METERS_TO_FEET)
            : null,
        averagePaceSeconds: distanceMiles > 0
            ? Math.round(durationSeconds / distanceMiles)
            : null,
        averageHeartrate: activity.average_heartrate != null
            ? Math.round(activity.average_heartrate)
            : null,
        maxHeartrate: activity.max_heartrate != null
            ? Math.round(activity.max_heartrate)
            : null,
        // For running, Strava reports cadence as half-steps (one foot), so multiply by 2
        averageCadence: activity.average_cadence != null
            ? Math.round(activity.average_cadence * 2)
            : null,
        splits: calculateMileSplits(activity),
    };
}
