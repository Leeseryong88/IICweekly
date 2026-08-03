import React from 'react';
import { SheetRow } from '../types';
import { CardConfig } from '../services/userSettings';

interface CustomCardProps {
  row: SheetRow;
  config: CardConfig;
  onClick: () => void;
  visibleGroups?: string[];
}

// Convert hex color to rgba with given alpha. Fallback to subtle slate tint on invalid input.
const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex) return `rgba(148, 163, 184, ${alpha})`;
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r,g,b].some(n => Number.isNaN(n))) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CustomCard: React.FC<CustomCardProps> = ({ row, config, onClick, visibleGroups }) => {
  const { fields } = config;
  const title = fields.title ? row[fields.title] : '';
  const titleStyle = fields.titleStyle || {};
  const groups = (fields.groups || []).filter(g => {
    if (visibleGroups == null) return true; // null/undefined → 모두 표시
    if (visibleGroups.length === 0) return false; // 빈 배열이면 아무것도 표시하지 않음
    const name = g.label || '';
    if (!name) return true; // 라벨 없는 그룹은 항상 표시
    return visibleGroups.includes(name);
  });

  // Helper: determine if a group's data items are all empty for this row
  const isGroupEmptyForRow = (g: any): boolean => {
    const items = (g.items || []);
    const dataItems = items.filter((it: any) => it?.type === 'data');
    const textOnly = items.length > 0 && items.every((it: any) => it?.type === 'text');
    if (textOnly) return true; // 텍스트만 있는 그룹은 숨김
    if (dataItems.length === 0) return false; // 데이터 항목이 전혀 없고 텍스트도 없으면 표시(기존 동작 유지)
    return dataItems.every((it: any) => {
      const value = it.field ? (row as any)[it.field] : '';
      return value === undefined || String(value).trim() === '';
    });
  };

  return (
    <div 
      onClick={onClick}
      className="bg-slate-900 rounded-lg border border-slate-800 hover:border-sky-500/50 transition-colors duration-300 flex flex-col h-full p-5 cursor-pointer"
    >
      <div className="flex-grow">
        {title && (
          <div
            className={`mb-1 font-bold whitespace-pre-wrap break-words ${titleStyle.size===1?'text-xs':titleStyle.size===2?'text-sm':titleStyle.size===3?'text-base':titleStyle.size===4?'text-lg':'text-xl'}`}
            style={titleStyle.color ? { color: titleStyle.color } : undefined}
          >
            {title}
          </div>
        )}
        <div className="my-2 h-px bg-slate-700" />
        {groups.length > 0 && (
          <div className="space-y-2 mb-3">
            {groups.map((g, idx) => {
              if (isGroupEmptyForRow(g)) return null;
              return (
              <div key={idx} className="text-sm text-slate-300">
                {g.label && <div className="text-xs text-slate-400 mb-1">{g.label}</div>}
                {(() => {
                  const groupStyle = g.borderColor ? { border: `1px solid ${g.borderColor}`, backgroundColor: hexToRgba(g.borderColor, 0.12) } as React.CSSProperties : undefined;
                  return (
                    <div className="flex flex-wrap gap-2 items-baseline p-2 rounded-md min-w-0" style={groupStyle}>
                      {(g.items || []).map((it: any, j: number) => {
                        const sizeMap: any = { 1:'text-xs', 2:'text-sm', 3:'text-base', 4:'text-lg', 5:'text-xl' };
                        const classNames = `${sizeMap[it.size||3]} ${it.color ? '' : 'text-slate-300'} truncate max-w-full`;
                        const styleColor: React.CSSProperties | undefined = it.color ? { color: it.color } : undefined;
                        if (it.type === 'text') {
                          return <span key={j} className={classNames} style={styleColor}>{it.text}</span>;
                        }
                        const value = it.field ? row[it.field] : '';
                        return <span key={j} className={classNames} style={styleColor}>{(it.prefix||'')}{value}{(it.suffix||'')}</span>;
                      })}
                    </div>
                  );
                })()}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomCard;


