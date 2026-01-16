'use client';

import { useState } from 'react';
import { format, isToday, isWeekend, isSameDay, isMonday, getISOWeek } from 'date-fns';
import { CalendarEvent } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { useCalendar } from './calendar-context';
import { QuickEventMenu } from './quick-event-menu';

export interface PositionedEvent extends CalendarEvent {
    lane: number;
    isStart: boolean;
    isEnd: boolean;
    isContinuation: boolean;
}

interface DayCellProps {
    date: Date;
    month: Date;
    events: PositionedEvent[];
}

export function DayCell({ date, month, events }: DayCellProps) {
    const isCurrentDay = isToday(date);
    const isWeekendDay = isWeekend(date);
    const isMon = isMonday(date);
    const weekNum = getISOWeek(date);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const {
        isDragging,
        setIsDragging,
        selectionStart,
        setSelectionStart,
        selectionEnd,
        setSelectionEnd,
        openModal,
        setModalDateRange,
        refreshEvents,
    } = useCalendar();

    // Selection Logic
    const isSelected =
        selectionStart &&
        ((selectionEnd && date >= selectionStart && date <= selectionEnd) ||
            (!selectionEnd && isSameDay(date, selectionStart)) ||
            (selectionEnd && date <= selectionStart && date >= selectionEnd));

    const displaySelected = isDragging && isSelected;

    // Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setSelectionStart(date);
        setSelectionEnd(date);
    };

    const handleMouseEnter = () => {
        if (isDragging) {
            setSelectionEnd(date);
        }
    };

    const handleMouseUp = () => {
        if (isDragging && selectionStart) {
            setIsDragging(false);
            const start = selectionStart < date ? selectionStart : date;
            const end = selectionStart < date ? date : selectionStart;
            setModalDateRange(start, end);
            openModal();
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    return (
        <>
            <div
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                className={cn(
                "group/day relative border-r border-gray-100 dark:border-zinc-800/50 h-full flex flex-col items-center justify-start cursor-pointer select-none bg-background",
                // Minimum height for day cells
                "min-h-[40px]", // Reduced for compact view
                isWeekendDay && "bg-gray-50/30 dark:bg-zinc-900/30",
                !isDragging && "hover:bg-gray-50 dark:hover:bg-zinc-800/50",
                displaySelected && "bg-blue-500/20",
                isCurrentDay && "bg-orange-50/50 dark:bg-orange-900/10 ring-1 ring-inset ring-orange-500/50 z-10"
            )}
        >
            {/* Date Number */}
            <div className="w-full flex justify-between items-center px-1 pt-0.5">
                {isMon && (
                    <span className="text-[9px] font-mono text-gray-300 dark:text-zinc-700 pointer-events-none select-none">
                        W{weekNum}
                    </span>
                )}
                {/* Spacer if no week num */}
                {!isMon && <span />}

                <div className="flex items-center gap-0.5">
                    <span className={cn(
                        "text-[10px] font-medium text-gray-400 group-hover/day:text-foreground transition-colors pointer-events-none select-none",
                        isCurrentDay && "text-orange-600 dark:text-orange-400 font-bold",
                    )}>
                        {format(date, 'd')}
                    </span>
                    {isCurrentDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 pointer-events-none" />
                    )}
                </div>
            </div>
        </div>

        <QuickEventMenu
            date={date}
            isOpen={!!contextMenu}
            position={contextMenu || { x: 0, y: 0 }}
            onClose={() => setContextMenu(null)}
            onEventCreated={refreshEvents}
        />
        </>
    );
}
