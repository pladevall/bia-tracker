'use client';

import { useState, useCallback, useEffect } from 'react';
import { BodyspecConnection, BodyspecScan } from '@/lib/types';

interface BodyspecSyncButtonProps {
  connection: Omit<BodyspecConnection, 'accessToken'>;
  onSyncComplete?: () => void;
  className?: string;
}

export default function BodyspecSyncButton({
  connection,
  onSyncComplete,
  className = '',
}: BodyspecSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastScan, setLastScan] = useState<BodyspecScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Load last scan for this connection
  useEffect(() => {
    const loadLastScan = async () => {
      try {
        const response = await fetch(`/api/bodyspec/scans?connectionId=${connection.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.scans && data.scans.length > 0) {
            setLastScan(data.scans[0]); // Scans are ordered by date DESC
          }
        }
      } catch (err) {
        console.error('Error loading last scan:', err);
      }
    };
    loadLastScan();
  }, [connection.id]);

  const handleSync = useCallback(async () => {
    setError(null);
    setSyncResult(null);
    setIsSyncing(true);

    try {
      const response = await fetch('/api/bodyspec/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync');
      }

      if (data.scansSaved > 0) {
        setSyncResult(`Synced ${data.scansSaved} new scan${data.scansSaved > 1 ? 's' : ''}!`);
      } else {
        setSyncResult('No new scans found');
      }

      // Reload last scan
      const scansResponse = await fetch(`/api/bodyspec/scans?connectionId=${connection.id}`);
      if (scansResponse.ok) {
        const scansData = await scansResponse.json();
        if (scansData.scans && scansData.scans.length > 0) {
          setLastScan(scansData.scans[0]);
        }
      }

      onSyncComplete?.();

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSyncResult(null);
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }, [connection.id, onSyncComplete]);

  return (
    <div className={`flex items-center gap-3 flex-row-reverse ${className}`}>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        aria-label={isSyncing ? "Syncing Bodyspec data" : "Sync Bodyspec data"}
        className="relative min-w-[120px] h-9 px-3 flex items-center justify-center text-sm rounded-md font-medium transition-all 
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
            <span>Sync Now</span>
          </span>
        )}
      </button>

      {/* Messages region - Fixed height container could be adding if vertical shift issues arise, but purely horizontal here */}
      <div className="flex flex-col items-end justify-center h-9">
        {/* Error message */}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400 font-medium" role="alert">{error}</span>
        )}

        {/* Success message */}
        {syncResult && (
          <span className="text-xs text-green-700 dark:text-green-500 font-medium animate-fade-in" role="status">
            {syncResult}
          </span>
        )}
      </div>
    </div>
  );
}
