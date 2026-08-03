
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SheetRow, ChatMessage, MessageSender, VisibleFields } from './types';
import { fetchSheetData } from './services/sheetService';
import { startAIChat, getAIReportSummary } from './services/geminiService';

import DataCard from './components/DataCard';
import CustomCard from './components/CustomCard';
import CardModal from './components/CardModal';
import ChatMessageComponent from './components/ChatMessage';
import LoadingSpinner from './components/LoadingSpinner';
import DateRangePicker from './components/DateRangePicker';
import CalendarView from './components/CalendarView';

import RefreshIcon from './components/icons/RefreshIcon';
import SendIcon from './components/icons/SendIcon';
import BotIcon from './components/icons/BotIcon';
import CloseIcon from './components/icons/CloseIcon';
import AdjustmentsHorizontalIcon from './components/icons/AdjustmentsHorizontalIcon';
import DocumentDownloadIcon from './components/icons/DocumentDownloadIcon';
import DocumentTextIcon from './components/icons/DocumentTextIcon';
import ViewColumnsIcon from './components/icons/ViewColumnsIcon';
import CalendarDaysIcon from './components/icons/CalendarDaysIcon';
import DocumentArrowDownIcon from './components/icons/DocumentArrowDownIcon';
import PencilIcon from './components/icons/PencilIcon';
import { signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import SheetManager from './components/SheetManager';
import { getUserSettings, CardConfig } from './services/userSettings';


// Helper to parse a 'YYYY-MM-DD' string into a local Date object
const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN) || parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[2] > 31) return null;
    
    // Use local time, consistent with DateRangePicker
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return null;

    // Verify the date wasn't adjusted by the constructor (e.g., Feb 30 -> Mar 1)
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
        return null;
    }
    return date;
}

const parseMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    const lines = markdown.split('\n');
    const htmlParts: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    // Bolding and other simple inline formats
    const formatInline = (text: string) => {
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    };
    
    lines.forEach(line => {
        const trimmedLine = line.trim();
        const unorderedMatch = trimmedLine.match(/^([*-])\s+(.*)/);
        const orderedMatch = trimmedLine.match(/^(\d+\.|\d+\)|[a-zA-Z][.)])\s+(.*)/);

        if (unorderedMatch) {
            if (listType !== 'ul') {
                if (listType === 'ol') htmlParts.push('</ol>');
                htmlParts.push('<ul>');
                listType = 'ul';
            }
            htmlParts.push(`<li>${formatInline(unorderedMatch[2])}</li>`);
        } else if (orderedMatch) {
            if (listType !== 'ol') {
                if (listType === 'ul') htmlParts.push('</ul>');
                htmlParts.push('<ol>');
                listType = 'ol';
            }
            htmlParts.push(`<li>${formatInline(orderedMatch[2])}</li>`);
        } else {
            if (listType) {
                htmlParts.push(`</${listType}>`);
                listType = null;
            }
            if (trimmedLine.length > 0) {
                 htmlParts.push(`<p>${formatInline(line)}</p>`);
            }
        }
    });

    if (listType) {
        htmlParts.push(`</${listType}>`);
    }

    return htmlParts.join('');
};

const initialVisibleFields: VisibleFields = {
    period: true,
    inProgressTask: true,
    plannedTask: true,
    mainSchedule: true,
    issue: true,
    businessTrip: true,
};

const fieldLabels: { key: keyof VisibleFields, label: string }[] = [
    { key: 'period', label: '기간' },
    { key: 'inProgressTask', label: '진행중인 핵심과제' },
    { key: 'plannedTask', label: '예정된 핵심과제' },
    { key: 'mainSchedule', label: '주요일정' },
    { key: 'issue', label: '이슈' },
    { key: 'businessTrip', label: '출장정보' },
];


