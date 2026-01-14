import { NextRequest, NextResponse } from 'next/server';
import { getSleepEntries, getSleepEntriesInRange } from '@/lib/supabase-sleep';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 30;

        let data;

        if (startDate && endDate) {
            data = await getSleepEntriesInRange(startDate, endDate);
        } else {
            data = await getSleepEntries(limit);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching sleep entries:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
