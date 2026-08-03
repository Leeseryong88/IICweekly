// FIX: The original file content was corrupted. It has been replaced with the correct component implementation.
import React from 'react';
import { SheetRow } from '../types';

interface DataCardProps {
  row: SheetRow;
}

const DataCard: React.FC<DataCardProps> = ({ row }) => {
  return (
    <div className="bg-slate-800 rounded-xl shadow-lg p-6 transition-all duration-300 hover:shadow-sky-500/20 hover:ring-1 hover:ring-sky-500 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-xl font-bold text-sky-400 mb-2">{row['주요일정']}</h3>
        
        {(row['시작일'] || row['종료일']) && (
          <p className="text-slate-400 text-xs mb-4">
            {row['시작일']} ~ {row['종료일']}
          </p>
        )}

        {row['핵심과제(진행경과)'] && (
          <div className="mb-4">
            <p className="text-slate-400 text-sm font-semibold mb-2">진행중인 핵심과제:</p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{row['핵심과제(진행경과)']}</p>
          </div>
        )}

        {row['핵심과제(예정)'] && (
          <div className="mb-4">
            <p className="text-slate-400 text-sm font-semibold mb-2">예정된 핵심과제:</p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{row['핵심과제(예정)']}</p>
          </div>
        )}
        
        {row['이슈'] && (
            <div className="mb-4 p-3 bg-amber-900/40 rounded-lg border border-amber-700/50">
                <p className="text-amber-400 text-sm font-semibold mb-1">주요 이슈:</p>
                <p className="text-amber-300 text-sm whitespace-pre-wrap">{row['이슈']}</p>
            </div>
        )}

        {row['출장(시작일)'] && (
            <div className="mb-4">
                <p className="text-slate-400 text-sm font-semibold mb-1">출장 정보:</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {row['출장(시작일)']} ~ {row['출장(종료일)']}: {row['출장내용']}
                </p>
            </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 text-right">
         <p className="text-slate-500 text-xs">
           작성자: {row['작성자']}
         </p>
      </div>
    </div>
  );
};

export default DataCard;
