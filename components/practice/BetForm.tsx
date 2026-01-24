'use client';

import { useState, useCallback } from 'react';
import type { Bet } from '@/lib/practice/types';
import { UPSIDE_OPTIONS } from '@/lib/practice/types';
import { formatCurrency } from '@/lib/practice/formatting';

interface BetFormProps {
    bet?: Bet | null;
    onSave: (bet: Partial<Bet>) => Promise<void>;
    onCancel: () => void;
}

export default function BetForm({ bet, onSave, onCancel }: BetFormProps) {
    const [name, setName] = useState(bet?.name || '');
    const [description, setDescription] = useState(bet?.description || '');
    const [upside, setUpside] = useState(bet?.upside || UPSIDE_OPTIONS[0].label);
    const [timeline, setTimeline] = useState(bet?.timeline || '');
    const [downsideOverride, setDownsideOverride] = useState(String(bet?.downside_override || ''));
    const [status, setStatus] = useState<'active' | 'paused' | 'closed'>(bet?.status || 'active');
    const [isSaving, setIsSaving] = useState(false);

    // Get multiplier from selected upside option
    const selectedOption = UPSIDE_OPTIONS.find(o => o.label === upside);
    const upsideMultiplier = selectedOption?.multiplier || 1;

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            // Parse downside_override as number, handling various input formats
            let downsideOverrideNumber: number | undefined | null;
            if (downsideOverride.trim()) {
                const parsed = parseFloat(downsideOverride.replace(/[^0-9.-]/g, ''));
                downsideOverrideNumber = isNaN(parsed) ? null : parsed;
            } else {
                downsideOverrideNumber = null;
            }

            await onSave({
                name: name.trim(),
                description: description.trim() || undefined,
                upside,
                upside_multiplier: upsideMultiplier,
                timeline: timeline.trim() || undefined,
                downside_override: downsideOverrideNumber,
                status,
            });
        } finally {
            setIsSaving(false);
        }
    }, [name, description, upside, upsideMultiplier, timeline, downsideOverride, status, onSave]);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bet Name *
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Index (Startup)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this bet about?"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
            </div>

            {/* Sizing Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Upside */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Upside Potential *
                    </label>
                    <select
                        value={upside}
                        onChange={(e) => setUpside(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                        {UPSIDE_OPTIONS.map((option) => (
                            <option key={option.label} value={option.label}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Timeline - Read-only note */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Timeline
                    </label>
                    <div className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Auto-calculated from actions
                        </p>
                    </div>
                </div>
            </div>

            {/* Auto-calculated Fields Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Confidence:</strong> Auto-calculated from linked beliefs and actions (weighted by duration).
                    Once you add beliefs and actions, confidence will update automatically.
                </div>
            </div>

            {/* Downside Override */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Downside Override (Optional)
                </label>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={downsideOverride}
                            onChange={(e) => setDownsideOverride(e.target.value)}
                            placeholder="Leave blank for auto-calculated value"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                    </div>
                    {downsideOverride && (
                        <div className="flex items-center px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm font-medium">
                            {formatCurrency(parseFloat(downsideOverride.replace(/[^0-9.-]/g, '')) || undefined)}
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Auto-calculated as: timeline_years × annual_salary. Enter a number to override (e.g., 1500000 for $1.5M)
                </p>
            </div>

            {/* Status (only show for edits) */}
            {bet && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                    </label>
                    <div className="flex gap-4">
                        {(['active', 'paused', 'closed'] as const).map((s) => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="status"
                                    value={s}
                                    checked={status === s}
                                    onChange={() => setStatus(s)}
                                    className="text-indigo-500 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{s}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!name.trim() || isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                    {isSaving ? 'Saving...' : bet ? 'Update Bet' : 'Create Bet'}
                </button>
            </div>
        </form>
    );
}
