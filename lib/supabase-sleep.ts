import { supabase } from '@/lib/supabase';
import { SleepEntry, SleepUserPreferences } from './types';

// Use the singleton client
// For server-side, you'll pass the client instance

export async function saveSleepEntry(entry: Omit<SleepEntry, 'id' | 'createdAt'>) {
    console.log('Saving sleep entry:', entry);

    const { data, error } = await supabase
        .from('sleep_entries')
        .upsert({
            sleep_date: entry.sleepDate,
            sleep_score: entry.sleepScore,
            duration_score: entry.durationScore,
            bedtime_score: entry.bedtimeScore,
            interruption_score: entry.interruptionScore,
            data: entry.data
        }, {
            onConflict: 'sleep_date'
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving sleep entry:', error);
        throw error;
    }

    return data;
}

export async function getSleepEntries(days: number = 30) {
    const { data, error } = await supabase
        .from('sleep_entries')
        .select('*')
        .order('sleep_date', { ascending: false })
        .limit(days);

    if (error) {
        console.error('Error fetching sleep entries:', error);
        throw error;
    }

    return data.map(mapDatabaseToSleepEntry);
}

export async function getSleepEntriesInRange(startDate: string, endDate: string) {
    const { data, error } = await supabase
        .from('sleep_entries')
        .select('*')
        .gte('sleep_date', startDate)
        .lte('sleep_date', endDate)
        .order('sleep_date', { ascending: true });

    if (error) {
        console.error('Error fetching sleep entries in range:', error);
        throw error;
    }

    return data.map(mapDatabaseToSleepEntry);
}

export async function getSleepPreferences(): Promise<SleepUserPreferences> {
    const { data, error } = await supabase
        .from('sleep_user_preferences')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No preferences found, return defaults
            return {
                targetBedtime: '22:30:00',
                targetWakeTime: '06:30:00',
                targetDurationMinutes: 480,
                bedtimeWindowMinutes: 30
            };
        }
        console.error('Error fetching sleep preferences:', error);
        throw error;
    }

    return {
        targetBedtime: data.target_bedtime,
        targetWakeTime: data.target_wake_time,
        targetDurationMinutes: data.target_duration_minutes,
        bedtimeWindowMinutes: data.bedtime_window_minutes
    };
}

export async function saveSleepPreferences(prefs: SleepUserPreferences) {
    // First check if a preference record exists
    const { data: existing } = await supabase
        .from('sleep_user_preferences')
        .select('id')
        .limit(1)
        .single();

    const payload = {
        target_bedtime: prefs.targetBedtime,
        target_wake_time: prefs.targetWakeTime,
        target_duration_minutes: prefs.targetDurationMinutes,
        bedtime_window_minutes: prefs.bedtimeWindowMinutes
    };

    let query;
    if (existing) {
        query = supabase
            .from('sleep_user_preferences')
            .update(payload)
            .eq('id', existing.id);
    } else {
        query = supabase
            .from('sleep_user_preferences')
            .insert(payload);
    }

    const { data, error } = await query.select().single();

    if (error) {
        console.error('Error saving sleep preferences:', error);
        throw error;
    }

    return data;
}

function mapDatabaseToSleepEntry(dbEntry: any): SleepEntry {
    return {
        id: dbEntry.id,
        sleepDate: dbEntry.sleep_date,
        sleepScore: dbEntry.sleep_score,
        durationScore: dbEntry.duration_score,
        bedtimeScore: dbEntry.bedtime_score,
        interruptionScore: dbEntry.interruption_score,
        data: dbEntry.data,
        createdAt: dbEntry.created_at
    };
}
