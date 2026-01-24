import { NextResponse } from 'next/server';
import { updateBelief, linkBeliefToBet, deleteBelief } from '@/lib/practice/supabase-practice';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Handle bet_id linking separately
        if ('bet_id' in body) {
            const belief = await linkBeliefToBet(id, body.bet_id);
            return NextResponse.json(belief);
        }

        // Build updates object from body fields
        const updates: any = {};
        if ('status' in body) updates.status = body.status;
        if ('evidence' in body) updates.evidence = body.evidence;
        if ('confidence' in body) updates.confidence = body.confidence;
        if ('duration_days' in body) updates.duration_days = body.duration_days;

        const belief = await updateBelief(id, updates);
        return NextResponse.json(belief);
    } catch (error) {
        console.error('Error updating belief:', error);
        return NextResponse.json({ error: 'Failed to update belief' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await deleteBelief(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting belief:', error);
        return NextResponse.json({ error: 'Failed to delete belief' }, { status: 500 });
    }
}
