'use client';

import { useState, useCallback } from 'react';
import type { Belief, BeliefStatus } from '@/lib/practice/types';

interface BeliefsGridProps {
    beliefs: Belief[];
    onUpdateBelief: (id: string, updates?: Partial<Belief>) => Promise<void>;
    onAddBelief: (belief: string) => Promise<void>;
}

const STATUS_CONFIG: Record<BeliefStatus, { bg: string; text: string; label: string }> = {
    untested: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', label: 'Untested' },
    testing: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: 'Testing' },
    proven: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: 'Proven' },
    disproven: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: 'Disproven' },
};

const STATUS_ORDER: BeliefStatus[] = ['testing', 'untested', 'proven', 'disproven'];

export default function BeliefsGrid({ beliefs, onUpdateBelief, onAddBelief }: BeliefsGridProps) {
    const [newBelief, setNewBelief] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEvidence, setEditEvidence] = useState('');
    const [editConfidence, setEditConfidence] = useState<number>(50);

    const sortedBeliefs = [...beliefs].sort((a, b) => {
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    });

    const handleAddBelief = useCallback(async () => {
        if (!newBelief.trim()) return;
        await onAddBelief(newBelief.trim());
        setNewBelief('');
    }, [newBelief, onAddBelief]);

    const handleStatusChange = useCallback(async (id: string, newStatus: BeliefStatus) => {
        await onUpdateBelief(id, { status: newStatus });
    }, [onUpdateBelief]);

    const handleSaveEvidence = useCallback(async (id: string) => {
        await onUpdateBelief(id, { evidence: editEvidence });
        setEditingId(null);
        setEditEvidence('');
    }, [editEvidence, onUpdateBelief]);

    const handleSaveConfidence = useCallback(async (id: string, confidence: number) => {
        await onUpdateBelief(id, { confidence });
    }, [onUpdateBelief]);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Beliefs</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {beliefs.length} tracked
                </span>
            </div>

            {/* Add Belief Form */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newBelief}
                    onChange={(e) => setNewBelief(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBelief()}
                    placeholder="Add a belief to test..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 transition-colors outline-none"
                />
                <button
                    onClick={handleAddBelief}
                    disabled={!newBelief.trim()}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                    Add
                </button>
            </div>

            {/* Beliefs List - Full Width */}
            {sortedBeliefs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No beliefs yet. Complete a daily practice to auto-add beliefs.
                </p>
            ) : (
                <div className="space-y-2">
                    {sortedBeliefs.map((belief) => {
                        const config = STATUS_CONFIG[belief.status];
                        const isEditing = editingId === belief.id;

                        return (
                            <div
                                key={belief.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <p className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                                        {belief.belief}
                                    </p>
                                    <div className="flex-shrink-0 flex gap-2">
                                        {/* Confidence Display */}
                                        <div className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                                            {belief.confidence ?? 50}%
                                        </div>
                                        {/* Status Dropdown */}
                                        <select
                                            value={belief.status}
                                            onChange={(e) => handleStatusChange(belief.id, e.target.value as BeliefStatus)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md border-0 cursor-pointer appearance-none pr-7 ${config.bg} ${config.text}`}
                                            style={{
                                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                                backgroundPosition: 'right 0.25rem center',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundSize: '1.25rem 1.25rem',
                                            }}
                                        >
                                            <option value="untested">Untested</option>
                                            <option value="testing">Testing</option>
                                            <option value="proven">Proven</option>
                                            <option value="disproven">Disproven</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Confidence Slider */}
                                <div className="mb-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={belief.confidence ?? 50}
                                        onChange={(e) => handleSaveConfidence(belief.id, parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Confidence: {belief.confidence ?? 50}%
                                    </p>
                                </div>

                                {isEditing ? (
                                    <div className="mt-2">
                                        <textarea
                                            value={editEvidence}
                                            onChange={(e) => setEditEvidence(e.target.value)}
                                            placeholder="Add evidence..."
                                            className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 resize-none focus:ring-1 focus:ring-gray-400/30 outline-none"
                                            rows={2}
                                        />
                                        <div className="flex gap-2 mt-1.5">
                                            <button
                                                onClick={() => handleSaveEvidence(belief.id)}
                                                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1.5">
                                        {belief.evidence && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                {belief.evidence}
                                            </p>
                                        )}
                                        <button
                                            onClick={() => {
                                                setEditingId(belief.id);
                                                setEditEvidence(belief.evidence || '');
                                            }}
                                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                        >
                                            {belief.evidence ? 'Edit evidence' : 'Add evidence'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
