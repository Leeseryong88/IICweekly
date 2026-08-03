import React, { useEffect, useMemo, useState } from 'react';
import { fetchSheetHeaders } from '../services/sheetService';
import { CardConfig, CardFieldMapping, CardTemplateType, upsertUserSettings } from '../services/userSettings';
import { auth } from '../services/firebase';

interface CardDesignerProps {
  sheetUrl: string;
  initialConfig?: CardConfig | null;
  onSaved?: (config: CardConfig) => void;
  mode: 'card' | 'calendar';
}

type DraggableItem = { id: string; label: string };

// Convert hex color to rgba for subtle background shading in preview
const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex) return `rgba(148, 163, 184, ${alpha})`;
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r,g,b].some(n => Number.isNaN(n))) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: '없음', value: '' },
  { label: '하늘', value: '#38bdf8' },
  { label: '초록', value: '#34d399' },
  { label: '노랑', value: '#fbbf24' },
  { label: '주황', value: '#fb923c' },
  { label: '빨강', value: '#f87171' },
  { label: '보라', value: '#a78bfa' },
  { label: '핑크', value: '#f472b6' },
  { label: '청록', value: '#2dd4bf' },
  { label: '회색', value: '#94a3b8' },
];

const ColorDropdown: React.FC<{ value?: string; onChange: (v: string) => void; }> = ({ value = '', onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 text-[11px] rounded border border-slate-600 bg-slate-800 flex items-center gap-2"
        title="색상 선택"
      >
        <span className="w-3 h-3 rounded" style={{ backgroundColor: value || 'transparent', outline: value ? '1px solid rgba(255,255,255,0.2)' : '1px dashed rgba(148,163,184,0.6)' }} />
        <span className="text-slate-300">색상</span>
        <span className="text-slate-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 p-2 bg-slate-900 border border-slate-700 rounded shadow-lg grid grid-cols-5 gap-2">
          {PRESET_COLORS.map(c => (
            <button key={c.label} type="button" title={c.label} onClick={() => { onChange(c.value); setOpen(false); }} className="w-6 h-6 rounded border border-slate-600" style={{ backgroundColor: c.value || 'transparent' }} />
          ))}
        </div>
      )}
    </div>
  );
};

const DraggableBadge: React.FC<{ item: DraggableItem }> = ({ item }) => (
  <div
    draggable
    onDragStart={(e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify(item));
    }}
    className="px-2 py-1 text-xs rounded-md bg-slate-700 text-slate-200 border border-slate-600"
  >
    {item.label}
  </div>
);

const DropZone: React.FC<{
  title: string;
  acceptMultiple?: boolean;
  items: DraggableItem[];
  onDropItems: (items: DraggableItem[]) => void;
  onClear?: () => void;
  onItemClick?: (index: number) => void;
}> = ({ title, acceptMultiple, items, onDropItems, onClear, onItemClick }) => (
  <div
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/plain');
      try {
        const parsed: DraggableItem = JSON.parse(raw);
        const next = acceptMultiple ? [...items, parsed] : [parsed];
        onDropItems(next);
      } catch (_) {}
    }}
    className="min-h-[54px] p-3 rounded-md border border-dashed border-slate-600 bg-slate-800"
  >
    <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
      <span>{title}</span>
      {items.length > 0 && (
        <button onClick={onClear} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600">비우기</button>
      )}
    </div>
    <div className="flex flex-wrap gap-2">
      {items.map((i, idx) => (
        <button key={i.id} type="button" onClick={() => onItemClick?.(idx)} className="px-2 py-1 text-xs rounded bg-slate-700 border border-slate-600 hover:bg-slate-600">
          {i.label}
        </button>
      ))}
      {items.length === 0 && <span className="text-xs text-slate-500">여기에 드래그</span>}
    </div>
  </div>
);

