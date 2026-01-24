import { NextResponse } from 'next/server';
import { updateBoldTake, linkBoldTakeToBet, deleteBoldTake } from '@/lib/practice/supabase-practice';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Handle bet_id linking separately
        if ('bet_id' in body) {
            const boldTake = await linkBoldTakeToBet(id, body.bet_id);
            return NextResponse.json(boldTake);
        }

        // Build updates object from body fields
        const updates: any = {};
        if ('status' in body) updates.status = body.status;
        if ('outcome' in body) updates.outcome = body.outcome;
        if ('learning' in body) updates.learning = body.learning;
        if ('confidence' in body) updates.confidence = body.confidence;
        if ('duration_days' in body) updates.duration_days = body.duration_days;
        if ('fear' in body) updates.fear = body.fear;

        const boldTake = await updateBoldTake(id, updates);
        return NextResponse.json(boldTake);
    } catch (error) {
        console.error('Error updating bold take:', error);
        return NextResponse.json({ error: 'Failed to update bold take' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await deleteBoldTake(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting bold take:', error);
        return NextResponse.json({ error: 'Failed to delete bold take' }, { status: 500 });
    }
}
