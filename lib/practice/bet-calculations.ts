/**
 * Bet Calculation Functions
 * Utilities for calculating confidence, downside, expected value, and timelines
 */

import type { Bet, Belief, BoldTake, UserSettings } from './types';

/**
 * Calculate weighted average confidence from beliefs and actions
 * Weights each by duration_days (longer commitments = more weight)
 * Returns null if no items with confidence
 */
export function calculateWeightedConfidence(
    beliefs: Belief[],
    actions: BoldTake[]
): number | null {
    const items = [
        ...beliefs.map(b => ({
            confidence: b.confidence ?? 50,
            duration: b.duration_days ?? 0
        })),
        ...actions.map(a => ({
            confidence: a.confidence ?? 50,
            duration: a.duration_days ?? 30
        }))
    ];

    if (items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + item.duration, 0);
    if (totalWeight === 0) {
        // Fallback to simple average if no durations
        return Math.round(
            items.reduce((sum, item) => sum + item.confidence, 0) / items.length
        );
    }

    const weightedSum = items.reduce(
        (sum, item) => sum + (item.confidence * item.duration),
        0
    );
    return Math.round(weightedSum / totalWeight);
}

/**
 * Calculate belief duration as sum of linked action durations
 * If no actions, returns belief's own duration_days
 */
export function calculateBeliefDuration(
    beliefId: string,
    actions: BoldTake[]
): number {
    const linkedActions = actions.filter(a => a.belief_id === beliefId);
    if (linkedActions.length === 0) return 0;

    return linkedActions.reduce((sum, a) => sum + (a.duration_days ?? 30), 0);
}

/**
 * Calculate bet timeline as sum of all action durations
 * Returns years (days / 365)
 */
export function calculateBetTimeline(actions: BoldTake[]): number {
    if (actions.length === 0) return 0;

    const totalDays = actions.reduce((sum, a) => sum + (a.duration_days ?? 30), 0);
    return totalDays / 365;
}

/**
 * Calculate downside as timeline × opportunity cost
 * Returns null if no timeline or settings
 */
export function calculateDownside(
    timelineYears: number,
    settings: UserSettings | null | undefined
): number | null {
    if (!settings || timelineYears === 0) return null;
    return timelineYears * settings.annual_salary;
}

/**
 * Calculate monetary upside (Expected Value)
 * Formula: annual_salary × upside_multiplier
 * Returns null if no settings or multiplier
 */
export function calculateExpectedValue(
    upsideMultiplier: number | undefined,
    downside: number | null | undefined
): number | null {
    if (downside === null || downside === undefined || upsideMultiplier === undefined) return null;
    return upsideMultiplier * downside;
}

/**
 * Get effective downside (override or auto-calculated)
 * Priority: manual override > calculated > null
 */
export function getEffectiveDownside(
    bet: Bet,
    timelineYears: number,
    settings: UserSettings | null | undefined
): number | null {
    // Use override if set
    if (bet.downside_override !== undefined && bet.downside_override !== null) {
        return bet.downside_override;
    }
    // Auto-calculate from timeline
    return calculateDownside(timelineYears, settings);
}

/**
 * Get effective confidence (computed or manual)
 * Priority: computed_confidence > manual confidence > default 50
 */
export function getEffectiveConfidence(bet: Bet): number {
    // Prefer computed confidence if available
    if (bet.computed_confidence !== undefined && bet.computed_confidence !== null) {
        return bet.computed_confidence;
    }
    return bet.confidence ?? 50;
}

/**
 * Check if confidence is auto-calculated (vs manually set)
 */
export function isComputedConfidence(bet: Bet): boolean {
    return bet.computed_confidence !== undefined && bet.computed_confidence !== null;
}

/**
 * Check if downside is overridden (vs auto-calculated)
 */
export function isOverriddenDownside(bet: Bet): boolean {
    return bet.downside_override !== undefined && bet.downside_override !== null;
}

/**
 * Auto-calculate upside multiplier from timeline and confidence
 *
 * Formula: upside = base × risk_premium × time_premium
 * - base_multiplier = 5 (baseline 5x return expectation)
 * - risk_premium = (100 / confidence)^0.5
 *   - 50% confidence → 1.41x premium
 *   - 70% confidence → 1.20x premium
 *   - 90% confidence → 1.05x premium
 * - time_premium = timeline_years^0.3
 *   - 0.5 years → 0.87x
 *   - 1 year → 1.0x
 *   - 3 years → 1.39x
 *   - 5 years → 1.62x
 *
 * Examples:
 * - High confidence, short timeline (70% conf, 0.5yr): 5 × 1.20 × 0.87 = 5.2x
 * - Medium confidence, medium timeline (60% conf, 1yr): 5 × 1.29 × 1.0 = 6.5x
 * - Low confidence, long timeline (50% conf, 3yr): 5 × 1.41 × 1.39 = 9.8x
 */
export function calculateAutoUpside(
    timelineYears: number,
    confidence: number
): number {
    const BASE_MULTIPLIER = 5; // Baseline 5x return expectation

    // Ensure valid inputs
    const validTimeline = Math.max(timelineYears, 0.1);
    const validConfidence = Math.max(Math.min(confidence, 100), 10); // Clamp between 10-100

    // Risk premium: Lower confidence requires higher upside
    const riskPremium = Math.pow(100 / validConfidence, 0.5);

    // Time premium: Longer timeline requires higher upside to compensate
    const timePremium = Math.pow(validTimeline, 0.3);

    const calculatedUpside = BASE_MULTIPLIER * riskPremium * timePremium;

    // Round to nearest 0.5x for cleaner numbers
    return Math.round(calculatedUpside * 2) / 2;
}
