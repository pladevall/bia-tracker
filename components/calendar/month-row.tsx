'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { eachDayOfInterval, endOfMonth, startOfMonth, format, differenceInDays } from 'date-fns';
import { DayCell, PositionedEvent } from './day-cell';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/types/calendar';
import { CALENDAR_CATEGORIES } from '@/lib/calendar-config';
import { useCalendar } from './calendar-context';
import { createClient } from '@/lib/supabase/client';

interface MonthRowProps {
    month: Date;
    events: CalendarEvent[];
}

interface PositionedEventStrip extends CalendarEvent {
    lane: number;
    startIndex: number;
    endIndex: number;
    columnSpan: number;
}

export function MonthRow({ month, events }: MonthRowProps) {
    const [resizingEvent, setResizingEvent] = useState<string | null>(null);
    const [resizeHandle, setResizeHandle] = useState<'start' | 'end' | null>(null);
    const [draggingEvent, setDraggingEvent] = useState<string | null>(null);
    const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const resizingEventRef = useRef<PositionedEventStrip | null>(null);
    const draggingEventRef = useRef<PositionedEventStrip | null>(null);

    const { openModal, refreshEvents } = useCalendar();

    const days = useMemo(() => {
        return eachDayOfInterval({
            start: startOfMonth(month),
            end: endOfMonth(month),
        });
    }, [month]);

    // Calculate positioned events as horizontal strips
    const positionedEvents = useMemo(() => {
        const strips: PositionedEventStrip[] = [];
        const lanes: number[] = []; // Track which lane each event is in

        // Sort events by start date, then by duration (longer first)
        const sortedEvents = [...events].sort((a, b) => {
            if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
            const aDuration = differenceInDays(new Date(a.end_date), new Date(a.start_date));
            const bDuration = differenceInDays(new Date(b.end_date), new Date(b.start_date));
            return bDuration - aDuration;
        });

        sortedEvents.forEach((event) => {
            // Find the start and end indices within this month
            const eventStart = new Date(event.start_date);
            const eventEnd = new Date(event.end_date);

            let startIndex = -1;
            let endIndex = -1;

            days.forEach((day, index) => {
                const dStr = format(day, 'yyyy-MM-dd');
                if (dStr >= event.start_date && dStr <= event.end_date) {
                    if (startIndex === -1) startIndex = index;
                    endIndex = index;
                }
            });

            if (startIndex === -1) return; // Event not in this month

            // Find a lane for this event
            let lane = 0;
            let foundLane = false;

            while (!foundLane) {
                // Check if this lane is available for the event's span
                let laneAvailable = true;
                for (let i = startIndex; i <= endIndex; i++) {
                    if (lanes[lane * 1000 + i]) {
                        laneAvailable = false;
                        break;
                    }
                }

                if (laneAvailable) {
                    // Mark this lane as occupied for these days
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
    }, [days, events]);

    const handleEventClick = (event: PositionedEventStrip, e: React.MouseEvent) => {
        // Don't open modal if we just finished resizing or dragging
        if (resizingEvent || draggingEvent) return;
        e.stopPropagation();
        openModal(event);
    };

    const handleResizeStart = (event: PositionedEventStrip, handle: 'start' | 'end') => {
        resizingEventRef.current = event;
        setResizingEvent(event.id);
        setResizeHandle(handle);
    };

    const handleDragStart = (event: PositionedEventStrip, e: React.MouseEvent) => {
        // Only allow drag from the middle of the event, not from the edges (handles)
        if (e.clientX < e.currentTarget.getBoundingClientRect().left + 8 ||
            e.clientX > e.currentTarget.getBoundingClientRect().right - 8) {
            return;
        }
        e.stopPropagation();
        draggingEventRef.current = event;
        setDraggingEvent(event.id);
        setDragStartIndex(event.startIndex);
    };

    const handleResizeEnd = async (event: PositionedEventStrip, handle: 'start' | 'end', newIndex: number) => {
        if (handle === 'start') {
            const newDate = format(days[newIndex], 'yyyy-MM-dd');
            if (newDate <= event.end_date) {
                await updateEventDate(event.id, newDate, event.end_date);
            }
        } else {
            const newDate = format(days[newIndex], 'yyyy-MM-dd');
            if (newDate >= event.start_date) {
                await updateEventDate(event.id, event.start_date, newDate);
            }
        }
        setResizingEvent(null);
        setResizeHandle(null);
    };

    const handleDragEnd = async (event: PositionedEventStrip, newStartIndex: number) => {
        const offset = newStartIndex - event.startIndex;
        const duration = event.endIndex - event.startIndex;
        const newEndIndex = newStartIndex + duration;

        if (newStartIndex >= 0 && newEndIndex < days.length) {
            const newStartDate = format(days[newStartIndex], 'yyyy-MM-dd');
            const newEndDate = format(days[newEndIndex], 'yyyy-MM-dd');
            await updateEventDate(event.id, newStartDate, newEndDate);
        }

        setDraggingEvent(null);
        setDragStartIndex(null);
        draggingEventRef.current = null;
    };

    const updateEventDate = async (eventId: string, startDate: string, endDate: string) => {
        const supabase = createClient();
        const { error } = await supabase
            .from('calendar_events')
            .update({ start_date: startDate, end_date: endDate })
            .eq('id', eventId);

        if (!error) {
            await refreshEvents();
        }
    };

    // Handle document-level mouse events for resizing
    useEffect(() => {
        if (!resizingEvent || !resizeHandle || !containerRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Calculate day index based on mouse position and update preview
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const dayIndex = Math.floor((x / rect.width) * 31);

            if (dayIndex >= 0 && dayIndex < days.length) {
                setPreviewIndex(dayIndex);
            }
        };

        const handleMouseUp = async (e: MouseEvent) => {
            if (!resizingEventRef.current) return;

            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const dayIndex = Math.floor((x / rect.width) * 31);

            if (dayIndex >= 0 && dayIndex < days.length) {
                await handleResizeEnd(resizingEventRef.current, resizeHandle, dayIndex);
            }

            setResizingEvent(null);
            setResizeHandle(null);
            setPreviewIndex(null);
            resizingEventRef.current = null;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingEvent, resizeHandle, days]);

    // Handle document-level mouse events for dragging
    useEffect(() => {
        if (!draggingEvent || !containerRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Calculate day index based on mouse position and update preview
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const dayIndex = Math.floor((x / rect.width) * 31);

            if (dayIndex >= 0 && dayIndex < days.length) {
                setPreviewIndex(dayIndex);
            }
        };

        const handleMouseUp = async (e: MouseEvent) => {
            if (!draggingEventRef.current || dragStartIndex === null) return;

            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const dayIndex = Math.floor((x / rect.width) * 31);

            if (dayIndex >= 0 && dayIndex < days.length) {
                await handleDragEnd(draggingEventRef.current, dayIndex);
            } else {
                // Reset if dropped outside valid range
                setDraggingEvent(null);
                setDragStartIndex(null);
                draggingEventRef.current = null;
            }

            setPreviewIndex(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingEvent, dragStartIndex, days]);

    // Calculate the max number of lanes for height
    const maxLanes = useMemo(() => {
        if (positionedEvents.length === 0) return 0;
        return Math.max(...positionedEvents.map(e => e.lane)) + 1;
    }, [positionedEvents]);

    // Height calculation: 20px per lane + padding
    const eventsHeight = maxLanes > 0 ? maxLanes * 20 + 4 : 0;
    const minHeight = Math.max(48, eventsHeight + 20); // At least 48px, plus events and date

    return (
        <div className="flex w-full flex-1 min-h-0 bg-background border-b border-gray-100 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50/10 transition-colors group">
            {/* Month Label */}
            <div className="w-24 flex-shrink-0 flex items-center justify-center border-r border-gray-100 dark:border-zinc-800/50 font-mono text-sm text-gray-400 uppercase tracking-wider font-semibold">
                {format(month, 'MMM')}
            </div>

            {/* Days Grid with Events Overlay */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">
                {/* Day Cells */}
                <div className="grid grid-cols-[repeat(31,minmax(0,1fr))] h-full w-full">
                    {days.map((day) => (
                        <DayCell
                            key={day.toISOString()}
                            date={day}
                            month={month}
                            events={[]}
                        />
                    ))}
                    {/* Fill empty cells if month < 31 days */}
                    {Array.from({ length: 31 - days.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="border-r border-gray-100 dark:border-zinc-800/50 opacity-0 pointer-events-none" />
                    ))}
                </div>

                {/* Events Layer - Absolute positioned strips */}
                <div className="absolute inset-0 pointer-events-none z-20">
                    {positionedEvents.map((event) => {
                        const cat = CALENDAR_CATEGORIES[event.category];
                        const dayWidth = 100 / 31; // Each day is 1/31 of the width

                        // Calculate preview position if resizing or dragging this event
                        let displayStartIndex = event.startIndex;
                        let displayEndIndex = event.endIndex;

                        if (resizingEvent === event.id && previewIndex !== null) {
                            if (resizeHandle === 'start') {
                                displayStartIndex = Math.min(previewIndex, event.endIndex);
                            } else if (resizeHandle === 'end') {
                                displayEndIndex = Math.max(previewIndex, event.startIndex);
                            }
                        } else if (draggingEvent === event.id && previewIndex !== null) {
                            const offset = previewIndex - event.startIndex;
                            const duration = event.endIndex - event.startIndex;
                            displayStartIndex = previewIndex;
                            displayEndIndex = previewIndex + duration;
                        }

                        const leftPercent = (displayStartIndex * dayWidth);
                        const columnSpan = displayEndIndex - displayStartIndex + 1;
                        const widthPercent = (columnSpan * dayWidth);

                        return (
                            <div
                                key={event.id}
                                data-event
                                onMouseDown={(e) => {
                                    // Check if we're clicking on a resize handle
                                    if (e.target !== e.currentTarget) return;
                                    handleDragStart(event, e);
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick(event, e);
                                }}
                                className={cn(
                                    "absolute h-4 flex items-center px-1.5 text-[10px] font-medium pointer-events-auto group/event",
                                    draggingEvent === event.id ? "cursor-grabbing" : "cursor-grab",
                                    resizingEvent === event.id ? "" : "transition-all",
                                    "rounded shadow-sm hover:shadow-md hover:z-30",
                                    (resizingEvent === event.id || draggingEvent === event.id) && "opacity-75",
                                    cat.color,
                                    cat.textColor,
                                )}
                                style={{
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    top: `${32 + event.lane * 20}px`,
                                    userSelect: 'none',
                                }}
                                title={`${event.title} (${format(new Date(event.start_date), 'MMM d')} - ${format(new Date(event.end_date), 'MMM d')})`}
                            >
                                {/* Start Resize Handle */}
                                <div
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleResizeStart(event, 'start');
                                    }}
                                    className={cn(
                                        "absolute left-0 top-0 bottom-0 w-1 bg-blue-400 hover:bg-blue-600 cursor-col-resize transition-opacity",
                                        (resizingEvent === event.id || draggingEvent === event.id) ? "opacity-100" : "opacity-0 group-hover/event:opacity-100"
                                    )}
                                />

                                {/* Event Title */}
                                <span className="truncate flex-1 mx-1">{event.title}</span>

                                {/* End Resize Handle */}
                                <div
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleResizeStart(event, 'end');
                                    }}
                                    className={cn(
                                        "absolute right-0 top-0 bottom-0 w-1 bg-blue-400 hover:bg-blue-600 cursor-col-resize transition-opacity",
                                        (resizingEvent === event.id || draggingEvent === event.id) ? "opacity-100" : "opacity-0 group-hover/event:opacity-100"
                                    )}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
