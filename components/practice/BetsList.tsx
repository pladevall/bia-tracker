'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Bet, Belief, BoldTake } from '@/lib/practice/types';
import { calculateBetScore } from '@/lib/practice/bet-scoring';
import BetCard from './BetCard';
import BetForm from './BetForm';

interface BetsListProps {
    bets: Bet[];
    beliefs: Belief[];
    boldTakes: BoldTake[];
    onRefresh?: () => void;
}

export default function BetsList({ bets, beliefs, boldTakes, onRefresh }: BetsListProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBet, setEditingBet] = useState<Bet | null>(null);

    // Compute scores and sort
    const sortedBets = useMemo(() => {
        return [...bets]
            .map(bet => ({ ...bet, bet_score: bet.bet_score ?? calculateBetScore(bet) }))
            .sort((a, b) => (b.bet_score ?? 0) - (a.bet_score ?? 0));
    }, [bets]);

    // Unassigned items
    const unassignedBeliefs = useMemo(() => beliefs.filter(b => !b.bet_id), [beliefs]);
    const unassignedTakes = useMemo(() => boldTakes.filter(t => !t.bet_id), [boldTakes]);

    const handleCreateBet = useCallback(async (betData: Partial<Bet>) => {
        try {
            const res = await fetch('/api/practice/bets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(betData),
            });
            if (res.ok) {
                setIsFormOpen(false);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error creating bet:', error);
        }
    }, [onRefresh]);

    const handleUpdateBet = useCallback(async (betData: Partial<Bet>) => {
        if (!editingBet) return;
        try {
            const res = await fetch(`/api/practice/bets/${editingBet.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(betData),
            });
            if (res.ok) {
                setEditingBet(null);
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error updating bet:', error);
        }
    }, [editingBet, onRefresh]);

    const handleDeleteBet = useCallback(async (betId: string) => {
        if (!confirm('Are you sure you want to delete this bet? Linked beliefs and actions will be unlinked.')) {
            return;
        }
        try {
            const res = await fetch(`/api/practice/bets/${betId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error deleting bet:', error);
        }
    }, [onRefresh]);

    const handleLinkBelief = useCallback(async (beliefId: string, betId: string) => {
        try {
            const res = await fetch(`/api/practice/beliefs/${beliefId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bet_id: betId }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error linking belief:', error);
        }
    }, [onRefresh]);

    const handleLinkBoldTake = useCallback(async (boldTakeId: string, betId: string) => {
        try {
            const res = await fetch(`/api/practice/bold-takes/${boldTakeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bet_id: betId }),
            });
            if (res.ok) {
                onRefresh?.();
            }
        } catch (error) {
            console.error('Error linking bold take:', error);
        }
    }, [onRefresh]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Strategic Bets</h2>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                    + New Bet
                </button>
            </div>

            {/* Bets List */}
            <div className="grid grid-cols-1 gap-6">
                {sortedBets.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">No bets yet. Create your first strategic bet.</p>
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                            Create Bet
                        </button>
                    </div>
                ) : (
                    sortedBets.map((bet, index) => {
                        const linkedBeliefs = beliefs.filter(b => b.bet_id === bet.id);
                        const linkedTakes = boldTakes.filter(t => t.bet_id === bet.id);

                        // Show unassigned items under first bet as fallback
                        const displayBeliefs = index === 0 ? [...linkedBeliefs, ...unassignedBeliefs] : linkedBeliefs;
                        const displayTakes = index === 0 ? [...linkedTakes, ...unassignedTakes] : linkedTakes;

                        return (
                            <BetCard
                                key={bet.id}
                                bet={bet}
                                beliefs={displayBeliefs}
                                boldTakes={displayTakes}
                                allBets={sortedBets}
                                unassignedBeliefs={unassignedBeliefs}
                                unassignedTakes={unassignedTakes}
                                onEdit={() => setEditingBet(bet)}
                                onDelete={() => handleDeleteBet(bet.id)}
                                onLinkBelief={handleLinkBelief}
                                onLinkBoldTake={handleLinkBoldTake}
                            />
                        );
                    })
                )}
            </div>

            {/* Create Bet Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                Create New Bet
                            </h3>
                            <BetForm
                                onSave={handleCreateBet}
                                onCancel={() => setIsFormOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Bet Modal */}
            {editingBet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                Edit Bet
                            </h3>
                            <BetForm
                                bet={editingBet}
                                onSave={handleUpdateBet}
                                onCancel={() => setEditingBet(null)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
