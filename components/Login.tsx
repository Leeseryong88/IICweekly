import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface LoginProps {
  onLoggedIn?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoggedIn?.();
    } catch (err: any) {
      setError(err?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <h1 className="text-xl font-bold text-center mb-6 text-sky-400">IIC Leader Console</h1>
        <p className="text-sm text-slate-400 text-center mb-6">로그인하여 대시보드를 이용하세요.</p>

        {error && (
          <div className="mb-4 text-sm text-rose-300 bg-rose-900/40 border border-rose-800 rounded p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5"
              placeholder="비밀번호"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 rounded-md font-medium disabled:bg-slate-600"
          >
            {loading ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-6">회원가입 기능은 제공하지 않습니다. 관리자에 의해 미리 생성된 계정만 로그인할 수 있습니다.</p>
      </div>
    </div>
  );
};

export default Login;


