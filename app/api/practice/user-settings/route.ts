import { NextResponse } from 'next/server';
import { getUserSettings, updateUserSettings } from '@/lib/practice/supabase-practice';

export async function GET() {
    try {
        const settings = await getUserSettings();
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error fetching user settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();

        const settings = await updateUserSettings({
            annual_salary: body.annual_salary,
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error updating user settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
