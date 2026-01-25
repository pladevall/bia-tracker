'use client';

import { useState, useCallback } from 'react';
import type { Bet } from '@/lib/practice/types';
import { UPSIDE_OPTIONS } from '@/lib/practice/types';

interface BetFormProps {
    bet?: Bet | null;
    onSave: (bet: Partial<Bet>) => Promise<void>;
    onCancel: () => void;
}

export default function BetForm({ bet, onSave, onCancel }: BetFormProps) {
    const [name, setName] = useState(bet?.name || '');
    const [description, setDescription] = useState(bet?.description || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            const payload: Partial<Bet> = {
                name: name.trim(),
                description: description.trim() || undefined,
            };

            if (!bet) {
                const defaultUpside = UPSIDE_OPTIONS[0];
                payload.upside = defaultUpside.label;
                payload.upside_multiplier = defaultUpside.multiplier;
                payload.confidence = 50;
                payload.status = 'active';
            }

            await onSave(payload);
        } finally {
            setIsSaving(false);
        }
    }, [name, description, bet, onSave]);

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
