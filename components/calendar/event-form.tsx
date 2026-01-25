'use client';

import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';
import { CalendarCategoryKey } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface EventFormProps {
    title: string;
    setTitle: (title: string) => void;
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    category: CalendarCategoryKey;
    setCategory: (category: CalendarCategoryKey) => void;
    notes: string;
    setNotes: (notes: string) => void;
    isEditMode?: boolean;
    disabled?: boolean;
}

export function EventForm({
    title,
    setTitle,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    category,
    setCategory,
    notes,
    setNotes,
    isEditMode = false,
    disabled = false,
}: EventFormProps) {
    return (
        <div className="space-y-5">
            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {isEditMode ? 'Event Title' : 'What made today great?'}
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isEditMode ? 'Event title' : 'e.g. Shipped the MVP'}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700"
                    autoFocus
                    disabled={disabled}
                />
            </div>

            {/* Date Inputs - Show in both edit and batch mode */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        Start Date
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700"
                        disabled={disabled}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        End Date
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700"
                        disabled={disabled}
                    />
                </div>
            </div>

            {/* Category */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Category</label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.values(CALENDAR_CATEGORIES).map((cat, idx) => (
                        <button
                            key={cat.key}
                            onClick={() => setCategory(cat.key)}
                            disabled={disabled}
                            title={`Press ⌘${idx + 1} to select`}
                            className={cn(
                                "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all border",
                                category === cat.key
                                    ? cn(cat.color, cat.borderColor, "border")
                                    : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <div className={cn("w-2.5 h-2.5 rounded-full", cat.dotColor)} />
                                <span className={cn("font-medium", category === cat.key ? cat.textColor : "")}>{cat.label}</span>
                            </div>
                            <span className={cn("text-xs font-normal", category === cat.key ? cat.textColor : "text-gray-500 dark:text-gray-600")}>{idx + 1}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Notes <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add details about this event..."
                    rows={3}
                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700 resize-none"
                    disabled={disabled}
                />
            </div>
        </div>
    );
}
