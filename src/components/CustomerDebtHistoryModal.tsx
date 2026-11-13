import React, { useMemo, useState } from 'react';
import { DebtRecord, StockMovement } from '../types';
import { customerDebtHistory, editDebt, cancelDebt } from '../utils/saleAccounting';
import { currencyOf } from '../utils/money';
import { formatMoney, formatDate } from '../utils/formatters';
import { X, Phone, Package, Wallet, RotateCcw, Copy, CheckCircle2, Pencil, Ban, History } from 'lucide-react';

interface Props {
  name: string;
  phone?: string;
  debts: DebtRecord[];
  movements: StockMovement[];
  onClose: () => void;
  /** "Mijoz to'lovi" panelini shu mijoz bilan ochadi (chek bilan). */
  onRequestPayment?: (customer: { name: string; phone?: string; currency: 'UZS' | 'USD' }) => void;
  /** Faqat rahbar uchun beriladi. */
  onUpdateDebt?: (debt: DebtRecord) => void;
  currentUserName?: string;
}

const METHOD_LABEL: Record<string, string> = {
  naqd: 'Naqd',
  click_payme: 'Click / Payme',
  vazvrat: 'Tovar qaytarildi'
};

const statusBadge = (d: DebtRecord) => {
  if (d.cancelledAt) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700 line-through">Bekor qilingan</span>;
  if (d.status === 'yopildi') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Yopilgan</span>;
  const overdue = d.dueDate && new Date(d.dueDate).getTime() < Date.now();
  return overdue
    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Muddati o'tgan</span>
    : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Ochiq</span>;
};

