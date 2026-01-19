'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarProvider, useCalendar } from './calendar-context';
import { YearGrid } from './year-grid';
import { EventModal } from './event-modal';
import { BatchInputMode } from './batch-input-mode';
import ThemeToggle from '@/components/ThemeToggle';
import { CalendarEvent } from '@/types/calendar';
import { Plus, Home, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarPageClientProps {
    initialEvents: CalendarEvent[];
}

interface CalendarPageContentProps {
    batchModeOpen: boolean;
    setBatchModeOpen: (open: boolean) => void;
}

function CalendarPageContent({ batchModeOpen, setBatchModeOpen }: CalendarPageContentProps) {
    const { isWideMode, toggleWideMode } = useCalendar();

    // Wide mode keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Option + W for wide mode
            if (e.altKey && (e.key === 'w' || e.key === 'W' || e.key === '∑')) {
                e.preventDefault();
                toggleWideMode();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toggleWideMode]);

    return (
        <div className={cn(
            "mx-auto flex flex-col flex-1 min-h-0 transition-all duration-300",
            isWideMode ? "w-full px-2 py-2" : "max-w-7xl px-3 sm:px-4 py-3 sm:py-4"
        )}>
            {/* Header matching exactly app/page.tsx */}
            <header className={cn(
                "flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0",
                isWideMode && "pl-2"
            )}>
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
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                    <button
                        onClick={toggleWideMode}
                        title={isWideMode ? "Normal view (Option+W)" : "Wide view (Option+W)"}
                        className={cn(
                            "p-2 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800",
                            isWideMode && "bg-gray-100 dark:bg-gray-800"
                        )}
                    >
                        {isWideMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <ThemeToggle />
                    <Link
                        href="/"
                        title="Go to Baseline (Cmd+Shift+C)"
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <Home size={18} />
                    </Link>
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
    );
}

export function CalendarPageClient({ initialEvents }: CalendarPageClientProps) {
    const [batchModeOpen, setBatchModeOpen] = useState(false);
    const router = useRouter();

    // Add keyboard shortcuts (Batch mode and navigation - outside of context)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+Shift+B for batch mode
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                setBatchModeOpen(prev => !prev);
            }
            // Cmd+Shift+C to toggle between Baseline and Calendar
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                router.push('/');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    return (
        <CalendarProvider initialEvents={initialEvents}>
            <CalendarPageContent
                batchModeOpen={batchModeOpen}
                setBatchModeOpen={setBatchModeOpen}
            />
        </CalendarProvider>
    );
}
