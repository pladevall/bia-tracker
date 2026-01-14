'use client';

import { useState } from 'react';

interface WorkoutSyncButtonProps {
    stravaConnectionId?: string;
    hevyConnectionId?: string;
    onSyncComplete?: () => void;
}

export default function WorkoutSyncButton({
    stravaConnectionId,
    hevyConnectionId,
    onSyncComplete,
}: WorkoutSyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSync = async () => {
        if (!stravaConnectionId && !hevyConnectionId) {
            setError('No connections to sync');
            return;
        }

        setIsSyncing(true);
        setError(null);
        setLastSyncMessage(null);

        const results: string[] = [];

        try {
            // Sync Strava
            if (stravaConnectionId) {
                try {
                    const response = await fetch('/api/strava/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ connectionId: stravaConnectionId }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        results.push(`🏃 ${data.activitiesCount} runs`);
                    } else {
                        results.push('🏃 sync failed');
                    }
                } catch {
                    results.push('🏃 sync error');
                }
            }

            // Sync Hevy
            if (hevyConnectionId) {
                try {
                    const response = await fetch('/api/hevy/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ connectionId: hevyConnectionId }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        results.push(`🏋️ ${data.workoutsCount} workouts`);
                    } else {
                        results.push('🏋️ sync failed');
                    }
                } catch {
                    results.push('🏋️ sync error');
                }
            }

            setLastSyncMessage(`Synced: ${results.join(', ')}`);
            onSyncComplete?.();
        } catch (err) {
            setError('Sync failed');
        } finally {
            setIsSyncing(false);
        }
    };

    const hasConnections = stravaConnectionId || hevyConnectionId;

    if (!hasConnections) {
        return null;
    }

    return (
        <div className="flex items-center gap-3">
            <button
                onClick={handleSync}
                disabled={isSyncing}
                aria-label={isSyncing ? "Syncing workouts" : "Sync workouts"}
                className="relative min-w-[140px] h-9 px-3 flex items-center justify-center text-sm rounded-md font-medium transition-all 
                    bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 
                    hover:bg-gray-300 dark:hover:bg-gray-600 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400
                    disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
                {isSyncing ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Syncing</span>
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        <span>Sync Workouts</span>
                    </span>
                )}
            </button>

            {/* Messages container */}
            <div className="flex flex-col justify-center h-9">
                {lastSyncMessage && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium animate-fade-in" role="status">
                        {lastSyncMessage}
                    </span>
                )}

                {error && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium" role="alert">
                        {error}
                    </span>
                )}
            </div>
        </div>
    );
}
