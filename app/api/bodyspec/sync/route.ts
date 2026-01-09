/**
 * POST /api/bodyspec/sync
 * Syncs scan data from Bodyspec API to local database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBodyspecClient } from '@/lib/bodyspec-client';
import { getConnection, updateSyncStatus, saveScans } from '@/lib/supabase-bodyspec';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, startDate, endDate } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Fetch the connection to get the access token
    const connection = await getConnection(connectionId);

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Update status to pending
    await updateSyncStatus(connectionId, 'pending');

    // Create Bodyspec API client
    const client = createBodyspecClient(connection.accessToken);

    // Fetch scans from Bodyspec
    const appointments = await client.fetchAllScans({
      startDate,
      endDate,
    });

    // Save scans to database
    const savedScans = await saveScans(connectionId, appointments);

    // Update sync status to connected
    await updateSyncStatus(connectionId, 'connected');

    return NextResponse.json({
      success: true,
      scansFound: appointments.length,
      scansSaved: savedScans.length,
      scans: savedScans,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing Bodyspec data:', error);

    // Try to update status to error
    const body = await request.json();
    if (body.connectionId) {
      try {
        await updateSyncStatus(body.connectionId, 'error');
      } catch {
        // Ignore error updating status
      }
    }

    return NextResponse.json(
      { error: 'Failed to sync data from Bodyspec. Please try again.' },
      { status: 500 }
    );
  }
}
