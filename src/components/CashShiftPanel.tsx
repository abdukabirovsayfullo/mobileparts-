import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, LockKeyhole } from 'lucide-react';
import type { AuthUser, CashShift } from '../types';
import { formatMoney } from '../utils/formatters';

interface CurrentShiftResponse {
  businessDate: string;
  closedShift: CashShift | null;
  suggestedOpeningCash: number;
  totals: { cashRevenue: number; clickRevenue: number; uzumRevenue: number; debtRevenue: number; expenseTotal: number; expectedCash: number };
}

export const CashShiftPanel: React.FC<{ user: AuthUser }> = ({ user }) => {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<CurrentShiftResponse | null>(null);
  const [openingCash, setOpeningCash] = useState('0');
  const [countedCash, setCountedCash] = useState('');
  const [leftForNextDay, setLeftForNextDay] = useState('0');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [allShifts, setAllShifts] = useState<CashShift[]>([]);

  const load = useCallback(async (opening?: string) => {
    const suffix = opening !== undefined ? `?openingCash=${Number(opening) || 0}` : '';
    const response = await fetch(`/api/v1/cash-shifts/current${suffix}`, { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    setData(body);
    if (opening === undefined) setOpeningCash(String(body.suggestedOpeningCash || 0));
    if (user.role === 'owner') {
      const listResponse = await fetch('/api/v1/cash-shifts', { cache: 'no-store' });
      const listBody = listResponse.ok ? await listResponse.json() : null;
      if (Array.isArray(listBody?.data)) setAllShifts(listBody.data);
    }
  }, [user.role]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const closeShift = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/v1/cash-shifts/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openingCash: Number(openingCash), countedCash: Number(countedCash), leftForNextDay: Number(leftForNextDay), note }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Smena yopilmadi.');
      await load(openingCash);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Smena yopilmadi.'); }
    finally { setSaving(false); }
  };

  const difference = (Number(countedCash) || 0) - (data?.totals.expectedCash || 0);
  const reopen = async (shift: CashShift) => {
    const reason = window.prompt('Smenani qayta ochish sababini yozing:')?.trim();
    if (!reason) return;
    const response = await fetch(`/api/v1/cash-shifts/${shift.id}/reopen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    const body = await response.json();
    if (!response.ok) return window.alert(body.error || 'Smena qayta ochilmadi.');
    await load(openingCash);
  };
  return <section className="mb-3 rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
    <button type="button" onClick={() => { setExpanded(value => !value); if (!expanded) load(openingCash).catch(() => undefined); }} className="w-full p-3 sm:p-4 flex items-center gap-3 text-left">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${data?.closedShift ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{data?.closedShift ? <CheckCircle2 className="w-5 h-5" /> : <LockKeyhole className="w-5 h-5" />}</span>
      <span className="flex-1"><span className="block text-sm font-black">Kassani yopish</span><span className="block text-[11px] text-stone-500">{data?.closedShift ? `Smena yopilgan • Farq ${formatMoney(data.closedShift.difference)}` : 'Kun oxirida sanalgan pulni tekshirish'}</span></span>
      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
    {expanded && data && <div className="border-t border-stone-100 p-3 sm:p-4">
      {data.closedShift ? <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"><div>Kutilgan<strong className="block text-sm">{formatMoney(data.closedShift.expectedCash)}</strong></div><div>Sanalgan<strong className="block text-sm">{formatMoney(data.closedShift.countedCash)}</strong></div><div>Farq<strong className={`block text-sm ${data.closedShift.difference < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatMoney(data.closedShift.difference)}</strong></div><div>Keyingi kunga<strong className="block text-sm">{formatMoney(data.closedShift.leftForNextDay)}</strong></div>{data.closedShift.note && <p className="col-span-full text-stone-600">Izoh: {data.closedShift.note}</p>}{user.role === 'owner' && <button type="button" onClick={() => reopen(data.closedShift!)} className="col-span-full rounded-lg border border-emerald-300 bg-white py-2 font-black text-emerald-700">Smenani qayta ochish</button>}</div>
      : <form onSubmit={closeShift} className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs"><div className="rounded-xl bg-stone-50 p-3">Naqd savdo<strong className="block">{formatMoney(data.totals.cashRevenue)}</strong></div><div className="rounded-xl bg-stone-50 p-3">Click<strong className="block">{formatMoney(data.totals.clickRevenue)}</strong></div><div className="rounded-xl bg-stone-50 p-3">Uzum<strong className="block">{formatMoney(data.totals.uzumRevenue)}</strong></div><div className="rounded-xl bg-stone-50 p-3">Nasiya<strong className="block">{formatMoney(data.totals.debtRevenue)}</strong></div><div className="rounded-xl bg-rose-50 p-3">Chiqim<strong className="block">−{formatMoney(data.totals.expenseTotal)}</strong></div></div>
        <div className="grid sm:grid-cols-3 gap-2"><label className="text-xs font-bold">Ochilish qoldig‘i<input type="number" min="0" value={openingCash} onChange={event => { setOpeningCash(event.target.value); load(event.target.value).catch(() => undefined); }} className="mt-1 w-full rounded-xl border px-3 py-2" /></label><div className="rounded-xl bg-amber-50 p-3 text-xs">Kutilgan naqd<strong className="block text-lg">{formatMoney(data.totals.expectedCash)}</strong></div><label className="text-xs font-bold">Sanalgan naqd<input required type="number" min="0" value={countedCash} onChange={event => setCountedCash(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label></div>
        <div className={`rounded-xl p-3 text-sm font-black ${difference < 0 ? 'bg-rose-50 text-rose-700' : difference > 0 ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>{difference < 0 ? `Kamomat: ${formatMoney(Math.abs(difference))}` : difference > 0 ? `Ortiqcha: ${formatMoney(difference)}` : 'Kassa muvofiq'}</div>
        <div className="grid sm:grid-cols-2 gap-2"><input type="number" min="0" value={leftForNextDay} onChange={event => setLeftForNextDay(event.target.value)} placeholder="Keyingi kunga qoldiriladi" className="rounded-xl border px-3 py-2.5 text-sm" /><input value={note} onChange={event => setNote(event.target.value)} placeholder={difference === 0 ? 'Izoh (ixtiyoriy)' : 'Farq sababini yozing (majburiy)'} className="rounded-xl border px-3 py-2.5 text-sm" /></div>
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}<button disabled={saving} className="w-full rounded-xl bg-amber-400 text-stone-950 py-3 text-sm font-black disabled:opacity-50">{saving ? 'Yopilmoqda…' : 'Smenani yopish'}</button>
      </form>}
      {user.role === 'owner' && allShifts.length > 0 && <div className="mt-4 border-t pt-3"><h4 className="text-xs font-black mb-2">Oxirgi yopilgan smenalar</h4><div className="space-y-1.5">{allShifts.slice(0, 7).map(shift => <div key={shift.id} className="rounded-lg bg-stone-50 px-3 py-2 flex items-center gap-2 text-xs"><span className="flex-1"><strong>{shift.businessDate} • {shift.employeeName}</strong><span className="block text-stone-500">Farq: {formatMoney(shift.difference)}</span></span>{shift.reopenedAt ? <span className="text-stone-500">Qayta ochilgan</span> : <button type="button" onClick={() => reopen(shift)} className="font-bold text-amber-700">Qayta ochish</button>}</div>)}</div></div>}
    </div>}
  </section>;
};
