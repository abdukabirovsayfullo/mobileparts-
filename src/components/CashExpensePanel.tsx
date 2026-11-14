import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BanknoteArrowDown, ChevronDown, ChevronUp, Plus, Undo2 } from 'lucide-react';
import type { AuthUser, CashExpense, CashExpenseCategory, DebtRecord, StockMovement } from '../types';
import { formatMoney } from '../utils/formatters';
import { buildCashBook, CashBookEntry } from '../utils/cashBook';

interface Props {
  user: AuthUser;
  /** Bugungi harakatlar (kassir uchun server faqat o'zinikini beradi). */
  movements: StockMovement[];
  debts: DebtRecord[];
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });

const ENTRY_STYLE: Record<CashBookEntry['kind'], { label: string; sign: string; tone: string }> = {
  sale: { label: 'Savdo', sign: '+', tone: 'text-emerald-700' },
  debt_payment: { label: 'Nasiya to‘lovi', sign: '+', tone: 'text-sky-700' },
  refund: { label: 'Qaytarish', sign: '−', tone: 'text-rose-600' }
};

const todayInTashkent = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

export const CashExpensePanel: React.FC<Props> = ({ user, movements, debts }) => {
  const [showAllEntries, setShowAllEntries] = useState(false);
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
  const book = useMemo(() => buildCashBook(movements, debts), [movements, debts]);
  const cashBalance = book.netCash - activeTotal;
  const visibleEntries = showAllEntries ? book.entries : book.entries.slice(0, 15);

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
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="w-full p-3 sm:p-4 flex items-center gap-3 text-left">
        <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><BanknoteArrowDown className="w-5 h-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">Kassa kitobi</span>
          <span className="block text-[11px] text-stone-500">Bugun {book.salesCount} ta naqd savdo{book.refundCount > 0 ? ` • ${book.refundCount} ta qaytarish` : ''} • chiqim {formatMoney(activeTotal)}</span>
        </span>
        <span className="text-right mr-2"><span className="block text-[10px] text-stone-500">Naqd qoldiq</span><span className={`block font-mono text-sm font-black ${cashBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(cashBalance)}</span></span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && <div className="border-t border-stone-100 p-3 sm:p-4 grid min-w-0 gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="rounded-xl bg-emerald-50 p-2.5">Naqd savdo<strong className="block text-sm text-emerald-700">+{formatMoney(book.salesTotal)}</strong></div>
          <div className="rounded-xl bg-sky-50 p-2.5">Naqd nasiya to‘lovi<strong className="block text-sm text-sky-700">+{formatMoney(book.debtCashTotal)}</strong></div>
          <div className="rounded-xl bg-rose-50 p-2.5">Naqd qaytarish<strong className="block text-sm text-rose-600">−{formatMoney(book.refundTotal)}</strong></div>
          <div className="rounded-xl bg-rose-50 p-2.5">Kassadan chiqim<strong className="block text-sm text-rose-600">−{formatMoney(activeTotal)}</strong></div>
          <div className="col-span-full rounded-xl bg-stone-900 text-white p-2.5 flex items-center justify-between">
            <span>Kassada bo‘lishi kerak (ochilish qoldig‘isiz)</span>
            <strong className={`font-mono text-sm ${cashBalance < 0 ? 'text-rose-300' : 'text-amber-300'}`}>{formatMoney(cashBalance)}</strong>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-xs font-black mb-1.5">Bugungi naqd harakatlar ({book.entries.length})</div>
          {book.entries.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-500">Bugun naqd savdo bo‘lmagan.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 divide-y divide-stone-100">
              {visibleEntries.map(entry => {
                const style = ENTRY_STYLE[entry.kind];
                return (
                  <div key={entry.key} className={`px-3 py-2 flex items-start gap-2.5 ${entry.kind === 'refund' ? 'bg-rose-50/60' : ''}`}>
                    <span className="font-mono text-xs font-black text-stone-800 w-11 shrink-0 pt-0.5">{timeLabel(entry.timestamp)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-stone-900 truncate">{entry.customerName}{entry.receiptNumber && <span className="font-normal text-stone-400"> • {entry.receiptNumber}</span>}</span>
                      <span className="block text-[11px] text-stone-500 truncate">{style.label}: {entry.itemsLabel}{entry.employeeName ? ` — ${entry.employeeName}` : ''}</span>
                    </span>
                    <span className={`font-mono text-xs font-black shrink-0 ${style.tone}`}>{style.sign}{formatMoney(entry.amount)}</span>
                  </div>
                );
              })}
              {book.entries.length > visibleEntries.length && (
                <button type="button" onClick={() => setShowAllEntries(true)} className="w-full py-2 text-[11px] font-bold text-stone-600 hover:bg-stone-50">
                  Hammasini ko‘rsatish ({book.entries.length - visibleEntries.length} ta yana)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="text-xs font-black -mb-2">Kassadan chiqim yozish</div>
        <form onSubmit={submit} className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2.5">
          <input value={recipient} onChange={event => setRecipient(event.target.value)} required aria-label="Kim oldi?" placeholder="Kim oldi?" className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          <input value={amount} onChange={event => setAmount(event.target.value)} required min="1" step="1" type="number" aria-label="Summa (so‘m)" placeholder="Summa (so‘m)" className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          <select aria-label="Chiqim turi" value={category} onChange={event => setCategory(event.target.value as CashExpenseCategory)} className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
            <option value="tushlik">Tushlik</option><option value="taminotchi">Ta’minotchiga to‘lov</option><option value="transport">Transport</option><option value="boshqa">Boshqa</option>
          </select>
          <input value={reason} onChange={event => setReason(event.target.value)} required minLength={3} aria-label="Chiqim sababi" placeholder="Nima uchun?" className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />
          {error && <p className="col-span-full text-xs font-bold text-rose-600">{error}</p>}
          <button disabled={saving} className="col-span-full rounded-xl bg-stone-950 text-white px-4 py-2.5 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" />{saving ? 'Saqlanmoqda…' : 'Chiqimni saqlash'}</button>
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
