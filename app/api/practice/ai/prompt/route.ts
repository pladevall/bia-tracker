import { NextResponse } from 'next/server';
import { getPracticeGoals, getBoldTakes, getBeliefs, getPracticeHistory, getStreak, getTodayPractice } from '@/lib/practice/supabase-practice';
import { buildContext, generateFieldPrompt } from '@/lib/practice/ai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { field, current_value = '', current_fields = {} } = body;

        // Build context from all user data
        const [goals, boldTakes, beliefs, history, streak, todayPractice] = await Promise.all([
            getPracticeGoals(),
            getBoldTakes(10),
            getBeliefs(),
            getPracticeHistory(7),
            getStreak(),
            getTodayPractice(),
        ]);

        const context = buildContext(goals, boldTakes, beliefs, history, streak, todayPractice);
        const prompt = await generateFieldPrompt(field, current_value, context, current_fields);

        return NextResponse.json({ prompt });
    } catch (error) {
        console.error('Error generating prompt:', error);
        return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 });
    }
}
