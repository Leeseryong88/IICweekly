
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import CalendarIcon from './icons/CalendarIcon';

// Helper to format a Date object into 'YYYY-MM-DD' string
const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to parse a 'YYYY-MM-DD' string into a local Date object
const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(date.getTime()) ? null : date;
}

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(parseDate(startDate) || new Date());
    const [internalStartDate, setInternalStartDate] = useState<Date | null>(parseDate(startDate));
    const [internalEndDate, setInternalEndDate] = useState<Date | null>(parseDate(endDate));
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    const pickerRef = useRef<HTMLDivElement>(null);

    // Effect to handle clicks outside the component to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect to sync internal state if props change from outside
    useEffect(() => {
        setInternalStartDate(parseDate(startDate));
    }, [startDate]);

    useEffect(() => {
        setInternalEndDate(parseDate(endDate));
    }, [endDate]);

    const handleMonthChange = (amount: number) => {
        setViewDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    };

    const handleDayClick = (day: Date) => {
        if (!internalStartDate || internalEndDate) {
            setInternalStartDate(day);
            setInternalEndDate(null);
            // Clear end date for parent
            onChange({ startDate: formatDate(day), endDate: '' });
        } else if (!internalEndDate) {
            if (day < internalStartDate) {
                setInternalEndDate(internalStartDate);
                setInternalStartDate(day);
                onChange({ startDate: formatDate(day), endDate: formatDate(internalStartDate) });
            } else {
                setInternalEndDate(day);
                onChange({ startDate: formatDate(internalStartDate), endDate: formatDate(day) });
            }
            setIsOpen(false);
        }
    };

    const calendar = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
        const placeholders = Array(firstDay).fill(null);
        
        return [...placeholders, ...days];
    }, [viewDate]);
    
    const displayValue = internalStartDate
        ? `${formatDate(internalStartDate)} ${internalEndDate ? ` - ${formatDate(internalEndDate)}` : ''}`
        : '날짜를 선택하세요';

    const renderDay = (day: Date | null, index: number) => {
        if (!day) return <div key={`empty-${index}`} />;
        
        const dayString = formatDate(day);
        const todayString = formatDate(new Date());

        const isSelected = dayString === formatDate(internalStartDate) || dayString === formatDate(internalEndDate);
        const isStart = dayString === formatDate(internalStartDate);
        const isEnd = dayString === formatDate(internalEndDate);
        
        let inRange = false;
        if (internalStartDate && !internalEndDate && hoverDate) {
            inRange = (day > internalStartDate && day <= hoverDate) || (day < internalStartDate && day >= hoverDate);
        } else if (internalStartDate && internalEndDate) {
            inRange = day > internalStartDate && day < internalEndDate;
        }

        const effectiveEndDate = internalEndDate || hoverDate;

        const isRangeStart = isStart || (inRange && (day.getTime() === (hoverDate?.getTime() ?? 0) && hoverDate! < internalStartDate!))
        const isRangeEnd = isEnd || (inRange && day.getTime() === (hoverDate?.getTime() ?? 0) && hoverDate! > internalStartDate!) || day.getTime() === effectiveEndDate?.getTime();
        
        const className = [
            'calendar-cell',
            dayString === todayString && 'today',
            isSelected && 'selected',
            inRange && 'in-range',
            (isRangeStart || isStart) && 'range-start',
            (isRangeEnd || isEnd) && 'range-end',
        ].filter(Boolean).join(' ');

        return (
            <div 
                key={dayString} 
                className={className} 
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => setHoverDate(day)}
                onMouseLeave={() => setHoverDate(null)}
            >
                {day.getDate()}
            </div>
        );
    };

    return (
        <div className="relative w-full" ref={pickerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2 transition text-left flex items-center justify-between"
            >
                <span className={internalStartDate ? 'text-slate-200' : 'text-slate-400'}>{displayValue}</span>
                <CalendarIcon className="w-5 h-5 text-slate-400" />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-72 sm:w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 z-50 animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => handleMonthChange(-1)} className="p-1 rounded-full hover:bg-slate-700"><ChevronLeftIcon className="w-5 h-5" /></button>
                        <div className="font-semibold text-sm">
                            {viewDate.getFullYear()}년 {viewDate.toLocaleString('default', { month: 'long' })}
                        </div>
                        <button onClick={() => handleMonthChange(1)} className="p-1 rounded-full hover:bg-slate-700"><ChevronRightIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="calendar-grid text-xs text-center text-slate-400 mb-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="calendar-grid text-sm">
                        {calendar.map(renderDay)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;