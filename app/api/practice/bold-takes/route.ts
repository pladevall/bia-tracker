import { NextResponse } from 'next/server';
import { getBoldTakes } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const boldTakes = await getBoldTakes();
        return NextResponse.json(boldTakes);
    } catch (error) {
        console.error('Error fetching bold takes:', error);
        return NextResponse.json({ error: 'Failed to fetch bold takes' }, { status: 500 });
    }
}
