'use client';

import { useState, useEffect } from 'react';
import { CalendarProvider } from './calendar-context';
import { YearGrid } from './year-grid';
import { EventModal } from './event-modal';
import { BatchInputMode } from './batch-input-mode';
import ThemeToggle from '@/components/ThemeToggle';
import { CalendarEvent } from '@/types/calendar';
import { Plus } from 'lucide-react';

interface CalendarPageClientProps {
    initialEvents: CalendarEvent[];
}

export function CalendarPageClient({ initialEvents }: CalendarPageClientProps) {
    const [batchModeOpen, setBatchModeOpen] = useState(false);

    // Add keyboard shortcut for batch mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                setBatchModeOpen(prev => !prev);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <CalendarProvider initialEvents={initialEvents}>
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col flex-1 min-h-0">
                {/* Header matching exactly app/page.tsx */}
                <header className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">2026</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Year at a Glance
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setBatchModeOpen(true)}
                            title="Batch input mode (Cmd+Shift+B)"
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Plus size={16} />
                            Batch Add
                        </button>
                        <ThemeToggle />
                    </div>
                </header>

                {/* Content Card matching main app section style */}
                <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="overflow-x-auto flex-1">
                        <YearGrid />
                    </div>
                </section>

                <EventModal />
                <BatchInputMode
                    isOpen={batchModeOpen}
                    onClose={() => setBatchModeOpen(false)}
                />
            </div>
        </CalendarProvider>
    );
}
