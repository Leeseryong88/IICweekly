
import React from 'react';
import { SheetRow, VisibleFields } from '../types';

interface DataCardProps {
  row: SheetRow;
  visibleFields: VisibleFields;
  onClick: () => void;
}

const CardSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={className}>
    <p className="text-xs font-semibold text-slate-400 mb-1">{title}</p>
    <div className="text-sm text-slate-300 whitespace-pre-wrap">{children}</div>
  </div>
);


const DataCard: React.FC<DataCardProps> = ({ row, visibleFields, onClick }) => {
  const hasBusinessTrip = !!(row['출장(시작일)'] || row['출장내용']);

  return (
    <div 
      onClick={onClick}
      className="bg-slate-900 rounded-lg border border-slate-800 hover:border-sky-500/50 transition-colors duration-300 flex flex-col h-full p-5 cursor-pointer"
    >
      <div className="flex-grow">
        {/* Author */}
        <div className="mb-4 pb-4 border-b border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wider">작성자</p>
          <p className="text-lg font-bold text-sky-400">{row['작성자']}</p>
        </div>

        <div className="space-y-4">
            {/* Dates */}
            {visibleFields.period && (row['시작일'] || row['종료일']) && (
                <CardSection title="기간">
                    {row['시작일']} ~ {row['종료일']}
                </CardSection>
            )}

            {/* In-progress Task */}
            {visibleFields.inProgressTask && row['핵심과제(진행경과)'] && (
                <CardSection title="진행중인 핵심과제">
                    {row['핵심과제(진행경과)']}
                </CardSection>
            )}

            {/* Planned Task */}
            {visibleFields.plannedTask && row['핵심과제(예정)'] && (
                <CardSection title="예정된 핵심과제">
                    {row['핵심과제(예정)']}
                </CardSection>
            )}
            
            {/* Main Schedule */}
            {visibleFields.mainSchedule && row['주요일정'] && (
                <CardSection title="주요 일정">
                    {row['주요일정']}
                </CardSection>
            )}

            {/* Issue */}
            {visibleFields.issue && row['이슈'] && (
            <div className="p-3 bg-amber-500/10 rounded-md border border-amber-500/20">
                <p className="text-xs font-semibold text-amber-400 mb-1">주요 이슈</p>
                <p className="text-sm text-amber-300 whitespace-pre-wrap">{row['이슈']}</p>
            </div>
            )}

            {/* Business Trip */}
            {visibleFields.businessTrip && hasBusinessTrip && (
            <div className="p-3 bg-sky-500/10 rounded-md border border-sky-500/20">
                <p className="text-xs font-semibold text-sky-400 mb-1">출장 정보</p>
                <p className="text-sm text-sky-300 whitespace-pre-wrap">
                {row['출장(시작일)']} ~ {row['출장(종료일)']}: {row['출장내용']}
                </p>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DataCard;
