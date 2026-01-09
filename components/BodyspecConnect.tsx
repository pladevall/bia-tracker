'use client';

import { useState, useCallback, useEffect } from 'react';
import { BodyspecConnection } from '@/lib/types';
import { getSyncStatusDisplay } from '@/lib/bodyspec-sync';

interface BodyspecConnectProps {
  onConnectionChange?: () => void;
}

export default function BodyspecConnect({ onConnectionChange }: BodyspecConnectProps) {
  const [connections, setConnections] = useState<Omit<BodyspecConnection, 'accessToken'>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load existing connections
  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/bodyspec/connections');
      if (!response.ok) throw new Error('Failed to load connections');

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      console.error('Error loading connections:', err);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleConnect = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsConnecting(true);

    try {
      const response = await fetch('/api/bodyspec/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          tokenName: tokenName.trim() || 'My Bodyspec',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setSuccess(`Successfully connected to Bodyspec as ${data.userInfo?.name || 'user'}!`);
      setAccessToken('');
      setTokenName('');
      setShowForm(false);

      // Reload connections
      await loadConnections();

      // Notify parent
      onConnectionChange?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  }, [accessToken, tokenName, loadConnections, onConnectionChange]);

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

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Bodyspec DEXA Integration
        </h2>
        {!showForm && connections.length === 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
          >
            Connect Bodyspec
          </button>
        )}
      </div>

      {/* Info message */}
      {connections.length === 0 && !showForm && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Connect your Bodyspec account to sync your DEXA scan data and compare it with your BIA measurements.
        </p>
      )}

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Connection form */}
      {showForm && (
        <form onSubmit={handleConnect} className="mb-6 space-y-4">
          <div>
            <label htmlFor="tokenName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Connection Name
            </label>
            <input
              type="text"
              id="tokenName"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="My Bodyspec Account"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Access Token *
            </label>
            <input
              type="password"
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter your Bodyspec API token"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Get your token from{' '}
              <a
                href="https://app.bodyspec.com/#mcp-setup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 dark:text-amber-400 hover:underline"
              >
                Bodyspec MCP Setup
              </a>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isConnecting || !accessToken.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setAccessToken('');
                setTokenName('');
                setError(null);
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Connected accounts */}
      {connections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Connected Accounts
          </h3>
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {connection.tokenName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {connection.lastSync
                    ? `Last synced: ${new Date(connection.lastSync).toLocaleDateString()}`
                    : 'Never synced'}
                </div>
                <div className="text-xs mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    connection.syncStatus === 'connected'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : connection.syncStatus === 'error'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {connection.syncStatus}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(connection.id)}
                className="ml-4 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ))}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-md hover:border-amber-600 hover:text-amber-600 transition-colors"
            >
              + Add Another Account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
