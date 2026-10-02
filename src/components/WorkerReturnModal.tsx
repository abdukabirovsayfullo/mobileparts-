import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Search, X } from 'lucide-react';
import type { PaymentMethod, SaleReceiptData } from '../types';
import { formatMoney } from '../utils/formatters';

interface ReturnableLine {
  movementId: string;
  productName: string;
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitRefund: number;
  lineTotal: number;
}

interface ReturnableSale {
  key: string;
  receiptNumber: string;
  timestamp: string;
  customerName: string;
  employeeName: string;
  paymentMethod?: string;
  lines: ReturnableLine[];
}

interface ReturnResult {
  receiptNumber: string;
  totalRefund: number;
  customerName: string;
  debtReduced: number;
  movements: Array<{ productId: string; productName: string; category: string; quantity: number; unitPrice: number; totalRevenue: number }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cashierName: string;
  onDone: (receipt: SaleReceiptData | null) => void;
}

const REASONS = [
  'Mos kelmadi (model / razmer)',
  'Nuqsonli / ishlamadi',
  'Mijoz fikridan qaytdi',
  'Boshqa tovarga almashtirildi',
  'Noto‘g‘ri sotilgan'
];

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'naqd', label: 'Naqd pul qaytarildi' },
  { value: 'click_payme', label: 'Click / karta' },
  { value: 'uzum', label: 'Uzum' },
  { value: 'nasiya', label: 'Nasiya qarzidan ayirish' }
];

