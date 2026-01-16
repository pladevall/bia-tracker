'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { createClient } from '@/lib/supabase/client';

interface CalendarContextType {
    // Drag Selection
    isDragging: boolean;
    selectionStart: Date | null;
    selectionEnd: Date | null;
    setSelectionStart: (date: Date | null) => void;
    setSelectionEnd: (date: Date | null) => void;
    setIsDragging: (isDragging: boolean) => void;

    // Modal
    isModalOpen: boolean;
    openModal: (event?: CalendarEvent) => void;
    closeModal: () => void;

    // Modal Data
    modalStartDate: Date | null;
    modalEndDate: Date | null;
    setModalDateRange: (start: Date, end: Date) => void;
    selectedEvent: CalendarEvent | null;

    // Data Management
    events: CalendarEvent[];
    refreshEvents: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children, initialEvents }: { children: ReactNode, initialEvents: CalendarEvent[] }) {
    // State
    const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<Date | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStartDate, setModalStartDate] = useState<Date | null>(null);
    const [modalEndDate, setModalEndDate] = useState<Date | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Sync if initialEvents changes (e.g. revalidation)
    useEffect(() => {
        setEvents(initialEvents);
    }, [initialEvents]);

    const refreshEvents = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from('calendar_events')
            .select('*')
            .order('start_date', { ascending: true });

        if (data) {
            setEvents(data);
        }
    }

    const setModalDateRange = (start: Date, end: Date) => {
        setModalStartDate(start);
        setModalEndDate(end);
    };

    const openModal = (event?: CalendarEvent) => {
        if (event) {
            // Opening existing event for editing
            setSelectedEvent(event);
            setModalStartDate(new Date(event.start_date));
            setModalEndDate(new Date(event.end_date));
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setModalStartDate(null);
        setModalEndDate(null);
        setSelectionStart(null);
        setSelectionEnd(null);
        setSelectedEvent(null);
    };

    return (
        <CalendarContext.Provider value={{
            isDragging,
            setIsDragging,
            selectionStart,
            setSelectionStart,
            selectionEnd,
            setSelectionEnd,
            isModalOpen,
            openModal,
            closeModal,
            modalStartDate,
            modalEndDate,
            setModalDateRange,
            selectedEvent,
            events,
            refreshEvents
        }}>
            {children}
        </CalendarContext.Provider>
    );
}

export function useCalendar() {
    const context = useContext(CalendarContext);
    if (context === undefined) {
        throw new Error('useCalendar must be used within a CalendarProvider');
    }
    return context;
}
