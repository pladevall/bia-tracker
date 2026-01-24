import { NextResponse } from 'next/server';
import { getTodayPractice, getLastCompletedPractice, savePractice, getStreak } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const [practice, lastPractice, streak] = await Promise.all([
            getTodayPractice(),
            getLastCompletedPractice(),
            getStreak(),
        ]);

        // If no practice today, use last completed vision as pre-fill
        const lastVision = lastPractice?.winning_vision || null;

        return NextResponse.json({
            practice,
            streak,
            lastVision,
        });
    } catch (error) {
        console.error('Error fetching today practice:', error);
        return NextResponse.json({ error: 'Failed to fetch practice' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const practice = await savePractice(body);
        return NextResponse.json(practice);
    } catch (error) {
        console.error('Error saving practice:', error);
        return NextResponse.json({ error: 'Failed to save practice' }, { status: 500 });
    }
}