const CardDesigner: React.FC<CardDesignerProps> = ({ sheetUrl, initialConfig, onSaved, mode }) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mode-driven UI: 'card' or 'calendar'. Template state는 사용하지 않음
  const [titleZone, setTitleZone] = useState<DraggableItem[]>(
    initialConfig?.fields.title ? [{ id: initialConfig.fields.title, label: initialConfig.fields.title }] : []
  );
  const [groups, setGroups] = useState<Array<{ label?: string; borderColor?: string; items: Array<any> }>>(
    (initialConfig?.fields.groups || []).map(g => ({ label: g.label, borderColor: (g as any).borderColor, items: (g.items || []).map((it: any) => ({ ...it })) }))
  );
  const [titleColor, setTitleColor] = useState<string>(initialConfig?.fields.titleStyle?.color || '');
  const [titleSize, setTitleSize] = useState<1 | 2 | 3 | 4 | 5>((initialConfig?.fields.titleStyle?.size as any) || 3);
  const [isTitleEditing, setIsTitleEditing] = useState<boolean>(false);
  const [startDateField, setStartDateField] = useState<string>(initialConfig?.fields.filterMapping?.startDateField || '');
  const [authorField, setAuthorField] = useState<string>(initialConfig?.fields.filterMapping?.authorField || '');

  // Calendar mapping states
  const [calStart, setCalStart] = useState<string>(initialConfig?.fields.calendarMapping?.startDateField || '');
  const [calEnd, setCalEnd] = useState<string>(initialConfig?.fields.calendarMapping?.endDateField || '');
  const [calAuthor, setCalAuthor] = useState<string>(initialConfig?.fields.calendarMapping?.authorField || '');
  const [calContent, setCalContent] = useState<string>(initialConfig?.fields.calendarMapping?.contentField || '');
  const [calType, setCalType] = useState<string>(initialConfig?.fields.calendarMapping?.typeLabel || '');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const h = await fetchSheetHeaders(sheetUrl);
        setHeaders(h);
      } catch (e: any) {
        setError(e?.message || '헤더를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sheetUrl]);

  const palette: DraggableItem[] = useMemo(() => headers.map(h => ({ id: h, label: h })), [headers]);

  const handleAddGroup = () => setGroups(prev => [...prev, { label: '그룹', items: [] }]);
  const handleClear = () => { setTitleZone([]); setGroups([]); };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const fields: CardFieldMapping = mode === 'card' ? {
      headerTitle: (initialConfig as any)?.fields?.headerTitle,
      title: titleZone[0]?.id,
      titleStyle: { color: titleColor || undefined, size: titleSize },
      groups: groups.map(g => ({ label: g.label, borderColor: (g as any).borderColor, items: g.items })),
      filterMapping: { startDateField: startDateField || undefined, authorField: authorField || undefined },
    } : {
      headerTitle: (initialConfig as any)?.fields?.headerTitle,
      filterMapping: { startDateField: startDateField || undefined, authorField: authorField || undefined },
      calendarMapping: calStart && calContent ? {
        startDateField: calStart,
        endDateField: calEnd || undefined,
        authorField: calAuthor || undefined,
        contentField: calContent,
        typeLabel: calType || undefined,
      } : undefined,
    };
    const config: CardConfig = { template: mode === 'card' ? 'custom' : 'calendar', fields };
    // Firestore는 undefined 값을 허용하지 않으므로 제거
    const deepClean = (val: any): any => {
      if (Array.isArray(val)) {
        return val.map(deepClean).filter(v => v !== undefined);
      }
      if (val && typeof val === 'object') {
        const out: any = {};
        Object.keys(val).forEach((k) => {
          const cleaned = deepClean((val as any)[k]);
          if (cleaned !== undefined) out[k] = cleaned;
        });
        return out;
      }
      return val === undefined ? undefined : val;
    };
    const sanitized = deepClean(config) as CardConfig;
    const key = `${sheetUrl}:${mode}`;
    await upsertUserSettings(user.uid, { cardConfigs: { [key]: sanitized } });
    onSaved?.(config);
  };

  if (loading) return <div className="p-4 text-slate-300">헤더 불러오는 중...</div>;
  if (error) return <div className="p-4 text-rose-300">{error}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Palette */}
      <div className="lg:col-span-1 space-y-4 sticky top-0 self-start">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">1) 데이터 컬럼</h3>
          <div className="flex flex-wrap gap-2">
            {palette.map((p) => (<DraggableBadge key={p.id} item={p} />))}
          </div>
        </div>
      </div>

      {/* Designer */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">{mode === 'card' ? '카드디자인' : '달력디자인'}</div>
          {mode === 'card' && <button onClick={handleAddGroup} className="ml-auto px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600">그룹 추가</button>}
          {mode === 'card' && <button onClick={handleClear} className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600">초기화</button>}
          <button onClick={handleSave} className="ml-auto px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white">저장</button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">페이지 헤더 제목</label>
            <input
              defaultValue={initialConfig?.fields.headerTitle || ''}
              onChange={(e)=>{ (initialConfig as any) = { ...(initialConfig||{}), fields: { ...(initialConfig?.fields||{}), headerTitle: e.target.value } } as any; }}
              placeholder="예: 팀 대시보드"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5"
            />
          </div>
          {mode === 'card' && (
            <>
              <h3 className="text-sm font-semibold text-slate-300">제목</h3>
              <DropZone title="제목(데이터 1개)" items={titleZone} onDropItems={(items)=>{ setTitleZone(items); setIsTitleEditing(true); }} onClear={()=>{ setTitleZone([]); setIsTitleEditing(false); }} onItemClick={()=>setIsTitleEditing(v=>!v)} />
              {isTitleEditing && titleZone[0] && (
                <div className="flex items-center gap-2">
                  <ColorDropdown value={titleColor} onChange={setTitleColor} />
                  <select value={titleSize} onChange={(e)=>setTitleSize(Number(e.target.value) as any)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">기간 시작일 컬럼</label>
              <select value={startDateField} onChange={(e)=>setStartDateField(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                <option value="">선택 안 함</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">작성자 컬럼</label>
              <select value={authorField} onChange={(e)=>setAuthorField(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                <option value="">선택 안 함</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Calendar mapping UI */}
        {mode === 'calendar' && (
          <div className="space-y-3 p-3 rounded-md border border-slate-700 bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-300">달력 매핑</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">시작일 컬럼 (필수)</label>
                <select value={calStart} onChange={(e)=>setCalStart(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                  <option value="">선택</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">종료일 컬럼 (선택)</label>
                <select value={calEnd} onChange={(e)=>setCalEnd(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                  <option value="">선택 안 함</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">작성자 컬럼 (선택)</label>
                <select value={calAuthor} onChange={(e)=>setCalAuthor(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                  <option value="">선택 안 함</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">내용 컬럼 (필수)</label>
                <select value={calContent} onChange={(e)=>setCalContent(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5">
                  <option value="">선택</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">타입 라벨 (선택, 예: 출장)</label>
                <input value={calType} onChange={(e)=>setCalType(e.target.value)} placeholder="예: 출장" className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5" />
              </div>
            </div>
            <div className="text-xs text-slate-400">저장 후 달력 보기에서 이 매핑으로 이벤트가 생성됩니다.</div>
          </div>
        )}

        {/* Groups (e.g., 기간 묶음) */}
        {mode === 'card' && (
        <div className="space-y-3">
          {groups.map((g, idx) => (
            <div key={idx} className="p-3 rounded-md border border-slate-700 bg-slate-900 space-y-2">
              <div className="flex items-center gap-2">
                <input value={g.label || ''} onChange={(e)=>{
                  const next=[...groups]; next[idx] = { ...next[idx], label: e.target.value } as any; setGroups(next);
                }} placeholder="그룹 제목" className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1.5 flex-1" />
                <ColorDropdown value={(g as any).borderColor || ''} onChange={(v)=>{ const next=[...groups]; (next[idx] as any).borderColor = v; setGroups(next); }} />
                <button onClick={()=>setGroups(prev=>prev.filter((_,i)=>i!==idx))} className="px-2 py-1 text-[11px] rounded bg-rose-700 text-white hover:bg-rose-600">삭제</button>
              </div>
              {/* 항목 추가 (데이터 드롭 + 사이사이 텍스트 입력) */}
              <div className="flex items-center gap-2">
                <button onClick={()=>{
                  const next=[...groups];
                  next[idx] = { ...next[idx], items: [ ...(next[idx].items||[]), { type:'data', field:'', prefix:'', suffix:'', size:'sm' } ] } as any;
                  setGroups(next);
                }} className="px-2 py-1 text-[11px] rounded bg-slate-700 hover:bg-slate-600">항목 추가</button>
              </div>
              {/* 그룹 필드: 여러 항목을 한 줄에서 편집 */}
              <div className="space-y-2">
                <div
                  onDragOver={(e)=>e.preventDefault()}
                  onDrop={(e)=>{ e.preventDefault(); const raw=e.dataTransfer.getData('text/plain'); try{ const parsed=JSON.parse(raw) as DraggableItem; const next=[...groups]; (next[idx].items as any).push({ type:'data', field: parsed.id, size:'sm' }); setGroups(next);} catch(_){}}}
                  className="p-2 rounded-md border border-dashed border-slate-600 bg-slate-800"
                >
                  <div className="flex flex-wrap gap-2 items-center">
                    {(g.items||[]).map((it:any, j:number) => (
                      it.type==='data' ? (
                        <div key={j} className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded px-2 py-1">
                          <span className="text-xs">{it.field}</span>
                          <select value={it.size||3} onChange={(e)=>{ const next=[...groups]; (next[idx].items as any)[j] = { ...it, size: Number(e.target.value) }; setGroups(next); }} className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded p-1">
                            {[1,2,3,4,5].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                          <ColorDropdown value={it.color||''} onChange={(v)=>{ const next=[...groups]; (next[idx].items as any)[j] = { ...it, color: v }; setGroups(next); }} />
                          <button onClick={()=>{ const next=[...groups]; (next[idx].items as any).splice(j,1); setGroups(next); }} className="text-[11px] px-1.5 py-0.5 rounded bg-rose-700 text-white">삭제</button>
                        </div>
                      ) : (
                        <div key={j} className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded px-2 py-1">
                          <input value={it.text||''} onChange={(e)=>{ const next=[...groups]; (next[idx].items as any)[j] = { ...it, text: e.target.value, type:'text' }; setGroups(next); }} placeholder="텍스트" className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded p-1" />
                          <button onClick={()=>{ const next=[...groups]; (next[idx].items as any).splice(j,1); setGroups(next); }} className="text-[11px] px-1.5 py-0.5 rounded bg-rose-700 text-white">삭제</button>
                        </div>
                      )
                    ))}
                    <button onClick={()=>{ const next=[...groups]; (next[idx].items as any).push({ type:'text', text:'' }); setGroups(next); }} className="text-[11px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">텍스트 추가</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Preview */}
        <div className="mt-4 p-4 rounded-lg border border-slate-700 bg-slate-900 max-h-[60vh] overflow-auto">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">미리보기</h4>
          <div className="space-y-3">
            {mode === 'card' && titleZone[0] && (
              <div
                className={`${titleSize==='sm'?'text-sm':titleSize==='base'?'text-base':titleSize==='lg'?'text-lg':'text-xl'} font-semibold`}
                style={titleColor ? { color: titleColor } : undefined}
              >
                {titleZone[0].label}
              </div>
            )}
            {mode === 'card' && groups.map((g, i) => (
              <div key={i} className="text-sm text-slate-300">
                {g.label && <div className="text-xs text-slate-400 mb-1">{g.label}</div>}
                <div
                  className="flex flex-wrap gap-2 items-baseline p-2 rounded-md"
                  style={(g as any).borderColor ? { border: `1px solid ${(g as any).borderColor}`, backgroundColor: hexToRgba((g as any).borderColor, 0.12) } : undefined}
                >
                  {(g.items||[]).map((it:any, j:number) => {
                    const sizeMap: any = { xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg' };
                    const style = `${sizeMap[it.size||'sm']} ${it.color ? '' : 'text-slate-300'}`;
                    const styleColor: React.CSSProperties | undefined = it.color ? { color: it.color } : undefined;
                    if (it.type==='text') return <span key={j} className={style} style={styleColor}>{it.text||'텍스트'}</span>;
                    return <span key={j} className={style} style={styleColor}>{(it.prefix||'')}{it.field||'필드'}{(it.suffix||'')}</span>;
                  })}
                </div>
              </div>
            ))}
            {mode === 'calendar' && (
              <div className="text-xs text-slate-400">
                달력 매핑 사용: 시작일 [{calStart||'미설정'}], 종료일 [{calEnd||'없음'}], 작성자 [{calAuthor||'작성자'}], 내용 [{calContent||'미설정'}], 타입 [{calType||'없음'}]
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDesigner;


