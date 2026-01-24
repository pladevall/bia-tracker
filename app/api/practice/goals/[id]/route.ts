import { NextResponse } from 'next/server';
import { updatePracticeGoal } from '@/lib/practice/supabase-practice';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const goal = await updatePracticeGoal(id, body.current_value);
        return NextResponse.json(goal);
    } catch (error) {
        console.error('Error updating goal:', error);
        return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
    }
}
