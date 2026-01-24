/**
 * Bold Practice - Supabase Database Operations
 * Ported from bold-practice/database.py
 */

import { createClient } from '@/lib/supabase/server';
import type {
    PracticeEntry,
    BoldTake,
    Belief,
    Bet,
    PracticeGoal,
    Streak,
    BoldTakeStatus,
    BeliefStatus,
    UserSettings,
} from './types';
import { calculateBetScore } from './bet-scoring';

// ============================================
// Practice Entries
// ============================================

export async function getTodayPractice(): Promise<PracticeEntry | null> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('practice_entries')
        .select('*')
        .eq('date', today)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching today practice:', error);
    }

    return data;
}

export async function getLastCompletedPractice(): Promise<PracticeEntry | null> {
    const supabase = await createClient();

    const { data } = await supabase
        .from('practice_entries')
        .select('*')
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .single();

    return data;
}

export async function savePractice(entry: Partial<PracticeEntry>): Promise<PracticeEntry> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('practice_entries')
        .upsert({
            date: today,
            winning_vision: entry.winning_vision,
            belief_examined: entry.belief_examined,
            belief_test: entry.belief_test,
            bold_risk: entry.bold_risk,
            bold_risk_fear: entry.bold_risk_fear,
            belief_id: entry.belief_id,
            blocker: entry.blocker,
            updated_at: now,
        }, { onConflict: 'date' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function completePractice(entry: Partial<PracticeEntry> & { bet_id?: string; belief_id?: string }): Promise<{
    entry: PracticeEntry;
    streak: Streak;
    boldTakeId?: string;
    beliefId?: string;
}> {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Save the practice with completed_at
    const { data: practiceData, error: practiceError } = await supabase
        .from('practice_entries')
        .upsert({
            date: today,
            winning_vision: entry.winning_vision,
            belief_examined: entry.belief_examined,
            belief_test: entry.belief_test,
            bold_risk: entry.bold_risk,
            bold_risk_fear: entry.bold_risk_fear,
            belief_id: entry.belief_id,
            blocker: entry.blocker,
            completed_at: now,
            updated_at: now,
        }, { onConflict: 'date' })
        .select()
        .single();

    if (practiceError) throw practiceError;

    // Update streak
    const streak = await updateStreak(today);

    // Auto-create bold take if bold_risk is set
    // Link to belief_id if provided, otherwise to bet_id if provided
    // Set default duration_days to 30 days
    let boldTakeId: string | undefined;
    if (entry.bold_risk) {
        const { data: boldTakeData } = await supabase
            .from('bold_takes')
            .insert({
                date: today,
                description: entry.bold_risk,
                fear: entry.blocker, // Use blocker as fear field
                status: 'committed',
                belief_id: entry.belief_id || null,
                bet_id: entry.bet_id || null,
                duration_days: 30,
            })
            .select('id')
            .single();
        boldTakeId = boldTakeData?.id;
    }

    // Return the belief_id if provided
    const beliefId = entry.belief_id;

    return { entry: practiceData, streak, boldTakeId, beliefId };
}

export async function getPracticeHistory(limit = 30): Promise<PracticeEntry[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from('practice_entries')
        .select('*')
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .limit(limit);

    return data || [];
}

// ============================================
// Streak
// ============================================

export async function getStreak(): Promise<Streak> {
    const supabase = await createClient();

    const { data } = await supabase
        .from('practice_streak')
        .select('*')
        .eq('id', 1)
        .single();

    return data || { id: 1, current_streak: 0, longest_streak: 0, last_practice_date: null };
}

async function updateStreak(todayDate: string): Promise<Streak> {
    const supabase = await createClient();
    const current = await getStreak();

    let newCurrentStreak = current.current_streak;
    let newLongestStreak = current.longest_streak;

    if (current.last_practice_date) {
        const lastDate = new Date(current.last_practice_date);
        const today = new Date(todayDate);
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            newCurrentStreak += 1;
        } else if (diffDays > 1) {
            newCurrentStreak = 1;
        }
        // diffDays === 0 means already practiced today, no change
    } else {
        newCurrentStreak = 1;
    }

    if (newCurrentStreak > newLongestStreak) {
        newLongestStreak = newCurrentStreak;
    }

    const { data, error } = await supabase
        .from('practice_streak')
        .update({
            current_streak: newCurrentStreak,
            longest_streak: newLongestStreak,
            last_practice_date: todayDate,
        })
        .eq('id', 1)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================
// Bold Takes
// ============================================

export async function getBoldTakes(limit = 50): Promise<BoldTake[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from('bold_takes')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

    return data || [];
}

export async function updateBoldTake(
    id: string,
    updates: Partial<BoldTake>
): Promise<BoldTake> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('bold_takes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBoldTake(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('bold_takes')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// Beliefs
// ============================================

export async function getBeliefs(): Promise<Belief[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from('practice_beliefs')
        .select('*')
        .order('created_at', { ascending: false });

    return data || [];
}

export async function addBelief(belief: string, status: BeliefStatus = 'untested', confidence?: number): Promise<Belief> {
    const supabase = await createClient();

    // Default confidence based on status if not provided
    let defaultConfidence = confidence ?? 50;
    if (confidence === undefined) {
        switch (status) {
            case 'proven':
                defaultConfidence = 90;
                break;
            case 'testing':
                defaultConfidence = 60;
                break;
            case 'disproven':
                defaultConfidence = 10;
                break;
            default:
                defaultConfidence = 50;
        }
    }

    const { data, error } = await supabase
        .from('practice_beliefs')
        .insert({ belief, status, confidence: defaultConfidence })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateBelief(
    id: string,
    updates?: Partial<Belief>
): Promise<Belief> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const mergedUpdates: Partial<Belief> = { updated_at: now };
    if (updates) {
        Object.assign(mergedUpdates, updates);
    }

    const { data, error } = await supabase
        .from('practice_beliefs')
        .update(mergedUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBelief(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('practice_beliefs')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// Bets
// ============================================

export async function calculateBetTimeline(betId: string): Promise<number> {
    const supabase = await createClient();

    // Sum duration_days of all committed bold_takes for this bet
    const { data, error } = await supabase
        .from('bold_takes')
        .select('duration_days')
        .eq('bet_id', betId)
        .eq('status', 'committed');

    if (error) {
        console.error('Error calculating timeline:', error);
        return 0;
    }

    const totalDays = data?.reduce((sum, t) => sum + (t.duration_days || 0), 0) || 0;
    // Convert days to years (365 days per year)
    return totalDays / 365;
}

export async function getBets(): Promise<Bet[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('bets')
        .select('*')
        .order('bet_score', { ascending: false, nullsFirst: false });

    if (error) {
        console.error('Error fetching bets:', error);
        return [];
    }

    // Calculate timeline for each bet
    const betsWithTimeline = await Promise.all(
        (data || []).map(async (bet) => ({
            ...bet,
            calculated_timeline_years: await calculateBetTimeline(bet.id),
        }))
    );

    return betsWithTimeline;
}

export async function getBetById(id: string): Promise<Bet | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching bet:', error);
        return null;
    }

    return data;
}

export async function getBetWithRelations(id: string): Promise<{
    bet: Bet;
    beliefs: Belief[];
    boldTakes: BoldTake[];
} | null> {
    const supabase = await createClient();

    const [betResult, beliefsResult, takesResult] = await Promise.all([
        supabase.from('bets').select('*').eq('id', id).single(),
        supabase.from('practice_beliefs').select('*').eq('bet_id', id).order('created_at', { ascending: false }),
        supabase.from('bold_takes').select('*').eq('bet_id', id).order('date', { ascending: false }),
    ]);

    if (betResult.error || !betResult.data) {
        console.error('Error fetching bet with relations:', betResult.error);
        return null;
    }

    return {
        bet: betResult.data,
        beliefs: beliefsResult.data || [],
        boldTakes: takesResult.data || [],
    };
}

export async function createBet(bet: Omit<Bet, 'id' | 'created_at' | 'updated_at' | 'bet_score'>): Promise<Bet> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Calculate the score
    const betWithScore = {
        ...bet,
        bet_score: calculateBetScore(bet as Bet),
    };

    const { data, error } = await supabase
        .from('bets')
        .insert({
            ...betWithScore,
            created_at: now,
            updated_at: now,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateBet(id: string, updates: Partial<Omit<Bet, 'id' | 'created_at'>>): Promise<Bet> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // If sizing factors changed, recalculate score
    let betScore = updates.bet_score;
    if (updates.upside !== undefined || updates.upside_multiplier !== undefined ||
        updates.confidence !== undefined || updates.timeline !== undefined) {
        // Fetch current bet to merge with updates
        const { data: currentBet } = await supabase.from('bets').select('*').eq('id', id).single();
        if (currentBet) {
            const merged = { ...currentBet, ...updates } as Bet;
            betScore = calculateBetScore(merged);
        }
    }

    const { data, error } = await supabase
        .from('bets')
        .update({
            ...updates,
            bet_score: betScore,
            updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBet(id: string): Promise<void> {
    const supabase = await createClient();

    // First, unlink any beliefs and bold_takes
    await Promise.all([
        supabase.from('practice_beliefs').update({ bet_id: null }).eq('bet_id', id),
        supabase.from('bold_takes').update({ bet_id: null }).eq('bet_id', id),
    ]);

    const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function linkBeliefToBet(beliefId: string, betId: string | null): Promise<Belief> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('practice_beliefs')
        .update({ bet_id: betId, updated_at: now })
        .eq('id', beliefId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function linkBoldTakeToBet(boldTakeId: string, betId: string | null): Promise<BoldTake> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('bold_takes')
        .update({ bet_id: betId })
        .eq('id', boldTakeId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================
// Goals
// ============================================

export async function getPracticeGoals(): Promise<PracticeGoal[]> {
    const supabase = await createClient();

    const { data: goals } = await supabase
        .from('practice_goals')
        .select('*')
        .order('quarter')
        .order('category');

    if (!goals) return [];

    // Auto-calculate Personal goals
    const [boldTakesCount, streak] = await Promise.all([
        getBoldTakesCount(),
        getStreak(),
    ]);

    return goals.map(goal => {
        if (goal.category === 'Personal') {
            if (goal.name.includes('Bold Risks') || goal.name.includes('Bold Takes')) {
                return { ...goal, current_value: boldTakesCount };
            }
            if (goal.name.includes('Streak')) {
                return { ...goal, current_value: streak.longest_streak };
            }
        }
        return goal;
    });
}

async function getBoldTakesCount(): Promise<number> {
    const supabase = await createClient();
    const { count } = await supabase
        .from('bold_takes')
        .select('*', { count: 'exact', head: true });
    return count || 0;
}

export async function addPracticeGoal(goal: Omit<PracticeGoal, 'id' | 'created_at'>): Promise<PracticeGoal> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('practice_goals')
        .insert(goal)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updatePracticeGoal(id: string, currentValue: number): Promise<PracticeGoal> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('practice_goals')
        .update({ current_value: currentValue })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================
// User Settings
// ============================================

export async function getUserSettings(): Promise<UserSettings> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error('Error fetching user settings:', error);
        // Return default settings
        return { id: 1, annual_salary: 150000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    }

    return data;
}

export async function updateUserSettings(updates: Partial<Omit<UserSettings, 'id' | 'created_at'>>): Promise<UserSettings> {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('user_settings')
        .update({
            ...updates,
            updated_at: now,
        })
        .eq('id', 1)
        .select()
        .single();

    if (error) throw error;
    return data;
}
