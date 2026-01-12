'use client';

import { useState } from 'react';
import { BodyspecConnection, BodyspecScan, RunningActivity, LiftingWorkout } from '@/lib/types';

import FileUpload from './FileUpload';

type IntegrationType = 'bia-scale' | 'bodyspec' | 'strava' | 'hevy';

interface IntegrationTabsProps {
    // BIA Scale (Upload)
    onUpload: (files: File[]) => Promise<void>;
    isUploading: boolean;
    uploadProgress: string;
    uploadError: string | null;
    // Bodyspec
    bodyspecConnections: Omit<BodyspecConnection, 'accessToken' | 'refreshToken'>[];
    bodyspecScans: BodyspecScan[];
    hiddenScans: Set<string>;
    onBodyspecConnectionChange: (options?: { autoSync?: boolean }) => void;
    onBodyspecDisconnect: (connectionId: string) => void;
    onBodyspecSync: () => void;
    onToggleScanVisibility: (scanId: string) => void;
    onShowOnlyLatest: () => void;
    // Strava
    stravaConnections: any[];
    onStravaConnectionChange: () => void;
    // Hevy
    hevyConnections: any[];
    onHevyConnectionChange: () => void;
    // Workout sync
    runningActivities: RunningActivity[];
    liftingWorkouts: LiftingWorkout[];
    onWorkoutSync: () => void;
}

