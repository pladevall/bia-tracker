import { NextResponse } from 'next/server';
import { completePractice, getPracticeGoals, getBoldTakes, getBeliefs, getPracticeHistory, getStreak } from '@/lib/practice/supabase-practice';
import { buildContext, generateReflection } from '@/lib/practice/ai';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Complete the practice
        const result = await completePractice(body);

        // Generate AI reflection
        const [goals, boldTakes, beliefs, history] = await Promise.all([
            getPracticeGoals(),
            getBoldTakes(10),
            getBeliefs(),
            getPracticeHistory(7),
        ]);

        const context = buildContext(goals, boldTakes, beliefs, history, result.streak, result.entry);
        const reflection = await generateReflection(result.entry, context);

        return NextResponse.json({
            entry: result.entry,
            streak: result.streak,
            boldTakeId: result.boldTakeId,
            beliefId: result.beliefId,
            reflection,
        });
    } catch (error) {
        console.error('Error completing practice:', error);
        return NextResponse.json({ error: 'Failed to complete practice' }, { status: 500 });
    }
}
