'use client';

import { useState, useMemo } from 'react';
import type { Bet, Belief, BoldTake } from '@/lib/practice/types';
import { calculateBetScore, getScoreColor, getScoreLabel } from '@/lib/practice/bet-scoring';

interface BetCardProps {
    bet: Bet;
    beliefs: Belief[];
    boldTakes: BoldTake[];
    allBets?: Bet[];
    unassignedBeliefs?: Belief[];
    unassignedTakes?: BoldTake[];
    onEdit?: () => void;
    onDelete?: () => void;
    onLinkBelief?: (beliefId: string, betId: string) => void;
    onLinkBoldTake?: (boldTakeId: string, betId: string) => void;
}

export default function BetCard({
    bet,
    beliefs,
    boldTakes,
    allBets = [],
    unassignedBeliefs = [],
    unassignedTakes = [],
    onEdit,
    onDelete,
    onLinkBelief,
    onLinkBoldTake,
}: BetCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLinkMenu, setShowLinkMenu] = useState<'belief' | 'action' | null>(null);

    // Calculate bet score
    const score = useMemo(() => bet.bet_score ?? calculateBetScore(bet), [bet]);
    const scoreColor = getScoreColor(score);
    const scoreLabel = getScoreLabel(score);

    // Confidence color (0-100 scale: Red < 50, Yellow 50-80, Green >= 80)
    const confidenceColor = bet.confidence >= 80 ? 'text-green-500' :
        bet.confidence >= 50 ? 'text-yellow-500' : 'text-red-500';

    // Status badge styling
    const statusStyles = {
        active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            {/* Bet Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{bet.name}</h3>
                            {/* Bet Score Badge */}
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-gray-800 ${scoreColor}`}>
                                {score.toFixed(2)} · {scoreLabel}
                            </span>
                        </div>
                        {bet.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{bet.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[bet.status]}`}>
                            {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                        </span>
                        {/* Actions Menu */}
                        {(onEdit || onDelete) && (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const menu = e.currentTarget.nextElementSibling;
                                        menu?.classList.toggle('hidden');
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                </button>
                                <div className="hidden absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                                    {onEdit && (
                                        <button
                                            onClick={onEdit}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            Edit
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            onClick={onDelete}
                                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sizing Framework Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Upside</label>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{bet.upside}</div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Confidence</label>
                        <div className={`font-semibold ${confidenceColor}`}>{bet.confidence}%</div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Timeline</label>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{bet.timeline || '-'}</div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Downside</label>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{bet.downside ? `$${bet.downside.toLocaleString()}` : '-'}</div>
                    </div>
                </div>

            </div>

            {/* Expander */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 py-2 border-t border-gray-100 dark:border-gray-800"
            >
                {isExpanded ? 'Collapse' : `View ${beliefs.length} Beliefs & ${boldTakes.length} Actions`}
                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Beliefs Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <span>Beliefs</span>
                            </h4>
                            {onLinkBelief && unassignedBeliefs.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLinkMenu(showLinkMenu === 'belief' ? null : 'belief')}
                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                                    >
                                        + Link Belief
                                    </button>
                                    {showLinkMenu === 'belief' && (
                                        <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                            {unassignedBeliefs.map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => {
                                                        onLinkBelief(b.id, bet.id);
                                                        setShowLinkMenu(null);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                                                >
                                                    {b.belief}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            {beliefs.map(belief => (
                                <div key={belief.id} className="text-sm p-3 bg-gray-50 dark:bg-gray-800 rounded border-l-2 border-indigo-500 dark:border-indigo-400">
                                    <p className="text-gray-800 dark:text-gray-200">{belief.belief}</p>
                                    <span className="text-xs text-gray-500 mt-1 block capitalize">Status: {belief.status}</span>
                                </div>
                            ))}
                            {beliefs.length === 0 && <p className="text-xs text-gray-400 italic">No beliefs linked yet.</p>}
                        </div>
                    </div>

                    {/* Actions Section */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <span>Actions</span>
                            </h4>
                            {onLinkBoldTake && unassignedTakes.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLinkMenu(showLinkMenu === 'action' ? null : 'action')}
                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                                    >
                                        + Link Action
                                    </button>
                                    {showLinkMenu === 'action' && (
                                        <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                            {unassignedTakes.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        onLinkBoldTake(t.id, bet.id);
                                                        setShowLinkMenu(null);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                                                >
                                                    {t.description}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            {boldTakes.slice(0, 5).map(take => (
                                <div key={take.id} className="flex justify-between items-center text-sm p-2 border border-gray-100 dark:border-gray-800 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <span className="text-gray-700 dark:text-gray-300">{take.description}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full
                                        ${take.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            take.status === 'skipped' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {take.status}
                                    </span>
                                </div>
                            ))}
                            {boldTakes.length === 0 && <p className="text-xs text-gray-400 italic">No actions recorded yet.</p>}
                            {boldTakes.length > 5 && (
                                <p className="text-xs text-gray-400 text-center">+{boldTakes.length - 5} more actions</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
