import { NextResponse } from 'next/server';
import { getPracticeGoals, getBoldTakes, getBeliefs, getPracticeHistory, getStreak, getTodayPractice } from '@/lib/practice/supabase-practice';
import { buildContext, chatWithCoach } from '@/lib/practice/ai';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message, history = [] } = body;

        // Build context from all user data
        const [goals, boldTakes, beliefs, practiceHistory, streak, todayPractice] = await Promise.all([
            getPracticeGoals(),
            getBoldTakes(10),
            getBeliefs(),
            getPracticeHistory(7),
            getStreak(),
            getTodayPractice(),
        ]);

        const context = buildContext(goals, boldTakes, beliefs, practiceHistory, streak, todayPractice);
        const response = await chatWithCoach(message, history, context);

        return NextResponse.json({ response });
    } catch (error) {
        console.error('Error in AI chat:', error);
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
    }
}
