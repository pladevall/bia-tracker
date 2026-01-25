import { createClient } from '@supabase/supabase-js';
import { BIAEntry } from './types';
import { autoCorrectEntry } from './pdf-parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database operations
export async function saveEntryToDb(entry: BIAEntry): Promise<void> {
  const { error } = await supabase
    .from('bia_entries')
    .upsert({
      id: entry.id,
      date: entry.date,
      data: entry,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error saving entry:', error);
    throw error;
  }
}

export async function getEntriesFromDb(): Promise<BIAEntry[]> {
  const { data, error } = await supabase
    .from('bia_entries')
    .select('data')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching entries:', error);
    return [];
  }

  const entries = (data || []).map(row => row.data as BIAEntry);

  for (let i = 0; i < entries.length - 1; i++) {
    const corrected = autoCorrectEntry(entries[i], entries[i + 1]);
    if (corrected) {
      entries[i] = corrected;
    }
  }

  return entries;
}

export async function deleteEntryFromDb(id: string): Promise<void> {
  const { error } = await supabase
    .from('bia_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
}

// Get pending images uploaded via iOS Shortcut
export async function getPendingImages(): Promise<Array<{ id: string; data: string; content_type: string }>> {
  const { data, error } = await supabase
    .from('pending_images')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching pending images:', error);
    return [];
  }

  return data || [];
}

// Delete a pending image after processing
export async function deletePendingImage(id: string): Promise<void> {
  const { error } = await supabase
    .from('pending_images')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting pending image:', error);
  }
}

// Save raw OCR text for debugging
export async function saveOcrDebug(id: string, rawText: string): Promise<void> {
  const { error } = await supabase
    .from('ocr_debug')
    .upsert({
      id,
      raw_text: rawText,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error saving OCR debug:', error);
  }
}

// Get latest OCR debug text
export async function getLatestOcrDebug(): Promise<string | null> {
  const { data, error } = await supabase
    .from('ocr_debug')
    .select('raw_text')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }
  return data.raw_text;
}

// Goal operations
export interface Goal {
  metricKey: string;
  targetValue: number;
}

export async function getGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('metric_key, target_value');

  if (error) {
    console.error('Error fetching goals:', error);
    return [];
  }

  return (data || []).map(row => ({
    metricKey: row.metric_key,
    targetValue: Number(row.target_value),
  }));
}

export async function saveGoal(metricKey: string, targetValue: number): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .upsert({
      metric_key: metricKey,
      target_value: targetValue,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'metric_key',
    });

  if (error) {
    console.error('Error saving goal:', error);
    throw error;
  }
}

export async function deleteGoal(metricKey: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('metric_key', metricKey);

  if (error) {
    console.error('Error deleting goal:', error);
    throw error;
  }
}

// Migration helper - move localStorage data to Supabase
export async function migrateFromLocalStorage(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  const stored = localStorage.getItem('bia-entries');
  if (!stored) return 0;

  try {
    const entries: BIAEntry[] = JSON.parse(stored);
    if (entries.length === 0) return 0;

    // Upload each entry
    for (const entry of entries) {
      await saveEntryToDb(entry);
    }

    // Clear localStorage after successful migration
    localStorage.removeItem('bia-entries');
    console.log(`Migrated ${entries.length} entries to cloud`);
    return entries.length;
  } catch (err) {
    console.error('Migration error:', err);
    return 0;
  }
}
