import { NextResponse } from 'next/server';
import { getBoldTakes, createBoldTake } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const boldTakes = await getBoldTakes();
        return NextResponse.json(boldTakes);
    } catch (error) {
        console.error('Error fetching bold takes:', error);
        return NextResponse.json({ error: 'Failed to fetch bold takes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.description) {
            return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }

        const boldTake = await createBoldTake({
            date: body.date ?? new Date().toISOString().split('T')[0],
            description: body.description,
            status: body.status ?? 'committed',
            confidence: body.confidence ?? 50,
            duration_days: body.duration_days ?? 30,
            fear: body.fear ?? null,
            outcome: body.outcome ?? null,
            learning: body.learning ?? null,
            belief_id: body.belief_id ?? null,
            bet_id: body.bet_id ?? null,
        });

        return NextResponse.json(boldTake);
    } catch (error) {
        console.error('Error creating bold take:', error);
        return NextResponse.json({ error: 'Failed to create bold take' }, { status: 500 });
    }
}
