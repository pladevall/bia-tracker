/**
 * DELETE /api/bodyspec/disconnect
 * Removes a Bodyspec connection and all associated scans
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteConnection } from '@/lib/supabase-bodyspec';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    await deleteConnection(connectionId);

    return NextResponse.json({
      success: true,
      message: 'Connection and associated scans deleted successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Bodyspec:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect. Please try again.' },
      { status: 500 }
    );
  }
}
