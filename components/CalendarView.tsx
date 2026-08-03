import React, { useState, useMemo, useEffect } from 'react';
import { SheetRow } from '../types';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import CloseIcon from './icons/CloseIcon';

// --- TYPE DEFINITIONS ---

interface CalendarEventData {
    id: string;
    startDate: string;
    endDate: string;
    author: string;
    content: string;
    fullData: SheetRow;
}

interface ProcessedEvent {
    id: string;
    startDate: Date;
    endDate: Date;
    author: string;
    content: string;
    color: string;
    fullData: SheetRow;
}

interface PlacedEvent extends ProcessedEvent {
    lane: number;
    startDay: number; // 0-6 index within the week
    span: number; // number of days it spans in the week
}

interface CalendarViewProps {
  events: CalendarEventData[];
  onEventClick: (row: SheetRow) => void;
}

// --- HELPER FUNCTIONS ---

const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN) || parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[2] > 31) return null;
    
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime()) || date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
        return null;
    }
    date.setHours(0, 0, 0, 0); // Normalize to midnight for accurate comparisons
    return date;
}

const eventColorMap: { [key: string]: string } = {
    '출장': 'hsl(170, 60%, 50%)',
    'default': 'hsl(220, 15%, 55%)',
};

const getEventColor = (content: string) => {
    const typeMatch = content.match(/^\[(.*?)\]/);
    const type = typeMatch ? typeMatch[1].trim() : 'default';
    return eventColorMap[type] || eventColorMap['default'];
};


// --- COMPONENT ---

