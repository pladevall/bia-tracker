/**
 * GET /api/bodyspec/connections
 * Retrieves all Bodyspec connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnections } from '@/lib/supabase-bodyspec';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || undefined;

    const connections = await getConnections(userId);

    // Remove access tokens from response
    const safeConnections = connections.map(({ accessToken, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      connections: safeConnections,
      count: connections.length,
    });
  } catch (error) {
    console.error('Error fetching Bodyspec connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections. Please try again.' },
      { status: 500 }
    );
  }
}
