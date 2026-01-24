import { NextResponse } from 'next/server';
import { getBeliefs, addBelief } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const beliefs = await getBeliefs();
        return NextResponse.json(beliefs);
    } catch (error) {
        console.error('Error fetching beliefs:', error);
        return NextResponse.json({ error: 'Failed to fetch beliefs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const belief = await addBelief(body.belief, body.status, body.confidence);
        return NextResponse.json(belief);
    } catch (error) {
        console.error('Error adding belief:', error);
        return NextResponse.json({ error: 'Failed to add belief' }, { status: 500 });
    }
}
