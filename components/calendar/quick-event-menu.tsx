'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';
import { CalendarCategoryKey } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface QuickEventMenuProps {
    date: Date;
    isOpen: boolean;
    position: { x: number; y: number };
    onClose: () => void;
    onEventCreated: () => void;
}

export function QuickEventMenu({ date, isOpen, position, onClose, onEventCreated }: QuickEventMenuProps) {
    const [title, setTitle] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CalendarCategoryKey>('deep_work');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when menu opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Handle keyboard
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && title.trim()) {
                handleCreate();
            } else if (e.key >= '1' && e.key <= '4') {
                const categories = Object.keys(CALENDAR_CATEGORIES) as CalendarCategoryKey[];
                const idx = parseInt(e.key) - 1;
                if (idx < categories.length) {
                    setSelectedCategory(categories[idx]);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, title, onClose]);

    const handleCreate = async () => {
        if (!title.trim()) return;

        setIsSaving(true);
        const supabase = createClient();
        const dateStr = format(date, 'yyyy-MM-dd');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('calendar_events').insert({
                title: title.trim(),
                category: selectedCategory,
                start_date: dateStr,
                end_date: dateStr,
                user_id: user?.id,
            });

            if (!error) {
                setTitle('');
                onEventCreated();
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-40 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl p-3 w-64"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            {/* Quick input for event title */}
            <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title..."
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 mb-2 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600"
            />

            {/* Quick category selector */}
            <div className="grid grid-cols-2 gap-1 mb-2">
                {Object.values(CALENDAR_CATEGORIES).map((cat) => (
                    <button
                        key={cat.key}
                        onClick={() => setSelectedCategory(cat.key)}
                        className={cn(
                            "text-xs px-2 py-1 rounded transition-all border",
                            selectedCategory === cat.key
                                ? cn(cat.color, cat.borderColor)
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        )}
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full inline-block mr-1", cat.dotColor)} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Create button */}
            <button
                onClick={handleCreate}
                disabled={!title.trim() || isSaving}
                className="w-full bg-gray-800 dark:bg-gray-700 text-white text-sm font-medium py-1.5 rounded hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
                {isSaving ? 'Creating...' : 'Create (⏎)'}
            </button>

            {/* Help text */}
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2 text-center">
                {format(date, 'MMM d, yyyy')} • Press 1-4 for category
            </div>
        </div>
    );
}
