import React, { useEffect, useMemo, useState } from 'react';
import { upsertUserSettings, getUserSettings, UserSettings, CardConfig } from '../services/userSettings';
import { auth } from '../services/firebase';
import CardDesigner from './CardDesigner';

interface SheetManagerProps {
  onSelectDefault: (url: string) => void;
}

const SheetManager: React.FC<SheetManagerProps> = ({ onSelectDefault }) => {
  const user = auth.currentUser;
  const userId = user?.uid;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>({ savedSheets: [], defaultSheetUrl: '' });
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [designSheetUrl, setDesignSheetUrl] = useState<string | null>(null);
  const [designLoading, setDesignLoading] = useState(false);
  const [designInitialCard, setDesignInitialCard] = useState<CardConfig | null>(null);
  const [designInitialCalendar, setDesignInitialCalendar] = useState<CardConfig | null>(null);
  const [activeDesignTab, setActiveDesignTab] = useState<'card' | 'calendar'>('card');

  useEffect(() => {
    const loadInitial = async () => {
      if (!designSheetUrl || !userId) return;
      setDesignLoading(true);
      try {
        const latest = await getUserSettings(userId);
        const cardKey = `${designSheetUrl}:card`;
        const calKey = `${designSheetUrl}:calendar`;
        setDesignInitialCard(latest?.cardConfigs?.[cardKey] || null);
        setDesignInitialCalendar(latest?.cardConfigs?.[calKey] || null);
      } finally {
        setDesignLoading(false);
      }
    };
    loadInitial();
  }, [designSheetUrl, userId]);

  useEffect(() => {
    const init = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const s = (await getUserSettings(userId)) || { savedSheets: [], defaultSheetUrl: '' };
        setSettings(s);
      } catch (e: any) {
        setError(e?.message || '설정을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userId]);

  const canSave = useMemo(() => name.trim().length > 0 && url.trim().length > 0, [name, url]);

  const handleAdd = async () => {
    if (!userId || !canSave) return;
    const id = Math.random().toString(36).slice(2, 10);
    const next = { ...(settings || {}), savedSheets: [ ...(settings.savedSheets || []), { id, name, url } ] };
    await upsertUserSettings(userId, next);
    setSettings(next);
    setName('');
    setUrl('');
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    const nextList = (settings.savedSheets || []).filter(s => s.id !== id);
    const next = { ...settings, savedSheets: nextList };
    await upsertUserSettings(userId, { savedSheets: nextList });
    setSettings(next);
  };

  const startEdit = (id: string) => {
    const t = (settings.savedSheets || []).find(s => s.id === id);
    if (!t) return;
    setEditingId(id);
    setEditName(t.name);
    setEditUrl(t.url);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditUrl('');
  };

  const saveEdit = async () => {
    if (!userId || !editingId) return;
    const nextList = (settings.savedSheets || []).map(s => s.id === editingId ? { ...s, name: editName, url: editUrl } : s);
    await upsertUserSettings(userId, { savedSheets: nextList });
    setSettings(prev => ({ ...(prev || {}), savedSheets: nextList }));
    // 기본 시트가 편집된 URL을 참조했다면 동기화
    const wasDefault = settings.defaultSheetUrl && (settings.savedSheets || []).find(s => s.id === editingId)?.url === settings.defaultSheetUrl;
    if (wasDefault) {
      const updated = nextList.find(s => s.id === editingId);
      if (updated) {
        await upsertUserSettings(userId, { defaultSheetUrl: updated.url });
        setSettings(prev => ({ ...(prev || {}), defaultSheetUrl: updated.url }));
        onSelectDefault(updated.url);
      }
    }
    cancelEdit();
  };

  const handleSetDefault = async (targetUrl: string) => {
    if (!userId) return;
    await upsertUserSettings(userId, { defaultSheetUrl: targetUrl });
    setSettings(prev => ({ ...(prev || {}), defaultSheetUrl: targetUrl }));
    onSelectDefault(targetUrl);
  };

  if (loading) {
    return (
      <div className="p-6 text-slate-300">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {error && <div className="text-sm text-rose-300 bg-rose-900/40 border border-rose-800 rounded p-3">{error}</div>}

      <div>
        <h2 className="text-lg font-semibold mb-3">시트 추가</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="표시 이름"
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md p-2.5"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Google Sheets CSV URL"
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md p-2.5 col-span-2"
          />
          <button
            onClick={handleAdd}
            disabled={!canSave}
            className="sm:col-span-3 py-2.5 bg-sky-600 hover:bg-sky-700 rounded-md disabled:bg-slate-600"
          >
            추가
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">저장된 시트</h2>
        <div className="space-y-2">
          {(settings.savedSheets || []).length === 0 && (
            <div className="text-sm text-slate-400">저장된 시트가 없습니다. 위에서 추가하세요.</div>
          )}
          {(settings.savedSheets || []).map(s => {
            const isDefault = settings.defaultSheetUrl === s.url;
            const isEditing = editingId === s.id;
            return (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-md p-3">
                <div className="min-w-0">
                  {!isEditing ? (
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-200 truncate flex items-center gap-2">
                        <button
                          onClick={() => handleSetDefault(s.url)}
                          aria-pressed={isDefault}
                          className={`w-4 h-4 rounded-sm border ${isDefault ? 'border-emerald-500 bg-emerald-600/40 text-emerald-100' : 'border-slate-600 bg-slate-800'} flex items-center justify-center text-[10px]`}
                          title="기본 시트 표시/설정"
                        >
                          {isDefault ? '✓' : ''}
                        </button>
                        {s.name}
                      </div>
                      {/* 설정 버튼 제거: 체크박스로 대체 */}
                      <button
                        onClick={() => setDesignSheetUrl(s.url)}
                        className="px-2 py-0.5 text-[11px] rounded-full border border-sky-500/50 text-sky-300 hover:bg-sky-500/10"
                        title="디자인"
                      >디자인</button>
                      <button
                        onClick={() => startEdit(s.id)}
                        className="px-2 py-0.5 text-[11px] rounded-full border border-sky-500/50 text-sky-300 hover:bg-sky-500/10"
                        title="편집"
                      >편집</button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-2 py-0.5 text-[11px] rounded-full border border-rose-500/50 text-rose-300 hover:bg-rose-500/10"
                        title="삭제"
                      >삭제</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <input value={editName} onChange={(e)=>setEditName(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md p-2" />
                      <input value={editUrl} onChange={(e)=>setEditUrl(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md p-2 sm:col-span-2" />
                      <div className="sm:col-span-3 flex items-center gap-2">
                        <button onClick={saveEdit} className="px-2 py-1 text-[11px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700">저장</button>
                        <button onClick={cancelEdit} className="px-2 py-1 text-[11px] rounded-md bg-slate-700 text-white hover:bg-slate-600">취소</button>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-slate-400 truncate">{s.url}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    {designSheetUrl && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={() => setDesignSheetUrl(null)}>
        <div className="bg-slate-900 w-full max-w-5xl rounded-lg border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
          <header className="px-4 pt-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={()=>setActiveDesignTab('card')} className={`px-3 py-2 text-sm rounded-t-md ${activeDesignTab==='card'?'bg-slate-800 text-sky-300':'text-slate-400 hover:text-slate-200'}`}>카드디자인</button>
                <button onClick={()=>setActiveDesignTab('calendar')} className={`px-3 py-2 text-sm rounded-t-md ${activeDesignTab==='calendar'?'bg-slate-800 text-sky-300':'text-slate-400 hover:text-slate-200'}`}>달력디자인</button>
              </div>
              <button onClick={() => setDesignSheetUrl(null)} className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600">닫기</button>
            </div>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {designLoading ? (
              <div className="p-6 text-slate-300">불러오는 중...</div>
            ) : (
              activeDesignTab==='card' ? (
                <CardDesigner key={`${designSheetUrl}:card`} mode="card" sheetUrl={designSheetUrl} initialConfig={designInitialCard || undefined} onSaved={() => setDesignSheetUrl(null)} />
              ) : (
                <CardDesigner key={`${designSheetUrl}:calendar`} mode="calendar" sheetUrl={designSheetUrl} initialConfig={designInitialCalendar || undefined} onSaved={() => setDesignSheetUrl(null)} />
              )
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default SheetManager;


