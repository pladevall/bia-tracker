/**
 * Bold Practice - Formatting Utilities
 * Pure client/server utilities for formatting display values
 */

/**
 * Format downside monetary value for display
 * Converts numeric dollars to formatted string
 * Examples: 1500000 -> "$1.5M" or "-$1.5M" (with showNegative=true)
 */
export function formatDownside(downside?: number | null, showNegative = false): string {
    if (downside === null || downside === undefined) return '-';

    const absValue = Math.abs(downside);
    const prefix = showNegative ? '-' : '';

    if (absValue >= 1_000_000) {
        return `${prefix}$${(absValue / 1_000_000).toFixed(1)}M`;
    } else if (absValue >= 1_000) {
        return `${prefix}$${(absValue / 1_000).toFixed(0)}k`;
    } else {
        return `${prefix}$${absValue.toFixed(0)}`;
    }
}

/**
 * Format currency/expected value for display
 * Converts numeric dollars to formatted string
 * Examples: 1500000 -> "$1.5M", 150000 -> "$150k"
 */
export function formatCurrency(value?: number | null): string {
    if (value === null || value === undefined) return '-';

    const absValue = Math.abs(value);

    if (absValue >= 1_000_000) {
        return `$${(absValue / 1_000_000).toFixed(1)}M`;
    } else if (absValue >= 1_000) {
        return `$${(absValue / 1_000).toFixed(0)}k`;
    } else {
        return `$${absValue.toFixed(0)}`;
    }
}
