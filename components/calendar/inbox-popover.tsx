'use client';

import { useState, useEffect, useRef } from 'react';
import { Inbox, Check, X, RefreshCw, Loader2 } from 'lucide-react';
import { InboxEvent } from '@/types/calendar';
import { getInboxEvents, acceptInboxEvent, rejectInboxEvent, seedInboxEvents } from '@/app/actions/calendar-inbox';
import { createClient } from '@/lib/supabase/client';
import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export function InboxPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [events, setEvents] = useState<InboxEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Fetch events on mount and when opening
    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const data = await getInboxEvents();
            setEvents(data);
        } catch (error) {
            console.error('Failed to fetch inbox events', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
        // Poll every minute for "automatic updates" simulation
        const interval = setInterval(fetchEvents, 60000);
        return () => clearInterval(interval);
    }, []);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleAccept = async (event: InboxEvent) => {
        // Optimistic update
        setEvents(prev => prev.filter(e => e.id !== event.id));
        try {
            await acceptInboxEvent(event);
        } catch (error) {
            console.error('Failed to accept event', error);
            // Revert on failure (could improve by refetching)
            fetchEvents();
        }
    };

    const handleReject = async (id: string) => {
        // Optimistic update
        setEvents(prev => prev.filter(e => e.id !== id));
        try {
            await rejectInboxEvent(id);
        } catch (error) {
            console.error('Failed to reject event', error);
            fetchEvents();
        }
    };

    const handleRefresh = async () => {
        setIsSimulating(true);
        try {
            // We don't pass access token because app logic infers user ID on server side
            await seedInboxEvents();
            await fetchEvents();
        } finally {
            setIsSimulating(false);
        }
    };

    const hasEvents = events.length > 0;

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative",
                    isOpen && "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200"
                )}
                title="Calendar Inbox"
            >
                <Inbox size={18} />
                {hasEvents && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-950" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-zinc-900/50">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Inbox
                        </h3>
                        {events.length > 0 && <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{events.length} pending</span>}
                        {isLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {events.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No pending events</p>
                                <button
                                    onClick={handleRefresh}
                                    disabled={isSimulating}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                                >
                                    {isSimulating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Check for new events
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {events.map((event) => {
                                    const categoryConfig = CALENDAR_CATEGORIES[event.category] || CALENDAR_CATEGORIES.other;

                                    return (
                                        <div key={event.id} className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={cn(
                                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                                            categoryConfig.dotColor
                                                        )} />
                                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                                                            {categoryConfig.label}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-0.5">
                                                        {event.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {format(parseISO(event.start_date), 'MMM d')}
                                                        {event.start_date !== event.end_date && ` – ${format(parseISO(event.end_date), 'MMM d')}`}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleAccept(event)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                                                        title="Accept"
                                                    >
                                                        <Check size={16} strokeWidth={2.5} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(event.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                        title="Dismiss"
                                                    >
                                                        <X size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
