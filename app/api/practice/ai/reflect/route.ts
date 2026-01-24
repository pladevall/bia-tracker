import { NextResponse } from 'next/server';
import { getPracticeGoals, getBoldTakes, getBeliefs, getPracticeHistory, getStreak, getTodayPractice } from '@/lib/practice/supabase-practice';
import { buildContext, generateReflection } from '@/lib/practice/ai';

export async function POST() {
    try {
        const [goals, boldTakes, beliefs, history, streak, todayPractice] = await Promise.all([
            getPracticeGoals(),
            getBoldTakes(10),
            getBeliefs(),
            getPracticeHistory(7),
            getStreak(),
            getTodayPractice(),
        ]);

        if (!todayPractice) {
            return NextResponse.json({ error: 'No practice today' }, { status: 400 });
        }

        const context = buildContext(goals, boldTakes, beliefs, history, streak, todayPractice);
        const reflection = await generateReflection(todayPractice, context);

        return NextResponse.json({ reflection });
    } catch (error) {
        console.error('Error generating reflection:', error);
        return NextResponse.json({ error: 'Failed to generate reflection' }, { status: 500 });
    }
}
