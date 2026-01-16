import { createClient } from '@/lib/supabase/server';
import { YearGrid } from '@/components/calendar/year-grid';
import { DesktopGuard } from '@/components/calendar/desktop-guard';
import { CalendarProvider } from '@/components/calendar/calendar-context';
import { EventModal } from '@/components/calendar/event-modal';
import ThemeToggle from '@/components/ThemeToggle';

export default async function CalendarPage() {
    // Server-side fetch without Auth check (Public Access)
    const supabase = await createClient();

    // Fetch all events for public display
    const { data: events } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_date', { ascending: true });

    return (
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors">
            <DesktopGuard>
                <CalendarProvider initialEvents={events || []}>
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col flex-1 min-h-0">
                        {/* Header matching exactly app/page.tsx */}
                        <header className="flex items-center justify-between mb-6 flex-shrink-0">
                            <div>
                                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">2026</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Year at a Glance
                                </p>
                            </div>
                            <ThemeToggle />
                        </header>

                        {/* Content Card matching main app section style */}
                        <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col flex-1 min-h-0">
                            <div className="overflow-x-auto flex-1">
                                <YearGrid />
                            </div>
                        </section>

                        <EventModal />
                    </div>
                </CalendarProvider>
            </DesktopGuard>
        </div>
    );
}
