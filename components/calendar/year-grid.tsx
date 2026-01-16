'use client';

import { useMemo } from 'react';
import { eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { MonthRow } from './month-row';
import { useCalendar } from './calendar-context';

export function YearGrid() {
    const { events } = useCalendar(); // Consume from context

    const year = 2026;
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));

    const months = useMemo(() => {
        return eachMonthOfInterval({ start, end });
    }, [start, end]);

    return (
        <div className="min-w-[1000px] w-full h-full flex flex-col gap-0 overflow-x-hidden">
            {/* Min-width ensures grid doesn't squash too much on mobile */}
            <div className="flex flex-col gap-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm flex-1">
                {months.map((month) => (
                    <MonthRow
                        key={month.toISOString()}
                        month={month}
                        events={events} // Pass ALL events for MonthRow to filter/pack efficiently
                    />
                ))}
            </div>
        </div>
    );
}
