import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { AuthUser } from '../types';

export const WorkerManagement: React.FC = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'worker' | 'technician'>('worker');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    const response = await fetch('/api/v1/auth/manage/users');
    const data = await response.json();
    if (response.ok) setUsers(data.users || []);
  };

  useEffect(() => { refresh().catch(() => setMessage("Xodimlar ro'yxati yuklanmadi.")); }, []);

  const addWorker = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/auth/manage/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin, role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setName('');
      setPin('');
      setRole('worker');
      setMessage(`${data.user.name} qo'shildi.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Xodim qo'shilmadi.");
    } finally {
      setBusy(false);
    }
  };

  const updateUser = async (id: string, update: { active?: boolean; pin?: string }) => {
    setMessage('');
    const response = await fetch(`/api/v1/auth/manage/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });
    const data = await response.json();
    setMessage(response.ok ? 'O‘zgarish saqlandi.' : (data.error || 'Saqlanmadi.'));
    if (response.ok) await refresh();
  };

  const changePin = (user: AuthUser) => {
    const nextPin = window.prompt(`${user.name} uchun yangi 4–8 xonali PIN kiriting:`);
    if (nextPin) updateUser(user.id, { pin: nextPin });
  };

  return (
    <section className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-500" /><h2 className="font-black text-stone-900">Xodimlar va rollar</h2></div>
          <p className="mt-1 text-xs text-stone-500">Ishchi savdo kassasiga, usta esa faqat telefon ta'miri bo‘limiga o‘z PINi bilan kiradi.</p>
        </div>
        <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-black text-amber-300">{users.length} foydalanuvchi</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {users.map(user => (
          <div key={user.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0"><UserRound className="h-4 w-4 text-stone-500 shrink-0" /><div className="min-w-0"><div className="truncate text-sm font-black">{user.name}</div><div className="text-[10px] uppercase text-stone-500">{user.role === 'owner' ? 'Boshqaruvchi' : user.role === 'technician' ? 'Usta' : 'Ishchi'} • {user.active ? 'Faol' : 'O‘chiq'}</div></div></div>
              <button type="button" onClick={() => changePin(user)} className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 hover:border-amber-400" title="PINni yangilash"><KeyRound className="h-3.5 w-3.5" /></button>
            </div>
            {user.role !== 'owner' && <button type="button" onClick={() => updateUser(user.id, { active: !user.active })} className="mt-3 w-full rounded-lg border border-stone-200 bg-white py-1.5 text-[11px] font-bold text-stone-600">{user.active ? 'Kirishni to‘xtatish' : 'Qayta faollashtirish'}</button>}
          </div>
        ))}
      </div>

      <form onSubmit={addWorker} className="mt-4 grid gap-2 border-t border-stone-100 pt-4 sm:grid-cols-[140px_1fr_160px_auto]">
        <select value={role} onChange={event => setRole(event.target.value as 'worker' | 'technician')} className="h-10 rounded-xl border border-stone-200 px-3 text-sm font-bold outline-none focus:border-amber-400">
          <option value="worker">Ishchi</option>
          <option value="technician">Usta</option>
        </select>
        <input value={name} onChange={event => setName(event.target.value)} placeholder={role === 'technician' ? 'Usta ismi' : 'Yangi ishchi ismi'} className="h-10 rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-amber-400" />
        <input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} inputMode="numeric" type="password" maxLength={8} placeholder="Shaxsiy PIN" className="h-10 rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-amber-400" />
        <button disabled={busy || name.trim().length < 2 || pin.length < 4} className="h-10 rounded-xl bg-stone-900 px-4 text-xs font-black text-white disabled:opacity-40 flex items-center justify-center gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Xodim qo‘shish</button>
      </form>
      {message && <p className="mt-2 text-xs font-bold text-stone-600">{message}</p>}
    </section>
  );
};
