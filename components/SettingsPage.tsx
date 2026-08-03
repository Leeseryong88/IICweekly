import React from 'react';
import SheetManager from './SheetManager';
import ChangePassword from './ChangePassword';

const SettingsPage: React.FC = () => {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans">
      <header className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-sky-400">설정</h1>
          <a href="/" className="px-3 py-1.5 text-sm rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700">메인으로</a>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8 space-y-6">
        <SheetManager onSelectDefault={() => {}} />
        <ChangePassword />
      </main>
    </div>
  );
};

export default SettingsPage;


