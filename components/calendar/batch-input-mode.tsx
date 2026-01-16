'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { CalendarCategoryKey } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useCalendar } from './calendar-context';
import { EventForm } from './event-form';
import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';

interface BatchInputModeProps {
    isOpen: boolean;
    onClose: () => void;
    onEventCreated?: () => void;
}

interface BatchEvent {
    title: string;
    category: CalendarCategoryKey;
    startDate: string;
    endDate: string;
}

export function BatchInputMode({ isOpen, onClose, onEventCreated }: BatchInputModeProps) {
    const { refreshEvents } = useCalendar();
    const [events, setEvents] = useState<BatchEvent[]>([]);
    const [currentEvent, setCurrentEvent] = useState<BatchEvent>({
        title: '',
        category: 'deep_work',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    const [isSaving, setIsSaving] = useState(false);

    // Keyboard shortcut to toggle batch mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'b') {
                e.preventDefault();
                if (!isOpen) {
                    // Open batch mode
                } else {
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleAddEvent = async () => {
        if (!currentEvent.title.trim()) return;

        setIsSaving(true);
        const supabase = createClient();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('calendar_events').insert({
                title: currentEvent.title.trim(),
                category: currentEvent.category,
                start_date: currentEvent.startDate,
                end_date: currentEvent.endDate,
                user_id: user?.id,
            });

            if (!error) {
                // Add to local list and reset form
                setEvents([...events, currentEvent]);
                setCurrentEvent({
                    title: '',
                    category: 'deep_work',
                    startDate: format(new Date(), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                });
                await refreshEvents();
                onEventCreated?.();
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveEvent = (index: number) => {
        setEvents(events.filter((_, i) => i !== index));
    };

    const handleClose = async () => {
        await refreshEvents();
        setEvents([]);
        setCurrentEvent({
            title: '',
            category: 'deep_work',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Batch Event Input
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Create multiple events quickly. Press Escape or click X to finish.
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Created events list */}
                {events.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg">
                        <p className="text-sm font-medium text-green-900 dark:text-green-400 mb-2">
                            ✓ {events.length} event{events.length !== 1 ? 's' : ''} created
                        </p>
                        <div className="space-y-1">
                            {events.map((evt, idx) => {
                                const cat = CALENDAR_CATEGORIES[evt.category];
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between text-xs text-green-800 dark:text-green-300 bg-white dark:bg-gray-800/50 p-2 rounded"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", cat.dotColor)} />
                                            <span>{evt.title}</span>
                                            <span className="text-green-700 dark:text-green-400">
                                                {format(new Date(evt.startDate), 'MMM d')}
                                                {evt.startDate !== evt.endDate && ` - ${format(new Date(evt.endDate), 'MMM d')}`}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveEvent(idx)}
                                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Input form */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                        New Event {events.length > 0 && `(${events.length + 1})`}
                    </h3>

                    <EventForm
                        title={currentEvent.title}
                        setTitle={(title) => setCurrentEvent({ ...currentEvent, title })}
                        startDate={currentEvent.startDate}
                        setStartDate={(startDate) => setCurrentEvent({ ...currentEvent, startDate })}
                        endDate={currentEvent.endDate}
                        setEndDate={(endDate) => setCurrentEvent({ ...currentEvent, endDate })}
                        category={currentEvent.category}
                        setCategory={(category) => setCurrentEvent({ ...currentEvent, category })}
                        disabled={isSaving}
                    />

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-5">
                        <button
                            onClick={handleAddEvent}
                            disabled={!currentEvent.title.trim() || isSaving}
                            className="flex-1 bg-gray-800 dark:bg-gray-700 text-white font-medium py-2.5 rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                        >
                            {isSaving ? 'Adding...' : `Add Event (⏎)`}
                        </button>
                        <button
                            onClick={handleClose}
                            className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Done (Esc)
                        </button>
                    </div>
                </div>

                {/* Help text */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded text-xs text-blue-900 dark:text-blue-400">
                    <strong>Tips:</strong> Press Enter to quickly add an event. Use keyboard shortcuts: ⌘1-4 to change category, Escape to finish.
                </div>
            </div>
        </div>
    );
}
