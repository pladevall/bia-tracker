'use client';

/**
 * Bold Practice - SWR Data Hook
 * Following use-baseline-data.ts pattern
 */

import useSWR, { mutate } from 'swr';
import type {
    PracticeEntry,
    BoldTake,
    Belief,
    Bet,
    PracticeGoal,
    Streak,
    UserSettings,
} from './practice/types';

interface PracticeData {
    todayPractice: PracticeEntry | null;
    lastVision: string | null;
    boldTakes: BoldTake[];
    beliefs: Belief[];
    bets: Bet[];
    goals: PracticeGoal[];
    streak: Streak;
    userSettings: UserSettings | null;
}

async function fetchPracticeData(): Promise<PracticeData> {
    const [
        todayRes,
        boldTakesRes,
        beliefsRes,
        betsRes,
        goalsRes,
        userSettingsRes,
    ] = await Promise.all([
        fetch('/api/practice/today').then(r => r.ok ? r.json() : { practice: null, streak: null, lastVision: null }),
        fetch('/api/practice/bold-takes').then(r => r.ok ? r.json() : []),
        fetch('/api/practice/beliefs').then(r => r.ok ? r.json() : []),
        fetch('/api/practice/bets').then(r => r.ok ? r.json() : []),
        fetch('/api/practice/goals').then(r => r.ok ? r.json() : []),
        fetch('/api/practice/user-settings').then(r => r.ok ? r.json() : null),
    ]);

    return {
        todayPractice: todayRes.practice,
        lastVision: todayRes.lastVision,
        boldTakes: boldTakesRes,
        beliefs: beliefsRes,
        bets: betsRes,
        goals: goalsRes,
        streak: todayRes.streak || { id: 1, current_streak: 0, longest_streak: 0, last_practice_date: null },
        userSettings: userSettingsRes,
    };
}

const PRACTICE_CACHE_KEY = 'practice-data';

export function usePracticeData() {
    const { data, error, isLoading, isValidating } = useSWR<PracticeData>(
        PRACTICE_CACHE_KEY,
        fetchPracticeData,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60000,
            keepPreviousData: true,
        }
    );

    const refresh = () => mutate(PRACTICE_CACHE_KEY);

    return {
        data: data ?? {
            todayPractice: null,
            lastVision: null,
            boldTakes: [],
            beliefs: [],
            bets: [],
            goals: [],
            streak: { id: 1, current_streak: 0, longest_streak: 0, last_practice_date: null },
            userSettings: null,
        },
        isLoading,
        isValidating,
        error,
        refresh,
    };
}

export { mutate as mutatePracticeData };
