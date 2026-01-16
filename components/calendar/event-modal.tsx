'use client';

import { useCalendar } from './calendar-context';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';
import { CalendarCategoryKey } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { X, Trash2 } from 'lucide-react';

export function EventModal() {
    const { isModalOpen, closeModal, modalStartDate, modalEndDate, selectedEvent, refreshEvents } = useCalendar();
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<CalendarCategoryKey>('deep_work');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Inject styles for date input calendar icon and picker
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            /* Calendar picker popover styling - force dark mode for modal */
            input[type="date"] {
                color-scheme: dark;
            }

            /* Calendar icon styling */
            input[type="date"]::-webkit-calendar-picker-indicator {
                filter: invert(1) brightness(0.9);
                cursor: pointer;
            }
            input[type="date"]::-webkit-calendar-picker-indicator:hover {
                filter: invert(1) brightness(1);
            }

            /* Webkit browsers (Chrome, Safari, Edge) */
            input[type="date"]::-webkit-datetime-edit {
                padding: 0.5rem;
            }

            input[type="date"]::-webkit-datetime-edit-fields-wrapper {
                padding: 0;
            }
        `;
        document.head.appendChild(style);
        return () => style.remove();
    }, []);

    // Sync state when modal opens
    useEffect(() => {
        if (isModalOpen && selectedEvent) {
            // Editing existing event
            setTitle(selectedEvent.title);
            setCategory(selectedEvent.category);
            setStartDate(selectedEvent.start_date);
            setEndDate(selectedEvent.end_date);
        } else if (isModalOpen && modalStartDate && modalEndDate) {
            // Creating new event
            setTitle('');
            setCategory('deep_work');
            setStartDate(format(modalStartDate, 'yyyy-MM-dd'));
            setEndDate(format(modalEndDate, 'yyyy-MM-dd'));
        }
        setDeleteConfirm(false);
    }, [isModalOpen, selectedEvent, modalStartDate, modalEndDate]);

    // Handle keyboard shortcuts
    useEffect(() => {
        if (!isModalOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape to close
            if (e.key === 'Escape') {
                closeModal();
                return;
            }

            // Ctrl/Cmd + Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (title.trim()) {
                    handleSave();
                }
                return;
            }

            // Alt/Cmd + number to select category
            if ((e.altKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                const categories = Object.keys(CALENDAR_CATEGORIES) as CalendarCategoryKey[];
                const index = parseInt(e.key) - 1;
                if (index < categories.length) {
                    setCategory(categories[index]);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, title, closeModal]);

    if (!isModalOpen || !startDate || !endDate) return null;

    const isEditMode = !!selectedEvent;

    const handleSave = async () => {
        setIsSaving(true);
        const supabase = createClient();

        try {
            // Validate dates
            if (new Date(startDate) > new Date(endDate)) {
                alert('Start date cannot be after end date');
                setIsSaving(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();

            const payload: any = {
                start_date: startDate,
                end_date: endDate,
                title,
                category,
            };

            if (isEditMode) {
                // Update existing event
                const { error } = await supabase
                    .from('calendar_events')
                    .update(payload)
                    .eq('id', selectedEvent.id);

                if (error) {
                    console.error('Error updating event:', error);
                    alert(`Failed to update event: ${error.message}`);
                } else {
                    await refreshEvents();
                    closeModal();
                }
            } else {
                // Create new event
                if (user) {
                    payload.user_id = user.id;
                }

                const { error } = await supabase
                    .from('calendar_events')
                    .insert(payload);

                if (error) {
                    console.error('Error saving event:', error);
                    alert(`Failed to save event: ${error.message}`);
                } else {
                    await refreshEvents();
                    closeModal();
                }
            }
        } catch (err) {
            console.error('Error:', err);
            alert('An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) {
            setDeleteConfirm(true);
            return;
        }

        setIsDeleting(true);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', selectedEvent!.id);

            if (error) {
                console.error('Error deleting event:', error);
                alert(`Failed to delete event: ${error.message}`);
            } else {
                await refreshEvents();
                closeModal();
            }
        } catch (err) {
            console.error('Error:', err);
            alert('An error occurred');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-6 rounded-lg w-full max-w-md shadow-xl transition-colors">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 tracking-wide">
                        {format(parseISO(startDate), 'MMM d, yyyy')}
                        {startDate !== endDate && ` – ${format(parseISO(endDate), 'MMM d, yyyy')}`}
                    </h2>
                    <button
                        onClick={closeModal}
                        className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        disabled={isSaving || isDeleting}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            {isEditMode ? 'Event Title' : 'What made today great?'}
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={isEditMode ? 'Event title' : 'e.g. Shipped the MVP'}
                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700"
                            autoFocus
                            disabled={isSaving || isDeleting}
                        />
                    </div>

                    {/* Date Inputs - Only show in edit mode */}
                    {isEditMode && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700"
                                    disabled={isSaving || isDeleting}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700"
                                    disabled={isSaving || isDeleting}
                                />
                            </div>
                        </div>
                    )}

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">Category</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(CALENDAR_CATEGORIES).map((cat, idx) => (
                                <button
                                    key={cat.key}
                                    onClick={() => setCategory(cat.key)}
                                    disabled={isSaving || isDeleting}
                                    title={`Press ⌘${idx + 1} to select`}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all border",
                                        category === cat.key
                                            ? cn(cat.color, cat.borderColor, "border") // Explicit border color from config
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

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isDeleting || !title.trim()}
                            className="flex-1 bg-gray-800 dark:bg-gray-700 text-white font-medium py-2.5 rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? 'Saving...' : isEditMode ? 'Update Event' : 'Save Event'}
                            <span className="text-xs font-normal text-gray-300 ml-1">(⌘⏎)</span>
                        </button>

                        {isEditMode && (
                            <button
                                onClick={handleDelete}
                                disabled={isSaving || isDeleting}
                                className={cn(
                                    "px-3 py-2.5 rounded-md font-medium transition-all flex items-center gap-2",
                                    deleteConfirm
                                        ? "bg-red-500/90 text-white hover:bg-red-600"
                                        : "bg-gray-700 dark:bg-gray-800 text-gray-300 dark:text-gray-400 hover:bg-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                                )}
                            >
                                <Trash2 size={16} />
                                {deleteConfirm ? 'Confirm' : 'Delete'}
                            </button>
                        )}
                    </div>

                    {deleteConfirm && isEditMode && (
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-md">
                            Click Delete again to confirm removal
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
