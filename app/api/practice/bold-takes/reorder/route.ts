import { NextResponse } from 'next/server';
import { reorderBoldTakes } from '@/lib/practice/supabase-practice';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const order = Array.isArray(body.order) ? body.order : [];

        if (order.length === 0) {
            return NextResponse.json({ error: 'Order array is required' }, { status: 400 });
        }

        await reorderBoldTakes(order);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error reordering actions:', error);
        return NextResponse.json({ error: 'Failed to reorder actions' }, { status: 500 });
    }
}
