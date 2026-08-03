import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

const ChangePassword: React.FC = () => {
  const user = auth.currentUser;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!currentPassword && !!newPassword && newPassword === confirmPassword && newPassword.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!user || !user.email) {
      setError('로그인이 필요합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      // 재인증
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      // 비밀번호 변경
      await updatePassword(user, newPassword);
      setMessage('비밀번호가 변경되었습니다. 다시 로그인해야 할 수 있습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      const msg = e?.code ? mapFirebaseError(e.code) : (e?.message || '비밀번호 변경에 실패했습니다.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-3">비밀번호 변경</h2>
      {message && <div className="mb-3 text-sm text-emerald-300 bg-emerald-900/30 border border-emerald-800 rounded p-3">{message}</div>}
      {error && <div className="mb-3 text-sm text-rose-300 bg-rose-900/30 border border-rose-800 rounded p-3">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">현재 비밀번호</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5"
            placeholder="현재 비밀번호"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5"
              placeholder="6자 이상"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block p-2.5"
              placeholder="다시 입력"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md disabled:bg-slate-600"
        >
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
};

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
      return '현재 비밀번호가 올바르지 않습니다.';
    case 'auth/weak-password':
      return '새 비밀번호가 안전하지 않습니다(6자 이상)';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인한 뒤 시도해 주세요.';
    default:
      return '비밀번호 변경에 실패했습니다.';
  }
}

export default ChangePassword;


