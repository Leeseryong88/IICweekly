
import React, { useEffect } from 'react';
import { SheetRow } from '../types';
import { CardConfig } from '../services/userSettings';
import CloseIcon from './icons/CloseIcon';

interface CardModalProps {
  cardData: SheetRow;
  onClose: () => void;
  config?: CardConfig | null;
}

const ModalSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => {
    if (!children || (typeof children === 'string' && !children.trim())) return null;
    return (
        <div className={className}>
            <p className="text-sm font-semibold text-slate-400 mb-1">{title}</p>
            <div className="text-base text-slate-200 whitespace-pre-wrap">{children}</div>
        </div>
    );
};


const CardModal: React.FC<CardModalProps> = ({ cardData, onClose, config }) => {
  const hasBusinessTrip = !!(cardData['출장(시작일)'] || cardData['출장내용']);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const renderCustom = () => {
    const fields = config?.fields || {} as any;
    const titleKey = fields.title as string | undefined;
    const titleStyle = fields.titleStyle || {};
    const groups = (fields.groups || []) as any[];

    const isUrl = (v: string): boolean => {
      if (!v) return false;
      try {
        const u = new URL(v.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch { return false; }
    };

    return (
      <div className="p-6 space-y-5 overflow-y-auto">
        {titleKey && (
          <div className={`font-bold ${titleStyle.size===1?'text-xs':titleStyle.size===2?'text-sm':titleStyle.size===3?'text-base':titleStyle.size===4?'text-lg':'text-xl'}`} style={titleStyle.color ? { color: titleStyle.color } : undefined}>
            {cardData[titleKey]}
          </div>
        )}
        {(groups||[]).map((g, gi) => (
          <div key={gi} className="text-sm text-slate-300">
            {g.label && <div className="text-xs text-slate-400 mb-1">{g.label}</div>}
            <div className="flex flex-wrap gap-2 items-baseline p-3 rounded-md" style={g.borderColor ? { border: `1px solid ${g.borderColor}`, backgroundColor: `${g.borderColor}20` } : undefined}>
              {(g.items||[]).map((it:any, j:number) => {
                const sizeMap: any = { 1:'text-xs', 2:'text-sm', 3:'text-base', 4:'text-lg', 5:'text-xl' };
                const classNames = `${sizeMap[it.size||3]} ${it.color ? '' : 'text-slate-300'}`;
                const styleColor: React.CSSProperties | undefined = it.color ? { color: it.color } : undefined;
                if (it.type === 'text') {
                  const content = String(it.text||'');
                  if (isUrl(content)) {
                    return <a key={j} className={`${classNames} underline text-sky-400`} style={styleColor} href={content} target="_blank" rel="noopener noreferrer">{content}</a>;
                  }
                  return <span key={j} className={classNames} style={styleColor}>{content}</span>;
                }
                const value = String(it.field ? (cardData as any)[it.field] : '') || '';
                if (isUrl(value)) {
                  const label = `${it.prefix||''}${value}${it.suffix||''}`;
                  return <a key={j} className={`${classNames} underline text-sky-400`} style={styleColor} href={value} target="_blank" rel="noopener noreferrer">{label}</a>;
                }
                return <span key={j} className={classNames} style={styleColor}>{(it.prefix||'')}{value}{(it.suffix||'')}</span>;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-5xl rounded-xl border border-slate-700 shadow-2xl flex flex-col animate-slide-up max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-5 flex justify-between items-center border-b border-slate-800 flex-shrink-0">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">작성자</p>
            <h2 className="text-xl font-bold text-sky-400">{cardData['작성자']}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-700 transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        {config && config.template === 'custom' ? renderCustom() : (
          <div className="p-6 space-y-5 overflow-y-auto">
            <p className="text-slate-400 text-sm">커스텀 설정해야합니다.</p>
            <ModalSection title="기간">
                {cardData['시작일'] && cardData['종료일'] ? `${cardData['시작일']} ~ ${cardData['종료일']}` : null}
            </ModalSection>
            <ModalSection title="내용">
                {cardData['주요일정'] || cardData['이슈'] || ''}
            </ModalSection>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardModal;
