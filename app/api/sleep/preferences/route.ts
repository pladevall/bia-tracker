import { NextRequest, NextResponse } from 'next/server';
import { getSleepPreferences, saveSleepPreferences } from '@/lib/supabase-sleep';
import { SleepUserPreferences } from '@/lib/types';

export async function GET(req: NextRequest) {
    try {
        const prefs = await getSleepPreferences();
        return NextResponse.json(prefs);
    } catch (error) {
        console.error('Error fetching preferences:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body: SleepUserPreferences = await req.json();
        const result = await saveSleepPreferences(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error saving preferences:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
