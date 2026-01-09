/**
 * POST /api/bodyspec/connect
 * Validates a Bodyspec access token and creates a new connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { testBodyspecToken } from '@/lib/bodyspec-client';
import { saveConnection } from '@/lib/supabase-bodyspec';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, tokenName } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    if (!tokenName) {
      return NextResponse.json(
        { error: 'Token name is required' },
        { status: 400 }
      );
    }

    // Validate the token by making a test API call
    const validationResult = await testBodyspecToken(accessToken);

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error || 'Invalid access token' },
        { status: 401 }
      );
    }

    // Save the connection to the database
    const connection = await saveConnection({
      accessToken,
      tokenName,
      syncStatus: 'pending',
      lastSync: null,
    });

    // Don't return the access token in the response
    const { accessToken: _, ...safeConnection } = connection;

    return NextResponse.json({
      success: true,
      connection: safeConnection,
      userInfo: validationResult.userInfo,
    });
  } catch (error) {
    console.error('Error connecting to Bodyspec:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Bodyspec. Please try again.' },
      { status: 500 }
    );
  }
}