/** Mijozning nasiyaga nima olgani, qachon qancha to'lagani — bitta joyda. */
export const CustomerDebtHistoryModal: React.FC<Props> = ({ name, phone, debts, movements, onClose, onRequestPayment, onUpdateDebt, currentUserName }) => {
  const [showClosed, setShowClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<DebtRecord | null>(null);
  const [editForm, setEditForm] = useState({ customerName: '', customerPhone: '', dueDate: '', notes: '', totalDebt: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [editError, setEditError] = useState('');
  const history = useMemo(() => customerDebtHistory(debts, movements, name, phone), [debts, movements, name, phone]);
  const visible = history.debts.filter((r) => showClosed || r.debt.status !== 'yopildi');
  const closedCount = history.debts.length - history.debts.filter((r) => r.debt.status !== 'yopildi').length;
  const currencies = (['UZS', 'USD'] as const).filter((c) => history.totals[c].taken > 0);
  const payable = (['UZS', 'USD'] as const).filter((c) => history.totals[c].remaining > 0);
  const isManual = (d: DebtRecord) => !movements.some((m) => m.id === d.movementId);

  const openEdit = (d: DebtRecord) => {
    setEditing(d);
    setEditError('');
    setCancelReason('');
    setEditForm({ customerName: d.customerName, customerPhone: d.customerPhone, dueDate: d.dueDate || '', notes: d.notes || '', totalDebt: String(d.totalDebt) });
  };

  const saveEdit = () => {
    if (!editing || !onUpdateDebt) return;
    try {
      const updated = editDebt(editing, { ...editForm, totalDebt: Number(editForm.totalDebt) }, currentUserName, new Date().toISOString(), isManual(editing));
      if (updated !== editing) onUpdateDebt(updated);
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Saqlanmadi');
    }
  };

  const doCancel = () => {
    if (!editing || !onUpdateDebt) return;
    if (!isManual(editing)) {
      setEditError("Savdodan yozilgan nasiyani bekor qilish uchun tovarni qaytarish (Vazvrat) bo'limidan foydalaning — shunda ombor ham to'g'rilanadi.");
      return;
    }
    try {
      const updated = cancelDebt(editing, cancelReason, currentUserName, new Date().toISOString());
      if (!window.confirm(`${editing.customerName} — ${formatMoney(editing.remainingAmount, currencyOf(editing))} nasiya bekor qilinsinmi? Yozuv tarixda qoladi.`)) return;
      onUpdateDebt(updated);
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Bekor qilinmadi');
    }
  };

  const copyText = async () => {
    const lines: string[] = [`${history.name} — nasiya xaridlari`];
    history.debts
      .filter((r) => r.debt.status !== 'yopildi')
      .slice()
      .reverse()
      .forEach((r) => {
        const c = currencyOf(r.debt);
        lines.push('', `${formatDate(r.debt.createdAt)}:`);
        r.items.forEach((i) => lines.push(`• ${i.name} — ${i.quantity} dona × ${formatMoney(i.unitPrice, c)}${i.returnedQty ? ` (${i.returnedQty} ta qaytarilgan)` : ''}`));
        if (!r.items.length && r.note) lines.push(`• ${r.note}`);
        lines.push(`Summa: ${formatMoney(r.debt.totalDebt, c)}, qoldiq: ${formatMoney(r.debt.remainingAmount, c)}`);
      });
    currencies.forEach((c) => lines.push('', `Jami qolgan qarz: ${formatMoney(history.totals[c].remaining, c)}`));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(lines.join('\n'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sarlavha */}
        <div className="px-5 py-4 bg-stone-950 text-white flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-stone-400 font-bold">Mijoz nasiya kartasi</div>
            <h3 className="font-black text-base leading-tight">{history.name}</h3>
            {history.phone && (
              <a href={`tel:${history.phone}`} className="inline-flex items-center gap-1 text-xs text-amber-300 mt-0.5">
                <Phone className="w-3 h-3" /> {history.phone}
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white cursor-pointer" aria-label="Yopish">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Jami ko'rsatkichlar */}
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-200 space-y-2">
          {currencies.length === 0 && <div className="text-xs text-stone-500">Bu mijozda nasiya yozuvi yo'q.</div>}
          {currencies.map((c) => (
            <div key={c} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded-xl border border-stone-200 p-2">
                <div className="text-[10px] text-stone-500 font-semibold">Jami nasiyaga olgan</div>
                <div className="text-sm font-black text-stone-900">{formatMoney(history.totals[c].taken, c)}</div>
              </div>
              <div className="bg-white rounded-xl border border-stone-200 p-2">
                <div className="text-[10px] text-stone-500 font-semibold">To'lagan</div>
                <div className="text-sm font-black text-emerald-700">{formatMoney(history.totals[c].paid, c)}</div>
              </div>
              <div className="bg-white rounded-xl border border-stone-200 p-2">
                <div className="text-[10px] text-stone-500 font-semibold">Qaytargan (tovar)</div>
                <div className="text-sm font-black text-sky-700">{formatMoney(history.totals[c].returned, c)}</div>
              </div>
              <div className="bg-red-50 rounded-xl border border-red-200 p-2">
                <div className="text-[10px] text-red-700 font-semibold">Qolgan qarz</div>
                <div className="text-sm font-black text-red-700">{formatMoney(history.totals[c].remaining, c)}</div>
              </div>
            </div>
          ))}
          {onRequestPayment && payable.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {payable.map((c) => (
                <button key={c} type="button" onClick={() => onRequestPayment({ name: history.name, phone: history.phone, currency: c })}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer">
                  <Wallet className="w-4 h-4" /> To'lov qabul qilish{payable.length > 1 ? (c === 'USD' ? ' ($)' : " (so'm)") : ''}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            {closedCount > 0 ? (
              <label className="flex items-center gap-1.5 text-[11px] text-stone-600 font-semibold cursor-pointer">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                Yopilgan nasiyalarni ham ko'rsatish ({closedCount})
              </label>
            ) : <span />}
            <button
              type="button"
              onClick={copyText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-[11px] font-bold text-stone-800 cursor-pointer"
              title="Ro'yxatni nusxalab, mijozga Telegram/SMS orqali yuborish"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Nusxalandi' : 'Mijozga yuborish uchun nusxalash'}
            </button>
          </div>
        </div>

        {/* Nasiyalar ro'yxati */}
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {visible.length === 0 && (
            <div className="text-center text-xs text-stone-400 py-6">Ochiq nasiya yo'q</div>
          )}
          {visible.map((r) => {
            const c = currencyOf(r.debt);
            return (
              <div key={r.debt.id} className={`rounded-2xl border p-3.5 space-y-2.5 ${r.debt.status === 'yopildi' ? 'border-stone-200 opacity-75' : 'border-stone-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black text-stone-900">{formatDate(r.debt.createdAt)}</div>
                  <div className="flex items-center gap-2">
                    {r.debt.dueDate && <span className="text-[10px] text-stone-500">Muddat: {r.debt.dueDate}</span>}
                    {statusBadge(r.debt)}
                  </div>
                </div>

                {/* Olingan tovarlar */}
                <div>
                  <div className="text-[10px] font-bold text-stone-500 mb-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Nima olgan:
                  </div>
                  {r.items.length > 0 ? (
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-stone-100">
                        {r.items.map((i, idx) => (
                          <tr key={idx}>
                            <td className="py-1 pr-2 text-stone-900 font-semibold">
                              {i.name}
                              {i.returnedQty > 0 && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-sky-700 font-bold">
                                  <RotateCcw className="w-3 h-3" /> {i.returnedQty} ta qaytarilgan
                                </span>
                              )}
                            </td>
                            <td className="py-1 px-2 text-right whitespace-nowrap text-stone-600">{i.quantity} × {formatMoney(i.unitPrice, c)}</td>
                            <td className="py-1 pl-2 text-right whitespace-nowrap font-bold text-stone-900">{formatMoney(i.total, c)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-xs text-stone-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      {r.note || "Qo'lda yozilgan nasiya — tovar ro'yxati kiritilmagan"}
                    </div>
                  )}
                  {r.items.length > 0 && r.note && <div className="text-[11px] text-stone-500 mt-1">Izoh: {r.note}</div>}
                </div>

                {/* To'lovlar */}
                {r.payments.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-stone-500 mb-1 flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> To'lovlar:
                    </div>
                    <div className="space-y-0.5">
                      {r.payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="text-stone-600">
                            {formatDate(p.date)} · {METHOD_LABEL[p.method] || p.method}
                            {p.employeeName ? ` · ${p.employeeName}` : ''}
                          </span>
                          <span className={`font-bold ${p.method === 'vazvrat' ? 'text-sky-700' : 'text-emerald-700'}`}>
                            −{formatMoney(p.amount, c)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.debt.auditLog && r.debt.auditLog.length > 0 && (
                  <div className="text-[10px] text-stone-500 bg-stone-50 rounded-lg px-2 py-1 space-y-0.5">
                    {r.debt.auditLog.map((l, idx) => (
                      <div key={idx} className="flex gap-1"><History className="w-3 h-3 shrink-0 mt-px" /> {formatDate(l.date)}{l.by ? ` · ${l.by}` : ''}: {l.details}</div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-stone-200 text-xs">
                  <span className="text-stone-600">Summa: <strong className="text-stone-900">{formatMoney(r.debt.totalDebt, c)}</strong></span>
                  <span className="flex items-center gap-2">
                    {onUpdateDebt && !r.debt.cancelledAt && (
                      <button type="button" onClick={() => openEdit(r.debt)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-stone-300 hover:bg-stone-100 text-[10px] font-bold text-stone-700 cursor-pointer">
                        <Pencil className="w-3 h-3" /> Tahrirlash
                      </button>
                    )}
                    <span className="text-stone-600">Qoldiq: <strong className="text-red-600">{formatMoney(r.debt.status === 'yopildi' ? 0 : r.debt.remainingAmount, c)}</strong></span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" onClick={(e) => { e.stopPropagation(); setEditing(null); }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-3 text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm">Nasiyani tahrirlash</h4>
              <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-800 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-[11px] text-stone-500">{formatDate(editing.createdAt)} · {isManual(editing) ? "Qo'lda yozilgan" : 'Savdodan yozilgan'}</div>
            {([
              ['customerName', 'Mijoz ismi', 'text'],
              ['customerPhone', 'Telefon', 'text'],
              ['dueDate', "To'lash muddati", 'date'],
              ['notes', 'Izoh', 'text']
            ] as const).map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="font-semibold text-stone-700">{label}</span>
                <input type={type} value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  className="mt-1 w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400" />
              </label>
            ))}
            <label className="block">
              <span className="font-semibold text-stone-700">Nasiya summasi {isManual(editing) ? '' : "(savdodan — o'zgarmaydi)"}</span>
              <input type="number" disabled={!isManual(editing)} value={editForm.totalDebt} onChange={(e) => setEditForm({ ...editForm, totalDebt: e.target.value })}
                className="mt-1 w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold disabled:opacity-50" />
              <span className="text-[10px] text-stone-500">To'langan: {formatMoney(editing.paidAmount, currencyOf(editing))}</span>
            </label>
            {editError && <div className="text-red-600 font-bold bg-red-50 border border-red-200 rounded-lg p-2">{editError}</div>}
            <div className="flex gap-2">
              <button onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 font-black cursor-pointer">Saqlash</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold cursor-pointer">Bekor</button>
            </div>
            {isManual(editing) && editing.status !== 'yopildi' && (
              <div className="border-t border-stone-200 pt-3 space-y-2">
                <div className="font-bold text-red-700">Xato yozilgan nasiyani bekor qilish</div>
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Sababi (masalan: ikki marta yozilgan)"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl" />
                <button onClick={doCancel} className="w-full py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-black inline-flex items-center justify-center gap-1.5 cursor-pointer">
                  <Ban className="w-3.5 h-3.5" /> Nasiyani bekor qilish
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
