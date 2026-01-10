'use client';

import { useState, useCallback, useEffect } from 'react';
import { BodyspecConnection } from '@/lib/types';

interface BodyspecConnectProps {
  onConnectionChange?: () => void;
}

export default function BodyspecConnect({ onConnectionChange }: BodyspecConnectProps) {
  const [connections, setConnections] = useState<Omit<BodyspecConnection, 'accessToken' | 'refreshToken'>[]>([]);
  const [showNameInput, setShowNameInput] = useState(false);
  const [connectionName, setConnectionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for OAuth callback messages in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Check for success
    if (params.get('bodyspec') === 'connected') {
      setSuccess('Successfully connected to Bodyspec!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh connections
      loadConnections();
      onConnectionChange?.();
    }

    // Check for errors
    const errorParam = params.get('error');
    if (errorParam) {
      const message = params.get('message') || 'Connection failed';
      setError(message);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onConnectionChange]);

  // Load existing connections
  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/bodyspec/connections');
      if (!response.ok) throw new Error('Failed to load connections');

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      console.error('Error loading connections:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleConnectClick = () => {
    setShowNameInput(true);
    setConnectionName('Bodyspec');
  };

  const handleStartOAuth = () => {
    // Redirect to OAuth authorization endpoint with optional name
    const name = connectionName.trim() || 'Bodyspec';
    window.location.href = `/api/auth/bodyspec/authorize?name=${encodeURIComponent(name)}`;
  };

  const handleDisconnect = useCallback(async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect? This will delete all synced scans.')) {
      return;
    }

    try {
      const response = await fetch('/api/bodyspec/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setSuccess('Disconnected successfully');
      await loadConnections();
      onConnectionChange?.();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [loadConnections, onConnectionChange]);

  // Show nothing while loading to prevent flash
  if (isLoading) {
    return null;
  }

  // If not connected, show connect button
  if (connections.length === 0) {
    return (
      <div className="space-y-4">
        {/* Error/Success messages */}
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-600 dark:text-red-300 hover:text-red-800">
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-600 dark:text-green-300 hover:text-green-800">
              ✕
            </button>
          </div>
        )}

        {!showNameInput ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect your Bodyspec account to sync DEXA scans.
            </p>
            <button
              onClick={handleConnectClick}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connect with Bodyspec
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="connectionName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Connection Name (optional)
              </label>
              <input
                type="text"
                id="connectionName"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="Bodyspec"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleStartOAuth}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Continue to Bodyspec
              </button>
              <button
                onClick={() => {
                  setShowNameInput(false);
                  setConnectionName('');
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Connected - show simplified account info
  const connection = connections[0]; // Only show first connection

  return (
    <div className="space-y-3">
      {/* Error/Success messages */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 dark:text-red-300 hover:text-red-800">
            ✕
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 dark:text-green-300 hover:text-green-800">
            ✕
          </button>
        </div>
      )}

      <button
        onClick={() => handleDisconnect(connection.id)}
        className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
