import React, { PropsWithChildren, useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './Login';

const AuthGate: React.FC<PropsWithChildren> = ({ children }) => {
  const [initializing, setInitializing] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthed(!!user);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthed) {
    return <Login />;
  }

  return <>{children}</>;
};

export default AuthGate;


