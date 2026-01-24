import { NextResponse } from 'next/server';
import { getBets, createBet } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const bets = await getBets();
        return NextResponse.json(bets);
    } catch (error) {
        console.error('Error fetching bets:', error);
        return NextResponse.json({ error: 'Failed to fetch bets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.upside || body.confidence === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: name, upside, confidence' },
                { status: 400 }
            );
        }

        const bet = await createBet({
            name: body.name,
            description: body.description || null,
            upside: body.upside,
            upside_multiplier: body.upside_multiplier || null,
            confidence: body.confidence,
            downside: body.downside || null,
            timeline: body.timeline || null,
            status: body.status || 'active',
        });

        return NextResponse.json(bet);
    } catch (error) {
        console.error('Error creating bet:', error);
        return NextResponse.json({ error: 'Failed to create bet' }, { status: 500 });
    }
}
