import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import { AuthUser, UserRole } from '../types';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

const roleOptions: Array<{ role: UserRole; label: string; hint: string; Icon: typeof ShieldCheck }> = [
  { role: 'owner', label: 'Boshqaruvchi', hint: 'To‘liq boshqaruv', Icon: ShieldCheck },
  { role: 'worker', label: 'Ishchi', hint: 'Savdo va mijozlar', Icon: UserRound },
  { role: 'technician', label: 'Usta', hint: 'Telefon ta’miri', Icon: Wrench }
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('owner');
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleUsers = useMemo(() => users.filter(user => user.role === selectedRole), [users, selectedRole]);

  useEffect(() => {
    fetch('/api/v1/auth/users')
      .then(response => response.json())
      .then(data => {
        const nextUsers: AuthUser[] = Array.isArray(data.users) ? data.users : [];
        setUsers(nextUsers);
        const owner = nextUsers.find(user => user.role === 'owner');
        if (owner) setUserId(owner.id);
      })
      .catch(() => setError("Server bilan bog'lanib bo'lmadi."));
  }, []);

  const chooseRole = (role: UserRole) => {
    const first = users.find(user => user.role === role);
    setSelectedRole(role);
    setUserId(first?.id || '');
    setPin('');
    setError('');
  };

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
      <section className="w-full max-w-lg rounded-3xl border border-stone-800 bg-stone-900 p-5 sm:p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center"><ShieldCheck className="h-7 w-7" /></div>
          <div><h1 className="text-xl font-black">Mobileparts CRM</h1><p className="text-xs text-stone-400">Bo‘limni tanlang va shaxsiy PIN bilan kiring</p></div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Kirish bo‘limi">
          {roleOptions.map(({ role, label, hint, Icon }) => {
            const available = users.some(user => user.role === role);
            const active = selectedRole === role;
            return (
              <button key={role} type="button" onClick={() => chooseRole(role)} className={`min-h-24 rounded-2xl border px-2 py-3 text-center transition ${active ? 'border-amber-400 bg-amber-400 text-stone-950' : 'border-stone-700 bg-stone-950 text-stone-200 hover:border-stone-500'}`}>
                <Icon className="mx-auto mb-1.5 h-5 w-5" /><span className="block text-xs font-black">{label}</span>
                <span className={`mt-0.5 block text-[9px] ${active ? 'text-stone-700' : 'text-stone-500'}`}>{available ? hint : 'Hisob yaratilmagan'}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {roleUsers.length > 0 ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-stone-300">Foydalanuvchi</span>
              <div className="relative"><UserRound className="absolute left-3 top-3.5 h-4 w-4 text-stone-500" />
                <select value={userId} onChange={event => setUserId(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-3 text-sm font-bold outline-none focus:border-amber-400">
                  {roleUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </div>
            </label>
          ) : <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 px-3 py-3 text-xs text-amber-200">Bu bo‘lim uchun hisob hali yaratilmagan. Boshqaruvchi tizim sozlamalaridan foydalanuvchi qo‘shadi.</div>}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-stone-300">PIN-kod</span>
            <div className="relative"><KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-stone-500" />
              <input autoFocus inputMode="numeric" pattern="[0-9]*" type="password" value={pin} maxLength={8} disabled={!userId} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} className="h-11 w-full rounded-xl border border-stone-700 bg-stone-950 pl-10 pr-3 text-lg tracking-[0.35em] outline-none focus:border-amber-400 disabled:opacity-40" placeholder="••••" />
            </div>
          </label>

          {error && <p className="rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">{error}</p>}
          <button type="submit" disabled={loading || !userId || pin.length < 4} className="h-11 w-full rounded-xl bg-amber-400 text-sm font-black text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Tizimga kirish
          </button>
        </form>
        <p className="mt-5 text-center text-[11px] text-stone-500">Ma'lumotlar do'konning shaxsiy VPS serverida saqlanadi.</p>
      </section>
    </main>
  );
};
