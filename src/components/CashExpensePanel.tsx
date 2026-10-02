import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BanknoteArrowDown, ChevronDown, ChevronUp, Plus, Undo2 } from 'lucide-react';
import type { AuthUser, CashExpense, CashExpenseCategory } from '../types';
import { formatMoney } from '../utils/formatters';

interface Props {
  user: AuthUser;
  cashRevenue: number;
}

const todayInTashkent = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

export const CashExpensePanel: React.FC<Props> = ({ user, cashRevenue }) => {
  const [items, setItems] = useState<CashExpense[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<CashExpenseCategory>('boshqa');

  const load = useCallback(async () => {
    const today = todayInTashkent();
    const response = await fetch(`/api/v1/expenses?from=${today}&to=${today}`, { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    if (Array.isArray(body.data)) setItems(body.data);
  }, []);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const activeTotal = useMemo(
    () => items.filter(item => !item.cancelledAt).reduce((sum, item) => sum + item.amount, 0),
    [items]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, amount: Number(amount), reason, category })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Chiqim saqlanmadi.');
      setItems(current => [body.data, ...current]);
      setRecipient(''); setAmount(''); setReason(''); setCategory('boshqa');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chiqim saqlanmadi.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (item: CashExpense) => {
    const cancellationReason = window.prompt('Bekor qilish sababini yozing:')?.trim();
    if (!cancellationReason) return;
    const response = await fetch(`/api/v1/expenses/${item.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: cancellationReason })
    });
    const body = await response.json();
    if (!response.ok) return window.alert(body.error || 'Bekor qilinmadi.');
    setItems(current => current.map(row => row.id === item.id ? body.data : row));
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => setExpanded(value => !value)} className="w-full p-3 sm:p-4 flex items-center gap-3 text-left">
        <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><BanknoteArrowDown className="w-5 h-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">Kassadan chiqim</span>
          <span className="block text-[11px] text-stone-500">Bugun {items.filter(item => !item.cancelledAt).length} ta • {formatMoney(activeTotal)}</span>
        </span>
        <span className="text-right mr-2"><span className="block text-[10px] text-stone-500">Naqd qoldiq</span><span className={`block font-mono text-sm font-black ${cashRevenue - activeTotal < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(cashRevenue - activeTotal)}</span></span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && <div className="border-t border-stone-100 p-3 sm:p-4 grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] gap-4">
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-2.5">
          <input value={recipient} onChange={event => setRecipient(event.target.value)} required placeholder="Kim oldi?" className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          <input value={amount} onChange={event => setAmount(event.target.value)} required min="1" step="1" type="number" placeholder="Summa (so‘m)" className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          <select value={category} onChange={event => setCategory(event.target.value as CashExpenseCategory)} className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
            <option value="tushlik">Tushlik</option><option value="taminotchi">Ta’minotchiga to‘lov</option><option value="transport">Transport</option><option value="boshqa">Boshqa</option>
          </select>
          <input value={reason} onChange={event => setReason(event.target.value)} required minLength={3} placeholder="Nima uchun?" className="rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          {error && <p className="sm:col-span-2 text-xs font-bold text-rose-600">{error}</p>}
          <button disabled={saving} className="sm:col-span-2 rounded-xl bg-stone-950 text-white px-4 py-2.5 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" />{saving ? 'Saqlanmoqda…' : 'Chiqimni saqlash'}</button>
        </form>

        <div className="max-h-56 overflow-y-auto space-y-2">
          {items.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-500">Bugun chiqim yozilmagan.</p>}
          {items.map(item => <div key={item.id} className={`rounded-xl border p-3 ${item.cancelledAt ? 'bg-stone-50 opacity-60' : 'bg-white'}`}>
            <div className="flex items-start justify-between gap-2"><div><div className="text-xs font-black">{item.recipient} • {formatMoney(item.amount)}</div><div className="text-[11px] text-stone-500">{item.reason} — {item.createdByName}</div></div>{user.role === 'owner' && !item.cancelledAt && <button type="button" onClick={() => cancel(item)} title="Bekor qilish" className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"><Undo2 className="w-4 h-4" /></button>}</div>
            {item.cancelledAt && <div className="mt-1 text-[10px] font-bold text-rose-600">Bekor qilingan: {item.cancellationReason}</div>}
          </div>)}
        </div>
      </div>}
    </section>
  );
};
