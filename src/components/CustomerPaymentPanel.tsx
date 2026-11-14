import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DebtRecord, StockMovement, StoreSettings } from '../types';
import { customerDebtHistory, groupDebtsByCustomer, planCustomerPayment } from '../utils/saleAccounting';
import { formatMoney, formatDate } from '../utils/formatters';
import { printThermalHtml } from '../utils/debtStatementReceipt';
import { PaymentReceiptData, paymentReceiptHtml, paymentReceiptNumber } from '../utils/paymentReceipt';
import { X, Search, Wallet, Printer, CheckCircle2, ArrowLeft, User } from 'lucide-react';

type Currency = 'UZS' | 'USD';

interface Props {
  debts: DebtRecord[];
  movements: StockMovement[];
  store: StoreSettings;
  cashierName?: string;
  /** Oldindan tanlangan mijoz (masalan, nasiya qatoridagi "To'lov" tugmasidan). */
  initialCustomer?: { name: string; phone?: string; currency?: Currency } | null;
  onPay: (customer: { name: string; phone?: string; currency: Currency }, amount: number, method: 'naqd' | 'click_payme') => Promise<boolean>;
  onClose: () => void;
}

const AUTO_PRINT_KEY = 'mp.paymentReceipt.autoPrint';
const readAutoPrint = () => {
  try { return localStorage.getItem(AUTO_PRINT_KEY) !== '0'; } catch { return true; }
};

export async function printPaymentReceipt(data: PaymentReceiptData) {
  try {
    await printThermalHtml(paymentReceiptHtml(data));
  } catch (error) {
    console.error("[Print] To'lov cheki:", error);
    alert("Printer oynasi ochilmadi. CRM-AvtoPrint yorlig'idan oching yoki qayta urinib ko'ring.");
  }
}

