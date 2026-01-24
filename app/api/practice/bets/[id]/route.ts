import { NextResponse } from 'next/server';
import { getBetWithRelations, updateBet, deleteBet } from '@/lib/practice/supabase-practice';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await getBetWithRelations(id);

        if (!result) {
            return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching bet:', error);
        return NextResponse.json({ error: 'Failed to fetch bet' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const bet = await updateBet(id, {
            name: body.name,
            description: body.description,
            upside: body.upside,
            upside_multiplier: body.upside_multiplier,
            confidence: body.confidence,
            downside: body.downside,
            downside_override: body.downside_override,
            timeline: body.timeline,
            status: body.status,
        });

        return NextResponse.json(bet);
    } catch (error) {
        console.error('Error updating bet:', error);
        return NextResponse.json({ error: 'Failed to update bet' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await deleteBet(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting bet:', error);
        return NextResponse.json({ error: 'Failed to delete bet' }, { status: 500 });
    }
}
