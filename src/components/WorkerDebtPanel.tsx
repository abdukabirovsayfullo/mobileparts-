import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Search } from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import type { StoreSettings } from '../types';
import type { PeriodCustomerReport } from '../utils/saleAccounting';
import { DebtPeriodReport } from './DebtPeriodReport';

interface DebtLookup {
  id: string;
  customerName: string;
  phoneTail: string;
  remainingAmount: number;
  totalDebt: number;
  dueDate: string;
  status: string;
  recentPayments: Array<{ date: string; amount: number; method: string }>;
}

const methodLabel = (method: string) => (method === 'naqd' ? 'naqd' : method === 'click_payme' ? 'Click' : method === 'vazvrat' ? 'qaytarish' : method);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: '2-digit' });

/** Ishchi uchun nasiya: mijozni qidirish va to'lov qabul qilish. Umumiy ro'yxat, jami qarz va o'chirish yo'q. */
export const WorkerDebtPanel: React.FC<{ onChanged?: () => void; storeInfo: StoreSettings }> = ({ onChanged, storeInfo }) => {
  const [view, setView] = useState<'lookup' | 'period'>('lookup');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DebtLookup[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, 'naqd' | 'click_payme'>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadPeriodReport = useCallback(async (from: string, to: string, searchQuery: string): Promise<PeriodCustomerReport[]> => {
    const params = new URLSearchParams({ from, to });
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    const response = await fetch(`/api/v1/debts/period?${params.toString()}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Nasiya hisoboti yuklanmadi.');
    return Array.isArray(body.data) ? body.data : [];
  }, []);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 2) { setResults([]); return; }
    try {
      const response = await fetch(`/api/v1/debts/lookup?q=${encodeURIComponent(text)}`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok && Array.isArray(body.data)) setResults(body.data);
    } catch {
      /* tarmoq xatosi */
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { search(query); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  const pay = async (debt: DebtLookup) => {
    const amount = Math.round(Number(amounts[debt.id] ?? debt.remainingAmount));
    if (!Number.isFinite(amount) || amount < 1) { setError("To'lov summasini kiriting."); return; }
    setBusyId(debt.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/v1/debts/${encodeURIComponent(debt.id)}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: methods[debt.id] || 'naqd' })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "To'lov saqlanmadi.");
      setMessage(`${debt.customerName}: ${formatMoney(amount)} qabul qilindi. Qoldiq: ${formatMoney(body.data?.remainingAmount ?? 0)}`);
      setAmounts(prev => { const next = { ...prev }; delete next[debt.id]; return next; });
      await search(query);
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "To'lov saqlanmadi.");
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className={`mx-auto space-y-4 ${view === 'period' ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400 text-stone-950"><BookOpen className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-black">Nasiya</h2><p className="text-xs text-stone-500">Mijozni toping, qarz qoldig‘ini ko‘ring va to‘lovni qabul qiling</p></div>
      </div>
      <div className="inline-flex rounded-xl bg-stone-100 p-1 text-xs font-bold">
        <button type="button" onClick={() => setView('lookup')} className={`rounded-lg px-3 py-2 ${view === 'lookup' ? 'bg-stone-950 text-white' : 'text-stone-700'}`}>
          <Search className="mr-1 inline h-3.5 w-3.5" /> Mijozni qidirish
        </button>
        <button type="button" onClick={() => setView('period')} className={`rounded-lg px-3 py-2 ${view === 'period' ? 'bg-stone-950 text-white' : 'text-stone-700'}`}>
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" /> Kunlar oralig‘i
        </button>
      </div>
      {view === 'period' ? (
        <DebtPeriodReport debts={[]} movements={[]} store={storeInfo} query="" loadReport={loadPeriodReport} />
      ) : (<>
      <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-3">
        <Search className="h-4 w-4 text-stone-400" />
        <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Mijoz ismi yoki telefon (kamida 2 belgi)" className="w-full bg-transparent text-sm outline-none" />
      </label>
      {message && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {query.trim().length >= 2 && results.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Faol nasiyasi bor mijoz topilmadi.</p>}
      <div className="space-y-3">
        {results.map(debt => (
          <article key={debt.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-sm font-black">{debt.customerName}</h3><p className="text-[11px] text-stone-500">{debt.phoneTail ? `Telefon …${debt.phoneTail} • ` : ''}muddat {debt.dueDate}</p></div>
              <div className="text-right"><div className="text-[10px] text-stone-500">Qarz qoldig‘i</div><div className="text-lg font-black text-rose-600">{formatMoney(debt.remainingAmount)}</div></div>
            </div>
            {debt.recentPayments.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[11px] text-stone-500">
                {debt.recentPayments.map((payment, index) => <li key={index}>{dateLabel(payment.date)} • {formatMoney(payment.amount)} ({methodLabel(payment.method)})</li>)}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-[11px] font-bold">To‘lov summasi
                <input type="number" min={1} max={debt.remainingAmount} value={amounts[debt.id] ?? debt.remainingAmount}
                  onChange={event => setAmounts(prev => ({ ...prev, [debt.id]: event.target.value }))} className="mt-0.5 block w-36 rounded-lg border border-stone-300 px-2 py-2 text-sm" />
              </label>
              <label className="text-[11px] font-bold">Usul
                <select value={methods[debt.id] || 'naqd'} onChange={event => setMethods(prev => ({ ...prev, [debt.id]: event.target.value as 'naqd' | 'click_payme' }))} className="mt-0.5 block rounded-lg border border-stone-300 px-2 py-2 text-sm">
                  <option value="naqd">Naqd</option><option value="click_payme">Click / karta</option>
                </select>
              </label>
              <button type="button" disabled={busyId === debt.id} onClick={() => pay(debt)} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-stone-950 disabled:opacity-50">{busyId === debt.id ? 'Saqlanmoqda…' : "To'lovni qabul qilish"}</button>
            </div>
          </article>
        ))}
      </div>
      </>)}
    </section>
  );
};