const App: React.FC = () => {
    // Data state
    const [allData, setAllData] = useState<SheetRow[]>([]);
    const [filteredData, setFilteredData] = useState<SheetRow[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sheetUrl, setSheetUrl] = useState<string>('');
    const [isSheetManagerOpen, setIsSheetManagerOpen] = useState<boolean>(false);
    const [cardConfig, setCardConfig] = useState<CardConfig | null>(null);
    const [calendarConfig, setCalendarConfig] = useState<CardConfig | null>(null);

    // Filter state
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [authorSearch, setAuthorSearch] = useState<string>('');
    const [isAuthorDropdownOpen, setIsAuthorDropdownOpen] = useState(false);
    const authorFilterRef = useRef<HTMLDivElement>(null);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [visibleFields, setVisibleFields] = useState<VisibleFields>(initialVisibleFields);
    const [visibleGroups, setVisibleGroups] = useState<string[]>([]);
    
    // View state
    const [viewMode, setViewMode] = useState<'card' | 'calendar'>('card');
    
    // Chat state
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [isChatMaximized, setIsChatMaximized] = useState<boolean>(false);
    const [chatInput, setChatInput] = useState<string>('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAiResponding, setIsAiResponding] = useState<boolean>(false);
    const chatRef = useRef<any | null>(null);
    const chatMessagesEndRef = useRef<HTMLDivElement>(null);

    // Report summary state
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
    const [summaryModalState, setSummaryModalState] = useState<'initial' | 'custom'>('initial');
    const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
    const [summary, setSummary] = useState<string>('');
    const [summaryPrompt, setSummaryPrompt] = useState('');
    
    // Card detail modal state
    const [selectedCard, setSelectedCard] = useState<SheetRow | null>(null);

    // 필터 매핑: 카드 디자이너에서 지정한 작성자/시작일 컬럼명을 사용
    const mappedAuthorField = useMemo(() => cardConfig?.fields.filterMapping?.authorField || '작성자', [cardConfig]);
    const mappedStartDateField = useMemo(() => cardConfig?.fields.filterMapping?.startDateField || '시작일', [cardConfig]);

    const authors = useMemo(() => {
        const authorSet = new Set(
            allData
                .map(row => (row[mappedAuthorField] as unknown as string) || '')
                .filter(Boolean)
        );
        return Array.from(authorSet).sort();
    }, [allData, mappedAuthorField]);

    const filteredAuthors = useMemo(() => {
        if (!authorSearch) {
            return authors;
        }
        return authors.filter(author =>
            author.toLowerCase().includes(authorSearch.toLowerCase())
        );
    }, [authors, authorSearch]);

    // Click outside handler for author dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (authorFilterRef.current && !authorFilterRef.current.contains(event.target as Node)) {
                setIsAuthorDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Close modals with Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (isFilterPanelOpen) setIsFilterPanelOpen(false);
                if (isSummaryModalOpen) handleCloseSummaryModal();
            }
        };

        if (isFilterPanelOpen || isSummaryModalOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFilterPanelOpen, isSummaryModalOpen]);


    // Initial data fetch
    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!sheetUrl) {
                setAllData([]);
                return;
            }
            const data = await fetchSheetData(sheetUrl);
            setAllData(data);
        } catch (err) {
            setError('데이터를 불러오는 데 실패했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [sheetUrl]);

    // Load user's default sheet on login
    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async (user) => {
            if (!user) return;
            try {
                const s = await getUserSettings(user.uid);
                if (s?.defaultSheetUrl) {
                    setSheetUrl(s.defaultSheetUrl);
                    const cardKey = `${s.defaultSheetUrl}:card`;
                    const calKey = `${s.defaultSheetUrl}:calendar`;
                    if (s.cardConfigs && s.cardConfigs[cardKey]) {
                        const cfg = s.cardConfigs[cardKey];
                        setCardConfig(cfg);
                        const groupNames = (cfg.fields.groups || []).map(g => g.label || '').filter(Boolean);
                        setVisibleGroups(groupNames);
                    } else {
                        setCardConfig(null);
                        setVisibleGroups([]);
                    }
                    setCalendarConfig(s.cardConfigs && s.cardConfigs[calKey] ? s.cardConfigs[calKey] : null);
                } else {
                    setSheetUrl('');
                    setCardConfig(null);
                    setVisibleGroups([]);
                }
            } catch (e) {
                console.error(e);
            }
        });
        return () => unsub();
    }, []);

    // Scroll to bottom of chat
    useEffect(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Filtering logic
    useEffect(() => {
        let data = allData;

        // Filter by author - dynamic mapping
        const authorField = cardConfig?.fields.filterMapping?.authorField || '작성자';
        if (authorSearch) {
            data = data.filter(row => row[authorField]?.toLowerCase().includes(authorSearch.toLowerCase()));
        }

        // Filter by date range - dynamic start date field
        const startDateField = cardConfig?.fields.filterMapping?.startDateField || '시작일';
        const start = parseDate(dateRange.startDate);
        const end = parseDate(dateRange.endDate);

        if (start || end) {
            data = data.filter(row => {
                const rowStart = parseDate(row[startDateField]);

                if (!rowStart) {
                    return false; // Rows without a start date cannot be included.
                }

                const filterStart = start ? new Date(start.setHours(0, 0, 0, 0)).getTime() : -Infinity;
                const filterEnd = end ? new Date(end.setHours(23, 59, 59, 999)).getTime() : Infinity;

                const itemStart = rowStart.getTime();

                // Check if the item's start date is within the selected range (inclusive).
                return itemStart >= filterStart && itemStart <= filterEnd;
            });
        }
        
        setFilteredData(data);
    }, [allData, dateRange, authorSearch]);


    // Effect to initialize/reset chat session
    useEffect(() => {
        if (isLoading) return; // Don't initialize chat while main data is loading

        const newChat = startAIChat(filteredData, visibleFields);
        chatRef.current = newChat;

        const welcomeMessage: ChatMessage = { 
            sender: MessageSender.AI, 
            text: "안녕하세요! 현재 필터링된 데이터에 대해 무엇이든 물어보세요." 
        };

        const wasChatUsed = messages.some(m => m.sender === MessageSender.USER);

        if (wasChatUsed) {
            const resetNotification: ChatMessage = {
                sender: MessageSender.SYSTEM,
                text: "필터가 변경되어 대화가 초기화되었습니다."
            };
            setMessages([resetNotification, welcomeMessage]);
        } else {
            setMessages([welcomeMessage]);
        }
    }, [filteredData, visibleFields, isLoading]);

    // Handlers
    const handleCardClick = (row: SheetRow) => {
        setSelectedCard(row);
    };

    const handleCloseModal = () => {
        setSelectedCard(null);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isAiResponding || !chatRef.current) return;
    
        const userMessage: ChatMessage = { sender: MessageSender.USER, text: chatInput };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = chatInput;
        setChatInput('');
        setIsAiResponding(true);
    
        try {
            const response = await chatRef.current.sendMessage({ message: currentInput });
            const aiResponseText = response.text;
            const aiMessage: ChatMessage = { sender: MessageSender.AI, text: aiResponseText };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("Error sending message to Gemini Chat API:", error);
            const errorMessage: ChatMessage = { sender: MessageSender.AI, text: "오류가 발생했습니다. 다시 시도해주세요." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsAiResponding(false);
        }
    };
    
    const handleOpenSummaryModal = () => {
        setIsSummaryModalOpen(true);
        // Reset all summary-related states upon opening
        setSummaryModalState('initial');
        setSummary('');
        setSummaryPrompt('');
        setIsSummaryLoading(false);
    };

    const handleCloseSummaryModal = () => {
        setIsSummaryModalOpen(false);
    };


    const handleGenerateSummary = async () => {
        setIsSummaryLoading(true);
        setSummary('');
        try {
            const result = await getAIReportSummary(filteredData, visibleFields, summaryPrompt);
            setSummary(result);
        } catch (err) {
            setSummary("요약 생성 중 오류가 발생했습니다.");
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const handleDownloadSummary = () => {
        if (!summary) return;
    
        const summaryHtml = parseMarkdownToHtml(summary);

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                <title>주간보고 요약</title>
                <style>
                    body { font-family: 'Malgun Gothic', sans-serif; font-size: 11pt; }
                    ul, ol { padding-left: 20px; }
                    li { margin-bottom: 5px; }
                    p { margin-bottom: 10px; }
                    strong { font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>주간보고 요약</h1>
                ${summaryHtml}
            </body>
            </html>
        `;
    
        const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        link.setAttribute("download", `AI요약(${yyyy}-${mm}-${dd}).doc`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleVisibilityChange = (field: keyof VisibleFields | 'all') => {
        if (field === 'all') {
            const isAllChecked = Object.values(visibleFields).every(Boolean);
            const newVisibility: VisibleFields = { ...visibleFields };
            for (const key in newVisibility) {
                newVisibility[key as keyof VisibleFields] = !isAllChecked;
            }
            setVisibleFields(newVisibility);
        } else {
            setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;
        }

        if (error) {
            return <div className="text-center text-red-400 p-8 bg-slate-800 rounded-lg">{error}</div>;
        }

        if (!sheetUrl) {
            return <div className="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">기본시트 설정필요</div>;
        }

        if (filteredData.length === 0) {
            return <div className="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">선택된 조건에 해당하는 데이터가 없습니다.</div>;
        }

        if (viewMode === 'calendar') {
            // 우선순위: 독립 저장된 캘린더 설정 → 카드 설정 내 매핑(호환)
            const mapping = (calendarConfig?.fields.calendarMapping) || (cardConfig?.fields.calendarMapping);
            const hasUserMapping = !!(mapping && mapping.startDateField && mapping.contentField);

            const calendarEvents = filteredData
                .filter(row => {
                    if (hasUserMapping) {
                        return row[mapping!.startDateField] && row[mapping!.contentField];
                    }
                    // 기존 기본 규칙(출장) 호환
                    return row['출장(시작일)'] && row['출장내용'];
                })
                .map((row, index) => {
                    if (hasUserMapping) {
                        const startDate = row[mapping!.startDateField];
                        const endDate = mapping!.endDateField ? (row[mapping!.endDateField] || startDate) : startDate;
                        const author = mapping!.authorField ? row[mapping!.authorField] : (row['작성자'] || '');
                        const contentRaw = row[mapping!.contentField] || '';
                        const label = mapping!.typeLabel ? `[${mapping!.typeLabel}] ` : '';
                        return {
                            id: `evt-${index}`,
                            startDate,
                            endDate,
                            content: `${label}${contentRaw}`,
                            author,
                            fullData: row,
                        };
                    }
                    return {
                        id: `trip-${index}`,
                        startDate: row['출장(시작일)'],
                        endDate: row['출장(종료일)'] || row['출장(시작일)'],
                        content: `[출장] ${row['출장내용']}`,
                        author: row['작성자'],
                        fullData: row,
                    };
                });

            if (calendarEvents.length === 0) {
                return <div className="text-center text-slate-400 p-8 bg-slate-800 rounded-lg">달력에 표시할 데이터가 없습니다. 달력 매핑을 설정하거나 필터를 조정하세요.</div>;
            }
            return <CalendarView events={calendarEvents} onEventClick={handleCardClick} />;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredData.map((row, index) => (
                    cardConfig && cardConfig.template === 'custom' ? (
                        <CustomCard key={index} row={row} config={cardConfig} visibleGroups={visibleGroups} onClick={() => handleCardClick(row)} />
                    ) : (
                        <DataCard key={index} row={row} visibleFields={visibleFields} onClick={() => handleCardClick(row)} />
                    )
                ))}
            </div>
        );
    };

    const isAllVisible = Object.values(visibleFields).every(Boolean);
    
    return (
        <div className="bg-slate-950 text-slate-200 min-h-screen font-sans">
            <header className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-800">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-sky-400">{(viewMode==='calendar' ? (calendarConfig?.fields.headerTitle || cardConfig?.fields.headerTitle) : (cardConfig?.fields.headerTitle)) || 'IIC Weekly Dashboard'}</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('card')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                                title="카드 보기"
                            >
                                <ViewColumnsIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                                title="달력 보기"
                            >
                                <CalendarDaysIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                            className="p-2 rounded-md hover:bg-slate-700 transition-colors"
                            title="필터"
                        >
                            <AdjustmentsHorizontalIcon className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={handleOpenSummaryModal}
                            className="p-2 rounded-md hover:bg-slate-700 transition-colors"
                            title="AI 요약"
                        >
                            <DocumentTextIcon className="w-5 h-5" />
                        </button>
                        {/* 설정 진입 링크 제거 (비공개 경로) */}
                         <button 
                            onClick={loadData}
                            className="p-2 rounded-md hover:bg-slate-700 transition-colors w-9 h-9 flex items-center justify-center"
                            title="새로고침"
                            disabled={isLoading}
                        >
                           {isLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-700 border-t-sky-400 rounded-full animate-spin"></div>
                            ) : (
                                <RefreshIcon className="w-5 h-5" />
                            )}
                        </button>
                        <button
                            onClick={() => signOut(auth)}
                            className="p-2 rounded-md hover:bg-slate-700 transition-colors"
                            title="로그아웃"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                {renderContent()}
            </main>

            {/* Filter Modal */}
            {isFilterPanelOpen && (
                 <div 
                    className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 animate-fade-in"
                    onClick={() => setIsFilterPanelOpen(false)}
                >
                    <div 
                        className="bg-slate-900 w-full max-w-2xl rounded-lg border border-slate-800 shadow-2xl flex flex-col animate-slide-up max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="p-4 flex justify-between items-center border-b border-slate-800">
                            <h2 className="text-lg font-semibold text-slate-300">데이터 필터</h2>
                            <button onClick={() => setIsFilterPanelOpen(false)} className="p-1 rounded-full hover:bg-slate-700">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </header>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-400">필터1 ({mappedStartDateField})</label>
                                        {(dateRange.startDate || dateRange.endDate) && (
                                            <button
                                                onClick={() => setDateRange({ startDate: '', endDate: '' })}
                                                className="text-xs text-red-400 hover:text-red-300"
                                            >
                                                필터 해제
                                            </button>
                                        )}
                                    </div>
                                    <DateRangePicker
                                        startDate={dateRange.startDate}
                                        endDate={dateRange.endDate}
                                        onChange={setDateRange}
                                    />
                                </div>
                                <div ref={authorFilterRef} className="relative">
                                    <label htmlFor="author-filter-input" className="block text-sm font-medium text-slate-400 mb-2">필터2 ({mappedAuthorField})</label>
                                    <input
                                        id="author-filter-input"
                                        type="text"
                                        placeholder="이름으로 검색..."
                                        value={authorSearch}
                                        onChange={(e) => setAuthorSearch(e.target.value)}
                                        onFocus={() => setIsAuthorDropdownOpen(true)}
                                        autoComplete="off"
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5 transition"
                                    />
                                    {isAuthorDropdownOpen && (
                                        <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                                            <ul className="py-1">
                                                <li
                                                    onClick={() => {
                                                        setAuthorSearch('');
                                                        setIsAuthorDropdownOpen(false);
                                                    }}
                                                    className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer"
                                                >
                                                    전체 작성자
                                                </li>
                                                {filteredAuthors.map(author => (
                                                    <li
                                                        key={author}
                                                        onClick={() => {
                                                            setAuthorSearch(author);
                                                            setIsAuthorDropdownOpen(false);
                                                        }}
                                                        className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer"
                                                    >
                                                        {author}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {cardConfig && cardConfig.template === 'custom' && (
                                    <div className="md:col-span-2 border-t border-slate-800 pt-6">
                                        <h3 className="text-base font-semibold text-slate-300 mb-4">카드 표시 정보</h3>
                                        <div className="mb-3">
                                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4"
                                                    checked={visibleGroups.length === (cardConfig.fields.groups || []).filter(g=>g.label).length}
                                                    onChange={(e)=>{
                                                        if (e.target.checked) {
                                                            const all = (cardConfig.fields.groups || []).map((g, idx)=> g.label || `그룹 ${idx+1}`).filter(Boolean);
                                                            setVisibleGroups(all);
                                                        } else {
                                                            // 비어있는 배열은 아무 그룹도 표시하지 않음
                                                            setVisibleGroups([]);
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm text-slate-300">모두 표시</span>
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {(cardConfig.fields.groups || []).map((g, idx) => {
                                                const name = g.label || `그룹 ${idx+1}`;
                                                const checked = visibleGroups.includes(name);
                                                return (
                                                    <label key={idx} className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" className="w-4 h-4" checked={checked} onChange={(e)=>{
                                                            setVisibleGroups(prev => {
                                                                if (e.target.checked) return Array.from(new Set([...prev, name]));
                                                                return prev.filter(n => n !== name);
                                                            });
                                                        }} />
                                                        <span className="text-sm text-slate-300">{name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Modal */}
            {isSummaryModalOpen && (
                <div 
                    className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 animate-fade-in"
                    onClick={handleCloseSummaryModal}
                >
                    <div 
                        className="bg-slate-900 w-full max-w-2xl rounded-lg border border-slate-800 shadow-2xl flex flex-col animate-slide-up max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="p-4 flex justify-between items-center border-b border-slate-800">
                            <h2 className="text-lg font-semibold text-slate-300">AI 요약</h2>
                            <button onClick={handleCloseSummaryModal} className="p-1 rounded-full hover:bg-slate-700">
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </header>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            {/* Conditional UI for input */}
                            {!isSummaryLoading && !summary && (
                                summaryModalState === 'initial' ? (
                                    <div className="text-center py-4">
                                        <p className="text-slate-400 mb-6">어떤 방식으로 요약을 생성할까요?</p>
                                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                            <button
                                                onClick={handleGenerateSummary}
                                                disabled={filteredData.length === 0}
                                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                                            >
                                                <DocumentDownloadIcon className="w-5 h-5" />
                                                <span>자동</span>
                                            </button>
                                            <button
                                                onClick={() => setSummaryModalState('custom')}
                                                disabled={filteredData.length === 0}
                                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 text-white rounded-md hover:bg-slate-600 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                                <span>요청(선택사항)</span>
                                            </button>
                                        </div>
                                        {filteredData.length === 0 && <p className="text-xs text-amber-400 mt-4">요약할 데이터가 없습니다. 필터를 조정해주세요.</p>}
                                    </div>
                                ) : ( // summaryModalState === 'custom'
                                    <>
                                        <textarea
                                            value={summaryPrompt}
                                            onChange={(e) => setSummaryPrompt(e.target.value)}
                                            placeholder="AI에게 특별히 요청할 사항이 있다면 여기에 입력하세요 (예: 가장 중요한 이슈 3가지만 요약해줘)."
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5 transition h-24"
                                        />
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={handleGenerateSummary}
                                                disabled={isSummaryLoading || filteredData.length === 0}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                                            >
                                                <DocumentDownloadIcon className="w-5 h-5" />
                                                <span>요약 생성</span>
                                            </button>
                                            <button
                                                onClick={() => setSummaryModalState('initial')}
                                                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </>
                                )
                            )}

                            {/* Loading and Result UI */}
                            {isSummaryLoading && <div className="pt-4"><LoadingSpinner /></div>}
                            {summary && (
                                <div className="mt-4">
                                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-md">
                                        <div
                                            className="markdown-content text-sm font-sans"
                                            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(summary) }}
                                        />
                                    </div>
                                    <div className="mt-4 flex items-center gap-4">
                                        <button
                                            onClick={handleDownloadSummary}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                                        >
                                            <DocumentArrowDownIcon className="w-5 h-5" />
                                            <span>Word로 다운로드</span>
                                        </button>
                                         <button
                                            onClick={handleOpenSummaryModal}
                                            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                                        >
                                            새로 요약하기
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Card Detail Modal */}
            {selectedCard && <CardModal cardData={selectedCard} onClose={handleCloseModal} config={cardConfig} />}

            <div className="fixed bottom-6 right-6 z-20">
                <button
                    onClick={() => { setIsChatOpen(!isChatOpen); if (isChatOpen) setIsChatMaximized(false); }}
                    className="w-16 h-16 bg-sky-600 rounded-full text-white flex items-center justify-center shadow-lg hover:bg-sky-500 transition-transform hover:scale-110"
                    aria-label="Open chat"
                >
                    {isChatOpen ? <CloseIcon className="w-8 h-8"/> : <BotIcon className="w-8 h-8" />}
                </button>
            </div>
            
            {isChatOpen && (
                <div className={isChatMaximized ? "fixed inset-0 bg-slate-900/95 border border-slate-700 rounded-none shadow-2xl flex flex-col animate-fade-in z-40" : "fixed bottom-24 inset-x-4 h-[60vh] sm:inset-x-auto sm:right-6 sm:w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl flex flex-col animate-fade-in-up z-20"}>
                    <header className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="font-semibold text-lg">AI 비서</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsChatMaximized(v => !v)}
                                className="px-3 py-1 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-white"
                                title={isChatMaximized ? '축소' : '최대화'}
                            >{isChatMaximized ? '축소' : '최대화'}</button>
                            <button
                                onClick={() => { setIsChatOpen(false); setIsChatMaximized(false); }}
                                className="p-2 rounded-md hover:bg-slate-700"
                                title="닫기"
                            >
                                <CloseIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </header>
                    <div className="flex-1 p-4 overflow-y-auto">
                        {messages.map((msg, index) => (
                            <ChatMessageComponent key={index} message={msg} />
                        ))}
                        {isAiResponding && (
                             <div className="flex items-start gap-3 my-4 justify-start">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                                    <BotIcon className="w-5 h-5 text-sky-400" />
                                </div>
                                <div className="max-w-xl p-3 px-4 rounded-2xl bg-slate-700 rounded-bl-lg">
                                    <LoadingSpinner />
                                </div>
                            </div>
                        )}
                        <div ref={chatMessagesEndRef} />
                    </div>
                    <footer className="p-4 border-t border-slate-700">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="메시지를 입력하세요..."
                                className="flex-1 bg-slate-700 border border-slate-600 rounded-full py-2 px-4 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isAiResponding || !chatInput.trim()}
                                className="w-10 h-10 bg-sky-600 rounded-full flex items-center justify-center text-white disabled:bg-slate-600 hover:bg-sky-500 transition-colors"
                                aria-label="Send message"
                            >
                                <SendIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </footer>
                </div>
            )}
            {/* 시트 기능은 설정 페이지로 이동했으므로 모달 제거 */}
        </div>
    );
};

export default App;
