import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Search } from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import type { Currency, StoreSettings } from '../types';
import type { PeriodCustomerReport } from '../utils/saleAccounting';
import { DebtPeriodReport } from './DebtPeriodReport';

interface CustomerHit {
  debtId: string;
  name: string;
  phoneTail: string;
  currency: Currency;
  purchases: Array<{ debtId: string; date: string; items: Array<{ name: string; quantity: number; total: number; returnedQty: number }>; note?: string; amount: number }>;
  payments: Array<{ date: string; amount: number; method: string; employeeName?: string }>;
  taken: number;
  paid: number;
  returned: number;
  remaining: number;
}

const methodLabel = (method: string) => (method === 'naqd' ? 'naqd' : method === 'click_payme' ? 'Click' : method === 'vazvrat' ? 'qaytarish' : method);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: '2-digit' });

/** Ishchi uchun nasiya: mijozni qidirish va to'lov qabul qilish. Umumiy ro'yxat, jami qarz va o'chirish yo'q. */
export const WorkerDebtPanel: React.FC<{ onChanged?: () => void; storeInfo: StoreSettings }> = ({ onChanged, storeInfo }) => {
  const [view, setView] = useState<'lookup' | 'period'>('lookup');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [openId, setOpenId] = useState('');
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
      const response = await fetch(`/api/v1/debts/customer-lookup?q=${encodeURIComponent(text)}`, { cache: 'no-store' });
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

  // To'lov mijozning JAMI qarzidan ayriladi (server eng eski nasiyadan boshlab taqsimlaydi).
  const pay = async (customer: CustomerHit) => {
    const raw = amounts[customer.debtId];
    const amount = customer.currency === 'USD' ? Number(raw ?? customer.remaining) : Math.round(Number(raw ?? customer.remaining));
    if (!Number.isFinite(amount) || amount <= 0) { setError("To'lov summasini kiriting."); return; }
    if (amount > customer.remaining) { setError(`To'lov jami qarzdan ko'p: ${formatMoney(customer.remaining, customer.currency)}.`); return; }
    setBusyId(customer.debtId); setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/debts/customer-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtId: customer.debtId, amount, method: methods[customer.debtId] || 'naqd' })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "To'lov saqlanmadi.");
      setMessage(`${customer.name}: ${formatMoney(amount, customer.currency)} qabul qilindi. Jami qoldiq: ${formatMoney(body.remaining ?? Math.max(0, customer.remaining - amount), customer.currency)}`);
      setAmounts(prev => { const next = { ...prev }; delete next[customer.debtId]; return next; });
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
        {results.map(c => {
          const open = openId === c.debtId;
          return (
          <article key={c.debtId} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black">{c.name}</h3>
                <p className="text-[11px] text-stone-500">{[c.phoneTail && `Telefon …${c.phoneTail}`, `${c.purchases.length} ta xarid`].filter(Boolean).join(' • ')}</p>
              </div>
              <div className="text-right"><div className="text-[10px] text-stone-500">Jami qarz</div><div className="text-lg font-black text-rose-600">{formatMoney(c.remaining, c.currency)}</div></div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-xl bg-stone-50 p-2">Olgan<strong className="block text-xs">{formatMoney(c.taken, c.currency)}</strong></div>
              <div className="rounded-xl bg-emerald-50 p-2">To‘lagan<strong className="block text-xs text-emerald-700">{formatMoney(c.paid, c.currency)}</strong></div>
              <div className="rounded-xl bg-sky-50 p-2">Qaytargan<strong className="block text-xs text-sky-700">{formatMoney(c.returned, c.currency)}</strong></div>
            </div>

            <button type="button" onClick={() => setOpenId(open ? '' : c.debtId)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left text-xs font-bold text-stone-700 hover:bg-stone-50">
              {open ? '▲ Yopish' : '▼ Nima olgan va to‘lovlari'}
            </button>
            {open && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase text-stone-500">Nima olgan</div>
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {c.purchases.map(p => (
                      <li key={p.debtId} className="px-3 py-2">
                        <div className="flex justify-between font-bold"><span>{dateLabel(p.date)}</span><span>{formatMoney(p.amount, c.currency)}</span></div>
                        {p.items.length > 0
                          ? p.items.map((i, idx) => <div key={idx} className="text-[11px] text-stone-600">• {i.name} × {i.quantity}{i.returnedQty > 0 ? ` (${i.returnedQty} ta qaytarilgan)` : ''}</div>)
                          : <div className="text-[11px] text-stone-600">{p.note || "Qo'lda yozilgan nasiya"}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
                {c.payments.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase text-stone-500">To‘lovlar (jami qarzdan ayrilgan)</div>
                    <ul className="space-y-0.5 text-[11px] text-stone-600">
                      {c.payments.map((p, idx) => <li key={idx} className="flex justify-between"><span>{dateLabel(p.date)} • {methodLabel(p.method)}{p.employeeName ? ` • ${p.employeeName}` : ''}</span><span className="font-bold text-emerald-700">−{formatMoney(p.amount, c.currency)}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] font-bold">To‘lov summasi
                <input type="number" min={c.currency === 'USD' ? 0.01 : 1} step="any" max={c.remaining} value={amounts[c.debtId] ?? c.remaining}
                  onChange={event => setAmounts(prev => ({ ...prev, [c.debtId]: event.target.value }))} className="mt-0.5 block w-36 rounded-lg border border-stone-300 px-2 py-2 text-sm" />
              </label>
              <label className="text-[11px] font-bold">Usul
                <select value={methods[c.debtId] || 'naqd'} onChange={event => setMethods(prev => ({ ...prev, [c.debtId]: event.target.value as 'naqd' | 'click_payme' }))} className="mt-0.5 block rounded-lg border border-stone-300 px-2 py-2 text-sm">
                  <option value="naqd">Naqd</option><option value="click_payme">Click / karta</option>
                </select>
              </label>
              <button type="button" disabled={busyId === c.debtId} onClick={() => pay(c)} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-stone-950 disabled:opacity-50">{busyId === c.debtId ? 'Saqlanmoqda…' : "To'lovni qabul qilish"}</button>
            </div>
            <p className="text-[10px] text-stone-500">Qisman to‘lov ham jami qarzdan ayriladi.</p>
          </article>
          );
        })}
      </div>
      </>)}
    </section>
  );
};
