/**
 * Smart Sync Strategy for Bodyspec Integration
 * Determines when to sync based on scan frequency and last sync time
 */

import { BodyspecConnection, BodyspecScan } from './types';

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc1 - utc2) / msPerDay);
}

/**
 * Sync frequency thresholds based on scan age
 */
export const SYNC_THRESHOLDS = {
  RECENT_SCAN_DAYS: 7,      // Scans less than 7 days old
  MEDIUM_SCAN_DAYS: 30,     // Scans between 7-30 days old
  OLD_SCAN_DAYS: 90,        // Scans between 30-90 days old

  RECENT_SYNC_INTERVAL: 1,  // Sync daily for recent scans
  MEDIUM_SYNC_INTERVAL: 3,  // Sync every 3 days for medium age scans
  OLD_SYNC_INTERVAL: 7,     // Sync weekly for old scans
  VERY_OLD_SYNC_INTERVAL: 30, // Sync monthly for very old scans
} as const;

/**
 * Determine if a connection should be synced based on smart strategy
 *
 * Strategy:
 * - Never synced: Always sync
 * - Recent scan (< 7 days): Sync daily (might have new scan soon)
 * - Medium age scan (7-30 days): Sync every 3 days
 * - Old scan (30-90 days): Sync weekly
 * - Very old scan (90+ days): Sync monthly
 */
export function shouldSync(
  lastSync: Date | null,
  lastScanDate: Date | null
): {
  shouldSync: boolean;
  reason: string;
  nextSyncDate?: Date;
} {
  const now = new Date();

  // Never synced - always sync
  if (!lastSync) {
    return {
      shouldSync: true,
      reason: 'Never synced before',
    };
  }

  // No scans yet - sync to check for new scans
  if (!lastScanDate) {
    const daysSinceSync = daysBetween(now, lastSync);
    if (daysSinceSync >= SYNC_THRESHOLDS.OLD_SYNC_INTERVAL) {
      return {
        shouldSync: true,
        reason: 'No scans found, checking for new scans',
      };
    }
    const nextSync = new Date(lastSync);
    nextSync.setDate(nextSync.getDate() + SYNC_THRESHOLDS.OLD_SYNC_INTERVAL);
    return {
      shouldSync: false,
      reason: 'Recently checked, no scans available',
      nextSyncDate: nextSync,
    };
  }

  const daysSinceSync = daysBetween(now, lastSync);
  const daysSinceScan = daysBetween(now, lastScanDate);

  // Recent scan (< 7 days): sync daily
  if (daysSinceScan < SYNC_THRESHOLDS.RECENT_SCAN_DAYS) {
    if (daysSinceSync >= SYNC_THRESHOLDS.RECENT_SYNC_INTERVAL) {
      return {
        shouldSync: true,
        reason: 'Recent scan detected, checking for updates',
      };
    }
    const nextSync = new Date(lastSync);
    nextSync.setDate(nextSync.getDate() + SYNC_THRESHOLDS.RECENT_SYNC_INTERVAL);
    return {
      shouldSync: false,
      reason: 'Recently synced (recent scan)',
      nextSyncDate: nextSync,
    };
  }

  // Medium age scan (7-30 days): sync every 3 days
  if (daysSinceScan < SYNC_THRESHOLDS.MEDIUM_SCAN_DAYS) {
    if (daysSinceSync >= SYNC_THRESHOLDS.MEDIUM_SYNC_INTERVAL) {
      return {
        shouldSync: true,
        reason: 'Periodic sync for medium-age scan',
      };
    }
    const nextSync = new Date(lastSync);
    nextSync.setDate(nextSync.getDate() + SYNC_THRESHOLDS.MEDIUM_SYNC_INTERVAL);
    return {
      shouldSync: false,
      reason: 'Recently synced (medium-age scan)',
      nextSyncDate: nextSync,
    };
  }

  // Old scan (30-90 days): sync weekly
  if (daysSinceScan < SYNC_THRESHOLDS.OLD_SCAN_DAYS) {
    if (daysSinceSync >= SYNC_THRESHOLDS.OLD_SYNC_INTERVAL) {
      return {
        shouldSync: true,
        reason: 'Weekly sync for old scan',
      };
    }
    const nextSync = new Date(lastSync);
    nextSync.setDate(nextSync.getDate() + SYNC_THRESHOLDS.OLD_SYNC_INTERVAL);
    return {
      shouldSync: false,
      reason: 'Recently synced (old scan)',
      nextSyncDate: nextSync,
    };
  }

  // Very old scan (90+ days): sync monthly
  if (daysSinceSync >= SYNC_THRESHOLDS.VERY_OLD_SYNC_INTERVAL) {
    return {
      shouldSync: true,
      reason: 'Monthly sync for very old scan',
    };
  }
  const nextSync = new Date(lastSync);
  nextSync.setDate(nextSync.getDate() + SYNC_THRESHOLDS.VERY_OLD_SYNC_INTERVAL);
  return {
    shouldSync: false,
    reason: 'Recently synced (very old scan)',
    nextSyncDate: nextSync,
  };
}

/**
 * Check if connection needs syncing based on connection and last scan data
 */
export function shouldSyncConnection(
  connection: BodyspecConnection,
  lastScan?: BodyspecScan | null
): {
  shouldSync: boolean;
  reason: string;
  nextSyncDate?: Date;
} {
  const lastSyncDate = connection.lastSync ? new Date(connection.lastSync) : null;
  const lastScanDate = lastScan ? new Date(lastScan.scanDate) : null;

  return shouldSync(lastSyncDate, lastScanDate);
}

/**
 * Format time until next sync in a human-readable format
 */
export function formatTimeUntilSync(nextSyncDate: Date): string {
  const now = new Date();
  const msUntilSync = nextSyncDate.getTime() - now.getTime();

  if (msUntilSync <= 0) {
    return 'Ready to sync';
  }

  const days = Math.floor(msUntilSync / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msUntilSync % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours}h`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  const minutes = Math.floor((msUntilSync % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/**
 * Get sync status display information
 */
export function getSyncStatusDisplay(
  connection: BodyspecConnection,
  lastScan?: BodyspecScan | null
): {
  status: 'ready' | 'synced' | 'error' | 'pending';
  statusText: string;
  canSync: boolean;
  nextSyncInfo?: string;
} {
  if (connection.syncStatus === 'error') {
    return {
      status: 'error',
      statusText: 'Sync error - please reconnect',
      canSync: true,
    };
  }

  if (connection.syncStatus === 'pending') {
    return {
      status: 'pending',
      statusText: 'Syncing...',
      canSync: false,
    };
  }

  const syncCheck = shouldSyncConnection(connection, lastScan);

  if (syncCheck.shouldSync) {
    return {
      status: 'ready',
      statusText: syncCheck.reason,
      canSync: true,
    };
  }

  return {
    status: 'synced',
    statusText: 'Up to date',
    canSync: true,
    nextSyncInfo: syncCheck.nextSyncDate
      ? `Next sync in ${formatTimeUntilSync(syncCheck.nextSyncDate)}`
      : undefined,
  };
}

/**
 * Background sync utility - checks all connections and returns those that need syncing
 */
export function getConnectionsNeedingSync(
  connections: BodyspecConnection[],
  scans: Map<string, BodyspecScan | null>
): BodyspecConnection[] {
  return connections.filter(connection => {
    const lastScan = scans.get(connection.id);
    const syncCheck = shouldSyncConnection(connection, lastScan);
    return syncCheck.shouldSync;
  });
}
