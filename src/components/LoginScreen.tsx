import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { AuthUser } from '../types';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/auth/users')
      .then(response => response.json())
      .then(data => {
        const nextUsers = Array.isArray(data.users) ? data.users : [];
        setUsers(nextUsers);
        if (nextUsers[0]) setUserId(nextUsers[0].id);
      })
      .catch(() => setError("Server bilan bog'lanib bo'lmadi."));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kirish amalga oshmadi.');
      setPin('');
      onLogin(data.user);
    } catch (loginError) {
      setPin('');
      setError(loginError instanceof Error ? loginError.message : 'Kirish amalga oshmadi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-3xl border border-stone-800 bg-stone-900 p-5 sm:p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black">Mobileparts CRM</h1>
            <p className="text-xs text-stone-400">Xodimni tanlang va shaxsiy PIN bilan kiring</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-stone-300">Foydalanuvchi</span>
            <div className="relative">
              <UserRound className="absolute left-3 top-3.5 h-4 w-4 text-stone-500" />
              <select
                value={userId}
                onChange={event => setUserId(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-3 text-sm font-bold outline-none focus:border-amber-400"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-stone-300">PIN-kod</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-stone-500" />
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                type="password"
                value={pin}
                maxLength={8}
                onChange={event => setPin(event.target.value.replace(/\D/g, ''))}
                className="h-11 w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-3 text-lg tracking-[0.35em] outline-none focus:border-amber-400"
                placeholder="••••"
              />
            </div>
          </label>

          {error && <p className="rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">{error}</p>}

          <button
            type="submit"
            disabled={loading || !userId || pin.length < 4}
            className="h-11 w-full rounded-xl bg-amber-400 text-sm font-black text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Tizimga kirish
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-stone-500">Ma'lumotlar do'konning shaxsiy VPS serverida saqlanadi.</p>
      </section>
    </main>
  );
};