const dateLabel = (iso: string) => new Date(iso).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const WorkerReturnModal: React.FC<Props> = ({ isOpen, onClose, cashierName, onDone }) => {
  const [query, setQuery] = useState('');
  const [sales, setSales] = useState<ReturnableSale[]>([]);
  const [selected, setSelected] = useState<ReturnableSale | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('naqd');
  const [restoreStock, setRestoreStock] = useState(true);
  const [needsOwner, setNeedsOwner] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<ReturnResult | null>(null);

  const reset = useCallback(() => {
    setQuery(''); setSelected(null); setQuantities({}); setReason(REASONS[0]); setCustomReason('');
    setMethod('naqd'); setRestoreStock(true); setNeedsOwner(false); setOwnerPin(''); setError(''); setSuccess(null);
  }, []);

  useEffect(() => { if (isOpen) reset(); }, [isOpen, reset]);

  const search = useCallback(async (text: string) => {
    try {
      const response = await fetch(`/api/v1/returns/search?q=${encodeURIComponent(text)}`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok && Array.isArray(body.data)) setSales(body.data);
    } catch {
      /* tarmoq xatosi: ro'yxat o'zgarmaydi */
    }
  }, []);

  useEffect(() => {
    if (!isOpen || selected) return;
    const timer = window.setTimeout(() => { search(query); }, 250);
    return () => window.clearTimeout(timer);
  }, [isOpen, selected, query, search]);

  const chosenLines = useMemo(
    () => (selected?.lines || []).map(line => ({ line, quantity: quantities[line.movementId] || 0 })).filter(item => item.quantity > 0),
    [selected, quantities]
  );
  const total = chosenLines.reduce((sum, item) => sum + item.line.unitRefund * item.quantity, 0);
  const finalReason = reason === 'Boshqa' ? customReason.trim() : reason;

  if (!isOpen) return null;

  const submit = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/v1/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: chosenLines.map(item => ({ movementId: item.line.movementId, quantity: item.quantity })),
          reason: finalReason,
          refundMethod: method,
          restoreStock,
          ownerPin: needsOwner ? ownerPin : undefined
        })
      });
      const body = await response.json();
      if (response.status === 403 && body.code === 'OWNER_APPROVAL_REQUIRED') {
        setNeedsOwner(true);
        setError(body.error || 'Bu sotuv 7 kundan eski: Rahbar PIN-kodi kerak.');
        return;
      }
      if (!response.ok) throw new Error(body.error || 'Qaytarish saqlanmadi.');
      const result: ReturnResult = body.data;
      setSuccess(result);
      const receipt: SaleReceiptData = {
        receiptNumber: result.receiptNumber,
        date: new Date().toISOString(),
        customerName: result.customerName,
        paymentMethod: method,
        items: result.movements.map(item => ({ id: item.productId, name: item.productName, category: item.category, quantity: item.quantity, unitPrice: item.unitPrice, total: item.totalRevenue })),
        subtotal: result.totalRefund,
        total: result.totalRefund,
        notes: `Vazvrat: ${finalReason}`,
        cashierName,
        isReturn: true,
        returnReason: finalReason
      };
      onDone(receipt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qaytarish saqlanmadi.');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = chosenLines.length > 0 && finalReason.length >= 3 && (!needsOwner || /^\d{4,8}$/.test(ownerPin)) && !saving;

  return (
    <div role="dialog" aria-modal="true" aria-label="Tovar qaytarish" className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-stone-950"><RotateCcw className="h-5 w-5" /></span>
          <div className="flex-1"><h2 className="text-base font-black">Tovar qaytarish (vazvrat)</h2><p className="text-[11px] text-stone-500">Oxirgi 7 kundagi sotuvni o‘zingiz qaytara olasiz</p></div>
          <button type="button" onClick={onClose} aria-label="Yopish" className="rounded-lg p-2 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>

        {success ? (
          <div className="space-y-3 p-5 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h3 className="text-lg font-black">Qaytarish qayd etildi</h3>
            <p className="text-sm text-stone-600">Chek: <strong>{success.receiptNumber}</strong> • Mijoz: {success.customerName}</p>
            <p className="text-2xl font-black">{formatMoney(success.totalRefund)}</p>
            {success.debtReduced > 0 && <p className="text-xs text-stone-500">Nasiya qarzi {formatMoney(success.debtReduced)} ga kamaytirildi.</p>}
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-stone-950">Yopish</button>
          </div>
        ) : !selected ? (
          <div className="space-y-3 p-4">
            <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2.5">
              <Search className="h-4 w-4 text-stone-400" />
              <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Chek raqami, mijoz yoki tovar nomi" className="w-full bg-transparent text-sm outline-none" />
            </label>
            {sales.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Oxirgi 7 kunda mos sotuv topilmadi.</p>}
            <div className="space-y-2">
              {sales.map(sale => (
                <button key={sale.key} type="button" onClick={() => { setSelected(sale); setQuantities({}); setNeedsOwner(false); setError(''); }}
                  className="w-full rounded-2xl border border-stone-200 p-3 text-left hover:border-amber-400 hover:bg-amber-50">
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500"><span className="font-bold text-stone-800">{sale.receiptNumber || 'Chek raqamsiz'}</span><span>{dateLabel(sale.timestamp)}</span></div>
                  <div className="mt-1 text-sm font-bold">{sale.customerName}</div>
                  <div className="mt-0.5 text-xs text-stone-600">{sale.lines.map(line => `${line.productName} ×${line.soldQuantity}`).join(', ')}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <button type="button" onClick={() => setSelected(null)} className="text-xs font-bold text-amber-700">← Boshqa sotuvni tanlash</button>
            <div className="rounded-xl bg-stone-50 p-3 text-xs"><strong>{selected.receiptNumber}</strong> • {selected.customerName} • {dateLabel(selected.timestamp)}</div>
            <div className="space-y-2">
              {selected.lines.map(line => (
                <div key={line.movementId} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{line.productName}</div>
                    <div className="text-[11px] text-stone-500">Sotilgan {line.soldQuantity} • qaytarilgan {line.returnedQuantity} • bir donasi {formatMoney(line.unitRefund)}</div>
                  </div>
                  {line.returnableQuantity > 0 ? (
                    <label className="text-[11px] font-bold text-stone-600">Soni
                      <input type="number" min={0} max={line.returnableQuantity} value={quantities[line.movementId] || ''}
                        onChange={event => setQuantities(prev => ({ ...prev, [line.movementId]: Math.min(line.returnableQuantity, Math.max(0, Math.floor(Number(event.target.value) || 0))) }))}
                        placeholder="0" className="mt-0.5 block w-16 rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
                    </label>
                  ) : <span className="text-[11px] font-bold text-stone-400">Qaytarilgan</span>}
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">Sabab
                <select value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
                  {REASONS.map(item => <option key={item}>{item}</option>)}
                  <option>Boshqa</option>
                </select>
              </label>
              <label className="text-xs font-bold">Pul qaytarish usuli
                <select value={method} onChange={event => setMethod(event.target.value as PaymentMethod)} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm">
                  {METHODS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            {reason === 'Boshqa' && <input value={customReason} onChange={event => setCustomReason(event.target.value)} placeholder="Sababni yozing (kamida 3 belgi)" className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm" />}
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={restoreStock} onChange={event => setRestoreStock(event.target.checked)} /> Tovar omborga qaytarilsin (yaroqsiz bo‘lsa belgini oling)</label>

            {needsOwner && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-xs font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> Bu sotuv 7 kundan eski. Rahbar PIN-kodi kerak.</p>
                <input type="password" inputMode="numeric" value={ownerPin} onChange={event => setOwnerPin(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Rahbar PIN-kodi" className="mt-2 w-full rounded-xl border border-amber-300 px-3 py-2.5 text-sm" />
              </div>
            )}
            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
            <div className="flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-white"><span className="text-xs">Qaytariladigan summa</span><strong className="text-lg text-amber-300">{formatMoney(total)}</strong></div>
            <button type="button" disabled={!canSubmit} onClick={submit} className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-stone-950 disabled:opacity-40">{saving ? 'Saqlanmoqda…' : 'Qaytarishni tasdiqlash'}</button>
          </div>
        )}
      </div>
    </div>
  );
};