const CalendarView: React.FC<CalendarViewProps> = ({ events: eventData, onEventClick }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [moreEventsDate, setMoreEventsDate] = useState<Date | null>(null);
    const MAX_VISIBLE_LANES = 3;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMoreEventsDate(null);
            }
        };

        if (moreEventsDate) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [moreEventsDate]);


    const processedEvents = useMemo((): ProcessedEvent[] => {
        return eventData
            .map((item) => {
                const startDate = parseDate(item.startDate);
                const endDate = parseDate(item.endDate);
                
                if (!startDate) return null;

                return {
                    id: item.id,
                    startDate,
                    endDate: endDate || startDate,
                    author: item.author,
                    content: item.content,
                    color: getEventColor(item.content),
                    fullData: item.fullData,
                };
            })
            .filter((event): event is ProcessedEvent => event !== null)
            .sort((a, b) => {
                if (a.startDate.getTime() !== b.startDate.getTime()) {
                    return a.startDate.getTime() - b.startDate.getTime();
                }
                const durationA = a.endDate.getTime() - a.startDate.getTime();
                const durationB = b.endDate.getTime() - b.startDate.getTime();
                return durationB - durationA;
            });
    }, [eventData]);

    const handleMonthChange = (amount: number) => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const { weeks, today } = useMemo(() => {
        const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const gridStartDate = new Date(startOfMonth);
        gridStartDate.setDate(gridStartDate.getDate() - startOfMonth.getDay());

        const weeksArray: Date[][] = [];
        let currentDay = new Date(gridStartDate);

        for (let i = 0; i < 6; i++) { 
            const week: Date[] = [];
            for (let j = 0; j < 7; j++) {
                week.push(new Date(currentDay));
                currentDay.setDate(currentDay.getDate() + 1);
            }
            weeksArray.push(week);
            if (currentDay.getMonth() !== viewDate.getMonth() && weeksArray.length >= 4 && week[0].getMonth() !== viewDate.getMonth()) {
                break;
            }
        }
        
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        return { weeks: weeksArray, today: todayDate };
    }, [viewDate]);

    const placedEventsByWeek = useMemo(() => {
        return weeks.map(week => {
            const weekStart = week[0];
            const weekEnd = new Date(week[6]);
            weekEnd.setHours(23, 59, 59, 999);
    
            const weeklyEvents = processedEvents.filter(e => e.startDate <= weekEnd && e.endDate >= weekStart);
            const placedThisWeek: PlacedEvent[] = [];
    
            for (const event of weeklyEvents) {
                let targetLane = 0;
                while (true) {
                    const hasOverlap = placedThisWeek
                        .filter(p => p.lane === targetLane)
                        .some(p => {
                            const eventStartInWeek = Math.max(event.startDate.getTime(), weekStart.getTime());
                            const eventEndInWeek = Math.min(event.endDate.getTime(), weekEnd.getTime());
                            const pStartInWeek = Math.max(p.startDate.getTime(), weekStart.getTime());
                            const pEndInWeek = Math.min(p.endDate.getTime(), weekEnd.getTime());
    
                            return eventStartInWeek <= pEndInWeek && eventEndInWeek >= pStartInWeek;
                        });
    
                    if (!hasOverlap) {
                        const start = event.startDate > weekStart ? event.startDate : weekStart;
                        const end = event.endDate < weekEnd ? event.endDate : weekEnd;
                        const startDayIndex = week.findIndex(d => d.getTime() === start.getTime());
                        
                        if (startDayIndex === -1) break;
    
                        const endDayIndex = week.findIndex(d => d.getTime() === end.getTime());
                        
                        placedThisWeek.push({
                            ...event,
                            lane: targetLane,
                            startDay: startDayIndex,
                            span: (endDayIndex >= 0 ? endDayIndex : 6) - startDayIndex + 1,
                        });
                        break;
                    }
                    targetLane++;
                }
            }
            return placedThisWeek;
        });
    }, [weeks, processedEvents]);

    const eventsForMoreModal = useMemo(() => {
        if (!moreEventsDate) return [];
        const selectedTime = moreEventsDate.getTime();
        return processedEvents
            .filter(event => {
                const startTime = event.startDate.getTime();
                const endTime = event.endDate.getTime();
                return selectedTime >= startTime && selectedTime <= endTime;
            })
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    }, [moreEventsDate, processedEvents]);

    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 animate-fade-in max-w-5xl mx-auto">
            <header className="flex justify-between items-center mb-4">
                <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-slate-700 transition-colors">
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold text-slate-200">
                    {viewDate.getFullYear()}년 {viewDate.toLocaleString('ko-KR', { month: 'long' })}
                </h2>
                <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-slate-700 transition-colors">
                    <ChevronRightIcon className="w-5 h-5" />
                </button>
            </header>

            <div className="border border-slate-700 rounded-md overflow-hidden">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 bg-slate-700 gap-px">
                    {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                        <div key={day} className="text-center text-xs font-bold text-slate-400 py-2 bg-slate-800">{day}</div>
                    ))}
                </div>

                {/* Calendar Body */}
                <div className="grid grid-cols-1 bg-slate-700 gap-px">
                    {weeks.map((week, weekIndex) => {
                        const placedEventsForWeek = placedEventsByWeek[weekIndex];

                        return (
                            <div key={weekIndex} className="relative grid grid-cols-7 gap-px">
                                {/* Day Cells (background and numbers) */}
                                {week.map((day, dayIndex) => {
                                    const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                                    const isToday = day.getTime() === today.getTime();
                                    
                                    const allEventsOnThisDay = placedEventsForWeek.filter(e => dayIndex >= e.startDay && dayIndex < e.startDay + e.span);
                                    const hiddenCount = Math.max(0, allEventsOnThisDay.length - MAX_VISIBLE_LANES);

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={`relative p-1.5 bg-slate-900 ${isCurrentMonth ? '' : 'bg-slate-900/60'} min-h-[120px]`}
                                        >
                                            <span className={`relative z-20 text-xs sm:text-sm ${isToday ? 'bg-sky-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold' : isCurrentMonth ? 'text-slate-200' : 'text-slate-600'}`}>
                                                {day.getDate()}
                                            </span>
                                            {hiddenCount > 0 && (
                                                <div className="absolute bottom-1 w-full flex justify-center left-0 z-20">
                                                    <button 
                                                        onClick={() => setMoreEventsDate(day)}
                                                        className="text-xs text-sky-400 hover:text-sky-300 focus:outline-none focus:underline px-1 rounded"
                                                    >
                                                        + {hiddenCount} 더보기
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                
                                {/* Event Bars Overlay for the entire week */}
                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                    {placedEventsForWeek
                                        .filter(e => e.lane < MAX_VISIBLE_LANES)
                                        .map(event => {
                                            const eventContent = event.content.replace(/^\[출장\]\s*/, '');
                                            return (
                                                <div
                                                    key={event.id}
                                                    onClick={() => onEventClick(event.fullData)}
                                                    className="absolute p-1 rounded text-xs leading-tight cursor-pointer hover:opacity-80 transition-opacity z-10 overflow-hidden pointer-events-auto"
                                                    style={{
                                                        top: `calc(1.75rem + ${event.lane * 1.5}rem)`, // 28px + 24px per lane
                                                        left: `calc(${(100 / 7) * event.startDay}% + 2px)`,
                                                        width: `calc(${(100 / 7) * event.span}% - 4px)`,
                                                        height: `1.375rem`, // 22px
                                                        backgroundColor: event.color,
                                                    }}
                                                    title={`[${event.author}] ${eventContent}`}
                                                >
                                                    <p className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis px-1">
                                                        {`[${event.author}] ${eventContent}`}
                                                    </p>
                                                </div>
                                            );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* More Events Modal */}
            {moreEventsDate && (
                 <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
                    onClick={() => setMoreEventsDate(null)}
                >
                    <div
                        className="bg-slate-900 w-full max-w-lg rounded-lg border border-slate-700 shadow-2xl flex flex-col animate-slide-up max-h-[80vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="p-4 flex justify-between items-center border-b border-slate-800">
                            <h3 className="text-lg font-semibold text-slate-300">
                                {moreEventsDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                            </h3>
                            <button onClick={() => setMoreEventsDate(null)} className="p-1 rounded-full hover:bg-slate-700">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </header>
                        <div className="p-6 overflow-y-auto">
                           <ul className="space-y-3">
                                {eventsForMoreModal.map(event => (
                                    <li 
                                        key={event.id}
                                        onClick={() => {
                                            onEventClick(event.fullData);
                                            setMoreEventsDate(null);
                                        }}
                                        className="p-3 rounded-lg flex items-start space-x-4 bg-slate-800 border-l-4 cursor-pointer hover:bg-slate-700 transition-colors"
                                        style={{ borderColor: event.color }}
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-200">{event.content.replace(/^\[.*?\]\s*/, '')}</p>
                                            <p className="text-sm text-slate-400 mt-1">작성자: {event.author}</p>
                                            <p className="text-xs text-slate-500 mt-1">기간: {event.startDate.toLocaleDateString('ko-KR')} - {event.endDate.toLocaleDateString('ko-KR')}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;