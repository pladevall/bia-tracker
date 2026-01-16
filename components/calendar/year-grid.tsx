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

    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="min-w-[1000px] w-full h-full flex flex-col gap-0 overflow-x-hidden">
            {/* Min-width ensures grid doesn't squash too much on mobile */}
            <div className="flex flex-col gap-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm flex-1">
                {/* Day of Week Header */}
                <div className="flex w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    {/* Month label column spacer */}
                    <div className="w-24 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />

                    {/* Day of week headers */}
                    <div className="flex-1 grid grid-cols-[repeat(31,minmax(0,1fr))]">
                        {Array.from({ length: 31 }).map((_, dayOfMonth) => {
                            const dayOfWeek = daysOfWeek[dayOfMonth % 7];
                            return (
                                <div
                                    key={dayOfMonth}
                                    className="flex items-center justify-center border-r border-gray-200 dark:border-gray-700 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest"
                                >
                                    {dayOfWeek}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Month rows */}
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
