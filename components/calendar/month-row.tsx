'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { eachDayOfInterval, endOfMonth, startOfMonth, format, differenceInDays, getDay, getDaysInMonth, addDays, parseISO } from 'date-fns';
import { useDraggable } from '@dnd-kit/core';
import { DayCell } from './day-cell';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/types/calendar';
import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';
import { useCalendar } from './calendar-context';
import { useEventDrag } from './event-drag-context';

interface MonthRowProps {
    month: Date;
    monthIndex: number;
    events: CalendarEvent[];
    totalColumns: number;
}

interface PositionedEventStrip extends CalendarEvent {
    lane: number;
    startIndex: number;
    endIndex: number;
    columnSpan: number;
}

export function MonthRow({ month, monthIndex, events, totalColumns }: MonthRowProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { openModal } = useCalendar();
    const {
        activeEventId,
        activeType,
        previewDelta,
        registerMonth,
        justDragged
    } = useEventDrag();

    // Calculate offset (0=Sun, 1=Mon, ... 6=Sat)
    const offset = useMemo(() => getDay(startOfMonth(month)), [month]);
    const daysInMonth = getDaysInMonth(month);

    const days = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(month),
            end: endOfMonth(month),
        });
    }, [month]);

    // Register this month's info for coordinate calculation
    useEffect(() => {
        const updateRect = () => {
            if (containerRef.current) {
                registerMonth(monthIndex, {
                    month,
                    offset,
                    daysInMonth,
                    containerRect: containerRef.current.getBoundingClientRect(),
                });
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, [monthIndex, month, offset, daysInMonth, registerMonth]);

    // Calculate positioned events as horizontal strips
    const positionedEvents = useMemo(() => {
        const strips: PositionedEventStrip[] = [];
        const lanes: number[] = [];

        const sortedEvents = [...events].sort((a, b) => {
            if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
            const aDuration = differenceInDays(new Date(a.end_date), new Date(a.start_date));
            const bDuration = differenceInDays(new Date(b.end_date), new Date(b.start_date));
            return bDuration - aDuration;
        });

        sortedEvents.forEach((event) => {
            // For dragging events, apply preview delta
            let eventStartDate = event.start_date;
            let eventEndDate = event.end_date;

            if (event.id === activeEventId && previewDelta) {
                const origStart = new Date(event.start_date);
                const origEnd = new Date(event.end_date);

                if (activeType === 'drag') {
                    eventStartDate = format(addDays(origStart, previewDelta.days), 'yyyy-MM-dd');
                    eventEndDate = format(addDays(origEnd, previewDelta.days), 'yyyy-MM-dd');
                } else if (activeType === 'resize-start') {
                    eventStartDate = format(addDays(origStart, previewDelta.days), 'yyyy-MM-dd');
                } else if (activeType === 'resize-end') {
                    eventEndDate = format(addDays(origEnd, previewDelta.days), 'yyyy-MM-dd');
                }
            }

            let startIndex = -1;
            let endIndex = -1;

            days.forEach((day, index) => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (dStr >= eventStartDate && dStr <= eventEndDate) {
                    if (startIndex === -1) startIndex = index;
                    endIndex = index;
                }
            });

            if (startIndex === -1) return;

            // Apply offset to indices
            startIndex += offset;
            endIndex += offset;

            // Find a lane
            let lane = 0;
            let foundLane = false;

            while (!foundLane) {
                let laneAvailable = true;
                for (let i = startIndex; i <= endIndex; i++) {
                    if (lanes[lane * 1000 + i]) {
                        laneAvailable = false;
                        break;
                    }
                }

                if (laneAvailable) {
                    for (let i = startIndex; i <= endIndex; i++) {
                        lanes[lane * 1000 + i] = 1;
                    }
                    foundLane = true;
                } else {
                    lane++;
                }
            }

            const columnSpan = endIndex - startIndex + 1;
            strips.push({
                ...event,
                lane,
                startIndex,
                endIndex,
                columnSpan,
            });
        });

        return strips;
    }, [days, events, offset, activeEventId, activeType, previewDelta]);

    const maxLanes = useMemo(() => {
        if (positionedEvents.length === 0) return 0;
        return Math.max(...positionedEvents.map(e => e.lane)) + 1;
    }, [positionedEvents]);

    const dayWidth = 100 / totalColumns;

    return (
        <div className="flex w-full flex-1 min-h-0 bg-background border-b border-gray-100 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50/10 transition-colors group">
            {/* Month Label */}
            <div className="w-12 flex-shrink-0 flex items-center justify-center border-r border-gray-100 dark:border-zinc-800/50 font-mono text-xs text-gray-400 uppercase tracking-wider font-semibold">
                {format(month, 'MMM')}
            </div>

            {/* Days Grid with Events Overlay */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">
                {/* Day Cells Grid */}
                <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(28px, 1fr))` }}>
                    {/* Offset empty cells */}
                    {Array.from({ length: offset }).map((_, i) => (
                        <div
                            key={`offset-${i}`}
                            className={cn(
                                "border-r border-gray-100 dark:border-zinc-800/50 min-h-[48px]",
                                (i % 7 === 0 || i % 7 === 6) && "bg-gray-100/50 dark:bg-zinc-900/30"
                            )}
                        />
                    ))}
                    {/* Actual days */}
                    {days.map((day) => (
                        <DayCell
                            key={day.toISOString()}
                            date={day}
                            month={month}
                            events={[]}
                        />
                    ))}
                    {/* Trailing empty cells to fill row */}
                    {Array.from({ length: totalColumns - offset - days.length }).map((_, i) => {
                        const colIndex = offset + days.length + i;
                        return (
                            <div
                                key={`trail-${i}`}
                                className={cn(
                                    "border-r border-gray-100 dark:border-zinc-800/50 min-h-[48px]",
                                    (colIndex % 7 === 0 || colIndex % 7 === 6) && "bg-gray-100/50 dark:bg-zinc-900/30"
                                )}
                            />
                        );
                    })}
                </div>

                {/* Events Layer */}
                <div className="absolute inset-0 pointer-events-none z-20">
                    {positionedEvents.map((event) => {
                        const isActive = activeEventId === event.id;
                        const isDragging = isActive && activeType === 'drag';

                        return (
                            <DraggableEvent
                                key={event.id}
                                event={event}
                                dayWidth={dayWidth}
                                isDragging={isDragging}
                                isResizing={isActive && (activeType === 'resize-start' || activeType === 'resize-end')}
                                justDragged={justDragged}
                                onOpenModal={() => openModal(event)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// Draggable event component
function DraggableEvent({
    event,
    dayWidth,
    isDragging,
    isResizing,
    justDragged,
    onOpenModal,
}: {
    event: PositionedEventStrip;
    dayWidth: number;
    isDragging: boolean;
    isResizing: boolean;
    justDragged: boolean;
    onOpenModal: () => void;
}) {
    const [showSticky, setShowSticky] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const elementRef = useRef<HTMLDivElement>(null);

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: event.id,
    });

    const { setNodeRef: setStartRef, listeners: startListeners, attributes: startAttrs } = useDraggable({
        id: `${event.id}-resize-start`,
    });

    const { setNodeRef: setEndRef, listeners: endListeners, attributes: endAttrs } = useDraggable({
        id: `${event.id}-resize-end`,
    });

    const cat = CALENDAR_CATEGORIES[event.category];
    const leftPercent = event.startIndex * dayWidth;
    const widthPercent = event.columnSpan * dayWidth;


    const hasNotes = !!event.notes?.trim();

    const handleMouseEnter = () => {
        if (isDragging || isResizing || !hasNotes) return;

        // Cancel any pending close action (e.g. moving from sticky back to event)
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }

        // If already shown, keep it shown
        if (showSticky) return;

        // Schedule open
        if (!openTimeoutRef.current) {
            openTimeoutRef.current = setTimeout(() => {
                if (elementRef.current) {
                    setRect(elementRef.current.getBoundingClientRect());
                    setShowSticky(true);
                }
            }, 300); // 300ms delay before showing to avoid accidental triggers
        }
    };

    const handleMouseLeave = () => {
        // Cancel pending open
        if (openTimeoutRef.current) {
            clearTimeout(openTimeoutRef.current);
            openTimeoutRef.current = null;
        }

        // Schedule close
        if (showSticky) {
            closeTimeoutRef.current = setTimeout(() => {
                setShowSticky(false);
            }, 300); // Grace period to move to the sticky note
        }
    };

    // Helper for touch devices
    const isTouchDevice = () => {
        return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0));
    };

    return (
        <>
            <div
                ref={(node) => {
                    // Combine refs
                    setNodeRef(node);
                    // @ts-ignore
                    elementRef.current = node;
                }}
                {...listeners}
                {...attributes}
                data-event
                data-event-id={event.id}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={cn(
                    "absolute h-4 flex items-center px-1.5 text-[10px] font-medium group/event pointer-events-auto",
                    isDragging ? "cursor-grabbing opacity-50" : "cursor-grab",
                    "rounded shadow-sm hover:shadow-md hover:z-30",
                    isResizing && "opacity-75",
                    "transition-[box-shadow]",
                    cat.color,
                    cat.textColor,
                    showSticky && "opacity-0" // Hide original when sticky is shown to prevent double rendering/overlap
                )}
                style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    top: `${32 + event.lane * 20}px`,
                    userSelect: 'none',
                    touchAction: 'none',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isDragging && !isResizing && !justDragged) {
                        onOpenModal();
                    }
                }}
            >
                {/* Start Resize Handle */}
                <div
                    ref={setStartRef}
                    {...startListeners}
                    {...startAttrs}
                    data-resize-handle="start"
                    className={cn(
                        "absolute left-0 top-0 bottom-0 w-2 bg-blue-400 hover:bg-blue-600 cursor-col-resize transition-opacity",
                        (isResizing || isDragging) ? "opacity-100" : "opacity-0 group-hover/event:opacity-100"
                    )}
                    style={{ touchAction: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                />

                <span className="truncate flex-1 mx-1">{event.title}</span>

                {/* Notes Indicator (icon) if notes exist */}
                {hasNotes && (
                    <span className="flex-shrink-0 opacity-70 ml-0.5">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 5H21V19H3V5ZM3 3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3H3ZM8 8H16V10H8V8ZM8 12H16V14H8V12Z" />
                        </svg>
                    </span>
                )}

                {/* End Resize Handle */}
                <div
                    ref={setEndRef}
                    {...endListeners}
                    {...endAttrs}
                    data-resize-handle="end"
                    className={cn(
                        "absolute right-0 top-0 bottom-0 w-2 bg-blue-400 hover:bg-blue-600 cursor-col-resize transition-opacity",
                        (isResizing || isDragging) ? "opacity-100" : "opacity-0 group-hover/event:opacity-100"
                    )}
                    style={{ touchAction: 'none' }}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Sticky Note Portal */}
            {showSticky && rect && createPortal(
                <div
                    className="fixed z-[9999]" // Removed animation to mitigate overlap ghosts
                    style={{
                        top: rect.top,
                        left: rect.left,
                        width: Math.max(rect.width, 220), // Min width for readability
                        // If it goes offscreen to the right, we might need to adjust logic, but sticking to left for now.
                        // Ideally we check viewport bounds.
                    }}
                    onMouseEnter={() => {
                        // Keep open when hovering the sticky itself
                        if (closeTimeoutRef.current) {
                            clearTimeout(closeTimeoutRef.current);
                            closeTimeoutRef.current = null;
                        }
                    }}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent event click behind it
                        setShowSticky(false);
                        onOpenModal();
                    }}
                >
                    <div className={cn(
                        "flex flex-col rounded-md shadow-2xl overflow-hidden cursor-pointer border",
                        "bg-white dark:bg-zinc-900 border-gray-200 dark:border-gray-800", // Solid background
                        cat.borderColor // Use category border color
                    )}>
                        {/* Header (looks like the event) */}
                        <div className={cn(
                            "h-5 flex items-center px-2 text-[10px] font-medium border-b border-black/5",
                            cat.textColor
                        )}>
                            <span className="flex-1 truncate">{event.title}</span>
                            <span className="opacity-70 text-[9px] ml-2">
                                {event.start_date === event.end_date
                                    ? format(new Date(event.start_date), 'MMM d')
                                    : `${format(new Date(event.start_date), 'MMM d')} - ${format(new Date(event.end_date), 'MMM d')}`
                                }
                            </span>
                        </div>

                        {/* Notes Body */}
                        <div className={cn(
                            "p-2 text-xs leading-relaxed whitespace-pre-wrap",
                            // Use a slightly different background or text color for contrast if needed
                            // But usually staying in theme is nice. 
                            // If the event color is dark, text is white. If light, text is black.
                            cat.textColor
                        )}>
                            {event.notes}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