/** Mijoz to'lovi: summa qaysi tovar/nasiyaga tegishli bo'lishidan qat'i nazar umumiy qarzdan ayriladi (eng eski nasiyadan boshlab). */
export const CustomerPaymentPanel: React.FC<Props> = ({ debts, movements, store, cashierName, initialCustomer, onPay, onClose }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ name: string; phone: string; currency: Currency } | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'naqd' | 'click_payme'>('naqd');
  const [saving, setSaving] = useState(false);
  const [autoPrint, setAutoPrint] = useState(readAutoPrint);
  const [receipt, setReceipt] = useState<PaymentReceiptData | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const debtors = useMemo(
    () => groupDebtsByCustomer(debts).filter((c) => !c.key.startsWith('id:')),
    [debts]
  );

  useEffect(() => {
    if (!initialCustomer) return;
    const currency = initialCustomer.currency || 'UZS';
    const match = debtors.find((d) => d.currency === currency && planCustomerPayment(debts, initialCustomer.name, initialCustomer.phone, currency, 0).totalRemaining > 0 &&
      d.name.trim().toLowerCase() === initialCustomer.name.trim().toLowerCase());
    setSelected({ name: match?.name || initialCustomer.name, phone: match?.phone || initialCustomer.phone || '', currency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) setTimeout(() => amountRef.current?.focus(), 50);
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return debtors.filter((d) => !q || d.name.toLowerCase().includes(q) || (digits.length >= 2 && d.phone.replace(/\D/g, '').includes(digits)));
  }, [debtors, query]);

  const plan = useMemo(
    () => (selected ? planCustomerPayment(debts, selected.name, selected.phone, selected.currency, Number(amount) || 0) : null),
    [debts, selected, amount]
  );

  const labels = useMemo(() => {
    if (!selected) return new Map<string, string>();
    const h = customerDebtHistory(debts, movements, selected.name, selected.phone);
    return new Map(h.debts.map((r) => {
      const text = r.items.length ? r.items.map((i) => `${i.name} ×${i.quantity}`).join(', ') : r.note || '';
      return [r.debt.id, text.length > 60 ? text.slice(0, 57) + '…' : text];
    }));
  }, [debts, movements, selected]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected || !plan || plan.applied <= 0 || saving) return;
    if (plan.leftover > 0) {
      alert(`To'lov qarzdan ko'p. Jami qarz: ${formatMoney(plan.totalRemaining, selected.currency)}`);
      return;
    }
    const now = new Date();
    const data: PaymentReceiptData = {
      receiptNumber: paymentReceiptNumber(now),
      date: now.toISOString(),
      store,
      customerName: selected.name,
      customerPhone: selected.phone,
      currency: selected.currency,
      amount: plan.applied,
      method,
      allocations: plan.allocations.map((a) => ({
        createdAt: a.createdAt,
        amount: a.amount,
        remainingAfter: Math.max(0, a.remainingBefore - a.amount),
        label: labels.get(a.debtId)
      })),
      debtBefore: plan.totalRemaining,
      debtAfter: Math.max(0, plan.totalRemaining - plan.applied),
      cashier: cashierName
    };
    setSaving(true);
    const ok = await onPay({ name: selected.name, phone: selected.phone, currency: selected.currency }, plan.applied, method);
    setSaving(false);
    if (!ok) return;
    setReceipt(data);
    setAmount('');
    if (autoPrint) void printPaymentReceipt(data);
  };

  const toggleAutoPrint = (value: boolean) => {
    setAutoPrint(value);
    try { localStorage.setItem(AUTO_PRINT_KEY, value ? '1' : '0'); } catch { /* ixtiyoriy */ }
  };

  const reset = () => {
    setReceipt(null);
    setSelected(null);
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(selected || receipt) && (
              <button onClick={receipt ? reset : () => setSelected(null)} className="text-emerald-100 hover:text-white cursor-pointer" aria-label="Orqaga">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h3 className="font-black text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Mijoz to'lovi</h3>
              <div className="text-[10px] text-emerald-100">To'lov mijozning umumiy qarzidan ayriladi (eng eski nasiyadan boshlab)</div>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-100 hover:text-white cursor-pointer" aria-label="Yopish"><X className="w-5 h-5" /></button>
        </div>

        {/* 3) Muvaffaqiyat + chek */}
        {receipt ? (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="text-center space-y-1">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div className="text-lg font-black text-stone-900">{formatMoney(receipt.amount, receipt.currency)} qabul qilindi</div>
              <div className="text-xs text-stone-500">{receipt.customerName} · {receipt.receiptNumber}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span>Avvalgi qarz</span><b>{formatMoney(receipt.debtBefore, receipt.currency)}</b></div>
              <div className="flex justify-between text-emerald-700"><span>To'landi ({receipt.method === 'click_payme' ? 'Click/Payme' : 'Naqd'})</span><b>−{formatMoney(receipt.amount, receipt.currency)}</b></div>
              <div className="flex justify-between text-base font-black border-t border-stone-200 pt-1"><span>Qolgan qarz</span><span className={receipt.debtAfter > 0 ? 'text-red-600' : 'text-emerald-700'}>{receipt.debtAfter > 0 ? formatMoney(receipt.debtAfter, receipt.currency) : "Yopildi ✓"}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => printPaymentReceipt(receipt)} className="py-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-white font-black text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Printer className="w-4 h-4" /> Chek chiqarish
              </button>
              <button onClick={reset} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm cursor-pointer">Yangi to'lov</button>
            </div>
          </div>
        ) : !selected ? (
          /* 1) Mijozni tanlash */
          <div className="flex flex-col min-h-0">
            <div className="p-4 border-b border-stone-200">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mijoz ismi yoki telefoni…"
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
            </div>
            <div className="overflow-y-auto divide-y divide-stone-100">
              {filtered.length === 0 && <div className="p-6 text-center text-xs text-stone-400">Qarzi bor mijoz topilmadi</div>}
              {filtered.map((d) => (
                <button key={d.key} onClick={() => setSelected({ name: d.name, phone: d.phone, currency: d.currency })}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-emerald-50 text-left cursor-pointer">
                  <span className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-bold text-sm text-stone-900 truncate">{d.name}</span>
                      <span className="block text-[11px] text-stone-500">{d.phone || '—'} · {d.activeCount} ta nasiya{d.maxOverdueDays > 0 ? ` · ${d.maxOverdueDays} kun kechikkan` : ''}</span>
                    </span>
                  </span>
                  <span className="font-black text-sm text-red-600 whitespace-nowrap">{formatMoney(d.remaining, d.currency)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* 2) Summa kiritish */
          <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <div>
                <div className="font-black text-stone-900">{selected.name}</div>
                <div className="text-[11px] text-stone-500">{selected.phone}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-red-700">Umumiy qarz</div>
                <div className="text-lg font-black text-red-700">{formatMoney(plan?.totalRemaining || 0, selected.currency)}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700">To'lov summasi</label>
              <div className="flex gap-2 mt-1">
                <input ref={amountRef} type="text" inputMode="decimal" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  className="flex-1 min-w-0 w-full px-3 py-3 border border-stone-300 rounded-xl text-2xl font-black text-right focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <button type="button" onClick={() => setAmount(String(plan?.totalRemaining || 0))} className="shrink-0 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold cursor-pointer">Hammasi</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['naqd', 'click_payme'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`py-2 rounded-xl text-sm font-bold border cursor-pointer ${method === m ? 'bg-stone-950 text-white border-stone-950' : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'}`}>
                  {m === 'naqd' ? 'Naqd' : 'Click / Payme'}
                </button>
              ))}
            </div>

            {plan && plan.applied > 0 && (
              <div className="text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-1">
                {plan.leftover > 0 ? (
                  <div className="text-red-600 font-bold">Summa qarzdan {formatMoney(plan.leftover, selected.currency)} ko'p.</div>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-stone-600">Umumiy qarz</span><b>{formatMoney(plan.totalRemaining, selected.currency)}</b></div>
                    <div className="flex justify-between text-emerald-700"><span>To'lov</span><b>−{formatMoney(plan.applied, selected.currency)}</b></div>
                    <div className="flex justify-between border-t border-stone-200 pt-1 font-black">
                      <span>Qoladi</span>
                      <span className="text-red-600">{formatMoney(plan.totalRemaining - plan.applied, selected.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-stone-600 font-semibold cursor-pointer">
              <input type="checkbox" checked={autoPrint} onChange={(e) => toggleAutoPrint(e.target.checked)} />
              To'lovdan keyin chekni avtomatik chiqarish
            </label>

            <button type="submit" disabled={saving || !plan || plan.applied <= 0 || plan.leftover > 0}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-base cursor-pointer">
              {saving ? 'Saqlanmoqda…' : `To'lovni qabul qilish${plan && plan.applied > 0 && !plan.leftover ? ` — ${formatMoney(plan.applied, selected.currency)}` : ''}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
