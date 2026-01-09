/**
 * GET /api/bodyspec/scans
 * Retrieves stored Bodyspec scans from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScans, getScansInDateRange } from '@/lib/supabase-bodyspec';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let scans;

    if (startDate && endDate) {
      scans = await getScansInDateRange(startDate, endDate, connectionId);
    } else {
      scans = await getScans(connectionId);
    }

    return NextResponse.json({
      success: true,
      scans,
      count: scans.length,
    });
  } catch (error) {
    console.error('Error fetching Bodyspec scans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scans. Please try again.' },
      { status: 500 }
    );
  }
}
