/**
 * Kelly-inspired Bet Scoring
 * Calculates a score to rank strategic bets by expected value
 */

import type { Bet, Belief, BoldTake } from './types';
import { UPSIDE_OPTIONS } from './types';
import { getEffectiveConfidence, calculateAutoUpside, calculateBetTimeline } from './bet-calculations';

/**
 * Parse timeline string to approximate years
 * Examples: "5-7 Years" → 6, "18 months" → 1.5, "Ongoing" → 10
 */
export function parseTimelineYears(timeline?: string | null): number {
    if (!timeline) return 1;

    const lower = timeline.toLowerCase();

    // Handle "Ongoing" or perpetual
    if (lower.includes('ongoing') || lower.includes('perpetual') || lower.includes('forever')) {
        return 10; // Treat as long-term
    }

    // Handle months (e.g., "18 months", "6-12 months")
    const monthsMatch = lower.match(/(\d+)(?:\s*-\s*(\d+))?\s*months?/);
    if (monthsMatch) {
        const min = parseInt(monthsMatch[1]);
        const max = monthsMatch[2] ? parseInt(monthsMatch[2]) : min;
        return (min + max) / 2 / 12;
    }

    // Handle years (e.g., "5-7 Years", "3 years", "5-10 Years")
    const yearsMatch = lower.match(/(\d+)(?:\s*-\s*(\d+))?\s*years?/);
    if (yearsMatch) {
        const min = parseInt(yearsMatch[1]);
        const max = yearsMatch[2] ? parseInt(yearsMatch[2]) : min;
        return (min + max) / 2;
    }

    // Handle plain numbers
    const plainNumber = lower.match(/^(\d+)$/);
    if (plainNumber) {
        return parseInt(plainNumber[1]);
    }

    return 1; // Default to 1 year if unparseable
}

/**
 * Calculate bet score using simplified Kelly-inspired formula:
 * Score = (upside_multiplier × confidence/100) / timeline_years
 *
 * Higher score = better risk-adjusted bet
 * - Higher upside = higher score
 * - Higher confidence = higher score
 * - Longer timeline = lower score (discount for time)
 *
 * Note: If no manual upside_multiplier is set, uses auto-calculated upside
 * based on timeline and confidence.
 */
export function calculateBetScore(
    bet: Bet,
    linkedTakes?: BoldTake[],
    linkedBeliefs?: Belief[]
): number {
    // Use effective confidence (computed or manual)
    const confidence = getEffectiveConfidence(bet);

    // Get upside multiplier (manual or auto-calculated)
    let multiplier = bet.upside_multiplier;
    if (!multiplier) {
        // If no manual upside, calculate from timeline + confidence
        let timelineYears = parseTimelineYears(bet.timeline);

        // If we have linked actions, calculate timeline from them
        if (linkedTakes && linkedTakes.length > 0) {
            timelineYears = calculateBetTimeline(linkedBeliefs ?? [], linkedTakes);
        }

        multiplier = calculateAutoUpside(timelineYears, confidence);
    } else if (multiplier <= 0) {
        // Avoid zero or negative manual values
        multiplier = 1;
    }

    // Parse timeline
    let timelineYears = parseTimelineYears(bet.timeline);
    if (linkedTakes && linkedTakes.length > 0) {
        timelineYears = calculateBetTimeline(linkedBeliefs ?? [], linkedTakes);
    }

    // Avoid division by zero
    if (timelineYears <= 0) timelineYears = 1;

    // Score formula: (upside × confidence/100) / timeline
    const score = (multiplier * (confidence / 100)) / timelineYears;

    return Math.round(score * 100) / 100; // Round to 2 decimals
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): string {
    if (score >= 3) return 'text-green-500';
    if (score >= 1) return 'text-yellow-500';
    return 'text-red-500';
}

/**
 * Get score label
 */
export function getScoreLabel(score: number): string {
    if (score >= 5) return 'Excellent';
    if (score >= 3) return 'Strong';
    if (score >= 1) return 'Moderate';
    if (score >= 0.5) return 'Weak';
    return 'Poor';
}