export default function IntegrationTabs({
    onUpload,
    isUploading,
    uploadProgress,
    uploadError,
    bodyspecConnections,
    bodyspecScans,
    hiddenScans,
    onBodyspecConnectionChange,
    onBodyspecDisconnect,
    onBodyspecSync,
    onToggleScanVisibility,
    onShowOnlyLatest,
    stravaConnections,
    onStravaConnectionChange,
    hevyConnections,
    onHevyConnectionChange,
    runningActivities,
    liftingWorkouts,
    onWorkoutSync,
}: IntegrationTabsProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<IntegrationType>('bia-scale');

    const tabs: { id: IntegrationType; label: string; isConnected?: boolean }[] = [
        { id: 'bia-scale', label: 'BIA Scale' },
        { id: 'bodyspec', label: 'Bodyspec', isConnected: bodyspecConnections.length > 0 },
        { id: 'strava', label: 'Strava', isConnected: stravaConnections.length > 0 },
        { id: 'hevy', label: 'Hevy', isConnected: hevyConnections.length > 0 },
    ];

    const visibleScans = bodyspecScans.filter(scan => !hiddenScans.has(scan.id));

    return (
        <section className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Integrations
                    </h2>
                </div>
                <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4">
                    {/* Segmented Control */}
                    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 min-w-[100px] px-3 py-2 text-sm font-medium rounded-md transition-colors relative whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    {tab.label}
                                    {tab.isConnected && (
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[120px]">
                        {activeTab === 'bia-scale' && (
                            <div className="space-y-4">
                                <FileUpload
                                    onUpload={onUpload}
                                    isLoading={isUploading}
                                    progress={uploadProgress}
                                />
                                {uploadError && (
                                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
                                        {uploadError}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'bodyspec' && (
                            <BodyspecContent
                                connections={bodyspecConnections}
                                scans={bodyspecScans}
                                visibleScans={visibleScans}
                                hiddenScans={hiddenScans}
                                onConnectionChange={onBodyspecConnectionChange}
                                onDisconnect={onBodyspecDisconnect}
                                onSync={onBodyspecSync}
                                onToggleScanVisibility={onToggleScanVisibility}
                                onShowOnlyLatest={onShowOnlyLatest}
                            />
                        )}
                        {activeTab === 'strava' && (
                            <StravaContent
                                connections={stravaConnections}
                                activities={runningActivities}
                                onConnectionChange={onStravaConnectionChange}
                                onSync={onWorkoutSync}
                            />
                        )}
                        {activeTab === 'hevy' && (
                            <HevyContent
                                connections={hevyConnections}
                                workouts={liftingWorkouts}
                                onConnectionChange={onHevyConnectionChange}
                                onSync={onWorkoutSync}
                            />
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

// ==================== BODYSPEC CONTENT ====================
interface BodyspecContentProps {
    connections: Omit<BodyspecConnection, 'accessToken' | 'refreshToken'>[];
    scans: BodyspecScan[];
    visibleScans: BodyspecScan[];
    hiddenScans: Set<string>;
    onConnectionChange: (options?: { autoSync?: boolean }) => void;
    onDisconnect: (connectionId: string) => void;
    onSync: () => void;
    onToggleScanVisibility: (scanId: string) => void;
    onShowOnlyLatest: () => void;
}

import { useState as useStateBS, useEffect as useEffectBS } from 'react';
import BodyspecSyncButton from './BodyspecSyncButton';

function BodyspecContent({
    connections,
    scans,
    visibleScans,
    hiddenScans,
    onConnectionChange,
    onDisconnect,
    onSync,
    onToggleScanVisibility,
    onShowOnlyLatest,
}: BodyspecContentProps) {
    const [error, setError] = useStateBS<string | null>(null);
    const [success, setSuccess] = useStateBS<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useStateBS<string | null>(null);

    // Check for OAuth callback messages in URL
    useEffectBS(() => {
        const params = new URLSearchParams(window.location.search);

        if (params.get('bodyspec') === 'connected') {
            setSuccess('Successfully connected to Bodyspec!');
            window.history.replaceState({}, '', window.location.pathname);
            onConnectionChange({ autoSync: true });
        }

        const errorParam = params.get('error');
        if (errorParam) {
            const message = params.get('message') || 'Connection failed';
            setError(message);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [onConnectionChange]);

    const handleConnect = () => {
        window.location.href = `/api/auth/bodyspec/authorize?name=Bodyspec`;
    };

    const handleDisconnectRequest = (connectionId: string) => {
        if (confirmDisconnect === connectionId) {
            onDisconnect(connectionId);
            setConfirmDisconnect(null);
        } else {
            setConfirmDisconnect(connectionId);
            // Reset confirmation after 3 seconds
            setTimeout(() => setConfirmDisconnect(null), 3000);
        }
    };

    // Messages
    const messages = (
        <>
            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-600 dark:text-red-300 hover:text-red-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm flex items-center justify-between">
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="text-green-600 dark:text-green-300 hover:text-green-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}
        </>
    );

    // Connected state
    if (connections.length > 0) {
        return (
            <div className="space-y-4">
                {messages}

                {/* Controls row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BodyspecSyncButton
                            connection={connections[0]}
                            onSyncComplete={onSync}
                        />
                        <button
                            onClick={() => handleDisconnectRequest(connections[0].id)}
                            className={`text-sm px-3 py-1.5 rounded-md transition-colors border border-transparent cursor-pointer ${confirmDisconnect === connections[0].id
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 font-medium'
                                : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800'
                                }`}
                        >
                            {confirmDisconnect === connections[0].id ? 'Click to Confirm' : 'Disconnect'}
                        </button>
                    </div>
                </div>

                {/* Scan list */}
                {scans.length > 0 && (
                    <div className="space-y-1">
                        {scans.map((scan) => {
                            const isHidden = hiddenScans.has(scan.id);
                            return (
                                <div
                                    key={scan.id}
                                    className={`flex items-center justify-between py-2 px-1 text-sm border-b border-gray-100 dark:border-gray-800 last:border-0 ${isHidden ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onToggleScanVisibility(scan.id)}
                                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                                            title={isHidden ? 'Show in table' : 'Hide from table'}
                                        >
                                            {isHidden ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                        <span className={`font-medium ${isHidden ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                            {new Date(scan.scanDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <span className={isHidden ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}>
                                        {scan.data.bodyFatPercentage.toFixed(1)}% • {scan.data.weight.toFixed(0)} lb
                                    </span>
                                </div>
                            );
                        })}
                        {scans.length > 1 && (
                            <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {visibleScans.length} of {scans.length} shown
                                </span>
                                <button
                                    onClick={() => {
                                        if (visibleScans.length === 1) {
                                            // Show all - handled by parent setting hiddenScans to empty
                                            onShowOnlyLatest(); // This will be repurposed
                                        } else {
                                            onShowOnlyLatest();
                                        }
                                    }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                    {visibleScans.length === 1 ? 'Show all' : 'Only show latest'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Unconnected state
    return (
        <div className="space-y-4">
            {messages}
            <div className="text-center py-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Connect your Bodyspec account to sync DEXA scans.
                </p>
                <button
                    onClick={handleConnect}
                    className="px-3 py-1.5 text-sm rounded-md font-medium transition-colors bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                >
                    Connect
                </button>
            </div>
        </div>
    );
}

// ==================== STRAVA CONTENT ====================
interface StravaContentProps {
    connections: any[];
    activities: RunningActivity[];
    onConnectionChange: () => void;
    onSync: () => void;
}

import { useState as useStateST, useEffect as useEffectST } from 'react';
import WorkoutSyncButton from './WorkoutSyncButton';

function StravaContent({ connections, activities, onConnectionChange, onSync }: StravaContentProps) {
    const [error, setError] = useStateST<string | null>(null);
    const [success, setSuccess] = useStateST<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useStateST<string | null>(null);

    useEffectST(() => {
        const params = new URLSearchParams(window.location.search);

        if (params.get('strava') === 'connected') {
            setSuccess('Successfully connected to Strava!');
            window.history.replaceState({}, '', window.location.pathname);
            onConnectionChange();
        }

        const errorParam = params.get('error');
        if (errorParam?.startsWith('strava_')) {
            const message = params.get('message') || 'Strava connection failed';
            setError(message);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [onConnectionChange]);

    const handleConnect = () => {
        window.location.href = '/api/auth/strava/authorize';
    };

    const handleDisconnectRequest = async (connectionId: string) => {
        if (confirmDisconnect === connectionId) {
            try {
                const response = await fetch(`/api/strava/connections?id=${connectionId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error('Failed to disconnect');
                setSuccess('Disconnected from Strava');
                onConnectionChange();
            } catch (err) {
                setError('Failed to disconnect from Strava');
            } finally {
                setConfirmDisconnect(null);
            }
        } else {
            setConfirmDisconnect(connectionId);
            setTimeout(() => setConfirmDisconnect(null), 3000);
        }
    };

    const messages = (
        <>
            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-600 dark:text-red-300 hover:text-red-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm flex items-center justify-between">
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="text-green-600 dark:text-green-300 hover:text-green-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}
        </>
    );

    if (connections.length > 0) {
        const connection = connections[0];
        return (
            <div className="space-y-4">
                {messages}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <WorkoutSyncButton
                            stravaConnectionId={connection.id}
                            onSyncComplete={onSync}
                        />
                        <button
                            onClick={() => handleDisconnectRequest(connection.id)}
                            className={`text-sm px-3 py-1.5 rounded-md transition-colors border border-transparent cursor-pointer ${confirmDisconnect === connection.id
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 font-medium'
                                : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800'
                                }`}
                        >
                            {confirmDisconnect === connection.id ? 'Click to Confirm' : 'Disconnect'}
                        </button>
                    </div>
                </div>

                {activities.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {activities.length} running {activities.length === 1 ? 'activity' : 'activities'} synced
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {messages}
            <div className="text-center py-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Connect your Strava account to sync running activities.
                </p>
                <button
                    onClick={handleConnect}
                    className="px-3 py-1.5 text-sm rounded-md font-medium transition-colors bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                >
                    Connect
                </button>
            </div>
        </div>
    );
}

// ==================== HEVY CONTENT ====================
interface HevyContentProps {
    connections: any[];
    workouts: LiftingWorkout[];
    onConnectionChange: () => void;
    onSync: () => void;
}

import { useState as useStateHV } from 'react';

function HevyContent({ connections, workouts, onConnectionChange, onSync }: HevyContentProps) {
    const [apiKey, setApiKey] = useStateHV('');
    const [isConnecting, setIsConnecting] = useStateHV(false);
    const [error, setError] = useStateHV<string | null>(null);
    const [success, setSuccess] = useStateHV<string | null>(null);
    const [showForm, setShowForm] = useStateHV(false);
    const [confirmDisconnect, setConfirmDisconnect] = useStateHV<string | null>(null);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError('Please enter your Hevy API key');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const response = await fetch('/api/hevy/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: apiKey.trim(),
                    connectionName: 'My Hevy',
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to connect');
            }

            setSuccess('Successfully connected to Hevy!');
            setApiKey('');
            setShowForm(false);
            onConnectionChange();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to Hevy');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnectRequest = async (connectionId: string) => {
        if (confirmDisconnect === connectionId) {
            try {
                const response = await fetch(`/api/hevy/connections?id=${connectionId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error('Failed to disconnect');
                setSuccess('Disconnected from Hevy');
                onConnectionChange();
            } catch (err) {
                setError('Failed to disconnect from Hevy');
            } finally {
                setConfirmDisconnect(null);
            }
        } else {
            setConfirmDisconnect(connectionId);
            setTimeout(() => setConfirmDisconnect(null), 3000);
        }
    };

    const messages = (
        <>
            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-600 dark:text-red-300 hover:text-red-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm flex items-center justify-between">
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} className="text-green-600 dark:text-green-300 hover:text-green-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            )}
        </>
    );

    if (connections.length > 0) {
        const connection = connections[0];
        return (
            <div className="space-y-4">
                {messages}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <WorkoutSyncButton
                            hevyConnectionId={connection.id}
                            onSyncComplete={onSync}
                        />
                        <button
                            onClick={() => handleDisconnectRequest(connection.id)}
                            className={`text-sm px-3 py-1.5 rounded-md transition-colors border border-transparent cursor-pointer ${confirmDisconnect === connection.id
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 font-medium'
                                : 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800'
                                }`}
                        >
                            {confirmDisconnect === connection.id ? 'Click to Confirm' : 'Disconnect'}
                        </button>
                    </div>
                </div>

                {workouts.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {workouts.length} lifting {workouts.length === 1 ? 'workout' : 'workouts'} synced
                    </p>
                )}
            </div>
        );
    }

    if (showForm) {
        return (
            <div className="space-y-4">
                {messages}
                <form onSubmit={handleConnect} className="space-y-3">
                    <div>
                        <label htmlFor="hevy-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Hevy API Key
                        </label>
                        <input
                            id="hevy-api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your Hevy API key"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isConnecting}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Get your API key from{' '}
                            <a
                                href="https://hevy.com/settings?developer"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                Hevy Settings
                            </a>
                            {' '}(requires Hevy Pro)
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={isConnecting}
                            className="px-3 py-1.5 text-sm rounded-md font-medium transition-colors bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setApiKey('');
                                setError(null);
                            }}
                            className="px-3 py-1.5 text-sm rounded-md font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {messages}
            <div className="text-center py-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Connect your Hevy account to sync lifting workouts.
                </p>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-3 py-1.5 text-sm rounded-md font-medium transition-colors bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                >
                    Connect
                </button>
            </div>
        </div>
    );
}
