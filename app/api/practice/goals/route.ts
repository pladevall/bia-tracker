import { NextResponse } from 'next/server';
import { getPracticeGoals, addPracticeGoal } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const goals = await getPracticeGoals();
        return NextResponse.json(goals);
    } catch (error) {
        console.error('Error fetching goals:', error);
        return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const goal = await addPracticeGoal(body);
        return NextResponse.json(goal);
    } catch (error) {
        console.error('Error adding goal:', error);
        return NextResponse.json({ error: 'Failed to add goal' }, { status: 500 });
    }
}
