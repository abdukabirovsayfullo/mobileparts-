import React, { useMemo, useState } from 'react';
import type { Currency, DebtRecord, StockMovement, StoreSettings } from '../types';
import { currencyOf } from '../utils/money';
import { formatMoney } from '../utils/formatters';
import { customerResolver } from '../utils/saleAccounting';
import { buildCustomerStatement } from '../utils/customerStatement';
import { tashkentDate } from '../../server/expenseLogic';
import { FileDown, Wallet, RotateCcw, Loader2, Printer, Trash2, X } from 'lucide-react';

const METHOD: Record<string, string> = { naqd: 'Naqd', click_payme: 'Click / Payme', uzum: 'Uzum', vazvrat: 'Tovar qaytarildi' };
const dayLabel = (day: string) => {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
const dateTimeLabel = (iso: string) => new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const monthStart = () => `${tashkentDate().slice(0, 8)}01`;

interface Props {
  debts: DebtRecord[];
  movements: StockMovement[];
  query: string;
  store: StoreSettings;
  /** "Mijoz to'lovi" panelini ochadi — to'lov mijozning umumiy qarzidan ayriladi. */
  onRequestPayment?: (customer: { name: string; phone?: string; currency: Currency }) => void;
  /** Haftalik qarz eslatmasi cheki (tovarlarsiz). */
  onPrintReminder?: (customer: { name: string; phone?: string; currency: Currency; totalDebt: number }) => void;
  /** Rahbar: mijoz va barcha nasiyalarini butunlay o'chirish. */
  onPurgeCustomer?: (customer: { name: string; phone?: string }) => Promise<boolean>;
}

/** Mijoz tarixi: nima olgani (kun bo'yicha), to'lovlari va umumiy qarzi. Xaridlar "yopilgan" deb belgilanmaydi. */
export function CustomerDebtHistory({ debts, movements, query, store, onRequestPayment, onPrintReminder, onPurgeCustomer }: Props) {
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeText, setPurgeText] = useState('');
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const groups = useMemo(() => {
    const live = debts.filter((d) => !d.cancelledAt);
    const keyOf = customerResolver(live);
    const map = new Map<string, DebtRecord[]>();
    for (const d of live) {
      const name = d.customerName.trim().toLowerCase();
      const anonymous = !name || name.includes('mijozi');
      const key = `${keyOf(d.customerName, d.customerPhone)}|${currencyOf(d)}${anonymous ? `|${d.id}` : ''}`;
      map.set(key, [...(map.get(key) || []), d]);
    }
    return [...map].map(([key, items]) => {
      const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const withPhone = sorted.find((d) => d.customerPhone.replace(/\D/g, '').length >= 9);
      return {
        key,
        name: sorted[0].customerName,
        phone: withPhone?.customerPhone || sorted[0].customerPhone || '',
        currency: currencyOf(sorted[0]),
        count: sorted.length,
        remaining: sorted.filter((d) => d.status !== 'yopildi').reduce((s, d) => s + Math.max(0, d.remainingAmount), 0)
      };
    }).sort((a, b) => b.remaining - a.remaining);
  }, [debts]);

  const q = query.trim().toLowerCase();
  const visible = groups.filter((g) => (!onlyActive || g.remaining > 0) && `${g.name} ${g.phone}`.toLowerCase().includes(q));
  const chosen = visible.find((g) => g.key === selected) || visible[0];

  const statement = useMemo(
    () => (chosen ? buildCustomerStatement(debts, movements, chosen.name, chosen.phone, chosen.currency, from, to) : null),
    [debts, movements, chosen?.key, chosen?.name, chosen?.phone, chosen?.currency, from, to]
  );
  const money = (n: number) => formatMoney(n, chosen?.currency || 'UZS');
  const phoneTail = chosen?.phone.replace(/\D/g, '').slice(-9);
  const shared = !!phoneTail && phoneTail.length === 9 && groups.some((g) => g.key !== chosen?.key && g.phone.replace(/\D/g, '').slice(-9) === phoneTail);

  const savePdf = async () => {
    if (!statement) return;
    setPdfBusy(true);
    try {
      const [{ createCustomerStatementPdf, customerStatementFileName }, { triggerPdfDownload }] = await Promise.all([
        import('../utils/customerStatementPdf'),
        import('../utils/pdfGenerator')
      ]);
      const doc = createCustomerStatementPdf(statement, store);
      if (!triggerPdfDownload(doc, customerStatementFileName(statement.name, from, to))) {
        alert('PDF saqlanmadi. Brauzerda yuklab olishga ruxsat berilganini tekshiring.');
      }
    } catch (error) {
      console.error('[PDF] Mijoz hisobi:', error);
      alert("PDF tayyorlanmadi. Qayta urinib ko'ring.");
    } finally {
      setPdfBusy(false);
    }
  };

  const quick = (kind: 'bugun' | 'oy' | 'hammasi') => {
    if (kind === 'hammasi') { setFrom(''); setTo(''); return; }
    setFrom(kind === 'bugun' ? tashkentDate() : monthStart());
    setTo(tashkentDate());
  };

  return (
    <section className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
      <aside className="bg-white rounded-2xl border p-3 space-y-3">
        <h3 className="font-black">Mijozlar · {visible.length}</h3>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />Faqat qarzi bor mijozlar</label>
        <div className="max-h-[600px] overflow-y-auto space-y-2">
          {visible.map((g) => (
            <button type="button" key={g.key} onClick={() => setSelected(g.key)}
              className={`w-full text-left border rounded-xl p-3 cursor-pointer ${g.key === chosen?.key ? 'bg-amber-50 border-amber-400' : 'bg-white hover:bg-stone-50'}`}>
              <strong className="block text-sm">{g.name}</strong>
              <span className="text-xs text-stone-500">{g.phone || 'Telefon kiritilmagan'}</span>
              <strong className={`block mt-1 ${g.remaining > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{g.remaining > 0 ? formatMoney(g.remaining, g.currency) : 'Qarzi yo‘q'}</strong>
            </button>
          ))}
          {!visible.length && <p className="p-4 text-sm text-stone-500">Mijoz topilmadi.</p>}
        </div>
      </aside>

      {chosen && statement && (
        <div className="min-w-0 space-y-4">
          <header className="rounded-2xl bg-stone-950 text-white p-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-amber-300 font-bold">MIJOZ HISOBI</p>
              <h2 className="text-xl font-black mt-1">{chosen.name}</h2>
              <p className="text-sm text-stone-300">{chosen.phone || 'Telefon kiritilmagan'} · {chosen.currency === 'USD' ? 'Dollar' : "So'm"}</p>
              <p className="mt-3 text-xs text-stone-300">Umumiy qarz</p>
              <strong className={`text-3xl ${statement.currentDebt > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{statement.currentDebt > 0 ? money(statement.currentDebt) : "Qarzi yo'q"}</strong>
            </div>
            <div className="flex flex-col items-end gap-2">
              {onRequestPayment && statement.currentDebt > 0 && (
                <button type="button" onClick={() => onRequestPayment({ name: chosen.name, phone: chosen.phone, currency: chosen.currency })}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black inline-flex items-center gap-2 cursor-pointer">
                  <Wallet className="w-5 h-5" /> To'lov qabul qilish
                </button>
              )}
              <div className="flex gap-2">
                {onPrintReminder && statement.currentDebt > 0 && (
                  <button type="button" onClick={() => onPrintReminder({ name: chosen.name, phone: chosen.phone, currency: chosen.currency, totalDebt: statement.currentDebt })}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer" title="Qarz eslatmasi cheki (tovarlarsiz)">
                    <Printer className="w-4 h-4" /> Eslatma chek
                  </button>
                )}
                {onPurgeCustomer && (
                  <button type="button" onClick={() => { setPurgeText(''); setPurgeOpen(true); }}
                    className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                    <Trash2 className="w-4 h-4" /> Mijozni o'chirish
                  </button>
                )}
              </div>
            </div>
          </header>

          {shared && <p className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs">Bu telefon boshqa ismda ham yozilgan. Hisoblar alohida saqlanmoqda. Mijozning haqiqiy telefonini aniqlashtiring.</p>}

          <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3 items-end">
            <label className="text-xs font-bold">Sanadan<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="block border rounded-lg p-2 mt-1" /></label>
            <label className="text-xs font-bold">Sanagacha<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="block border rounded-lg p-2 mt-1" /></label>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => quick('bugun')} className="border rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-stone-50 cursor-pointer">Bugun</button>
              <button type="button" onClick={() => quick('oy')} className="border rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-stone-50 cursor-pointer">Shu oy</button>
              <button type="button" onClick={() => quick('hammasi')} className="border rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-stone-50 cursor-pointer">Butun tarix</button>
            </div>
            <button type="button" onClick={savePdf} disabled={pdfBusy}
              className="ml-auto px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 disabled:opacity-50 text-amber-400 text-sm font-black inline-flex items-center gap-2 cursor-pointer">
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF saqlash
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            {([
              ['Davrdagi xaridlar', statement.period.purchases, 'text-stone-900'],
              ["Davrdagi to'lovlar", statement.period.payments, 'text-emerald-700'],
              ['Qaytarilgan tovarlar', statement.period.returns, 'text-sky-700']
            ] as const).map(([label, value, cls]) => (
              <div key={label} className="bg-white border rounded-xl p-3 text-xs text-stone-500">{label}<strong className={`block text-base mt-1 ${cls}`}>{money(value)}</strong></div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-sm text-stone-800">Nima olgan {from || to ? '(tanlangan davr)' : '(butun tarix)'}</h3>
            {statement.days.slice().reverse().map((day) => (
              <article key={day.day} className="bg-white border rounded-2xl overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex justify-between items-center">
                  <strong className="text-sm">{dayLabel(day.day)}</strong>
                  <strong className="text-sm">{money(day.total)}</strong>
                </div>
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-stone-500"><tr><th className="pb-2">Tovar</th><th className="pb-2">Soni</th><th className="pb-2">Narxi</th><th className="pb-2 text-right">Jami</th></tr></thead>
                    <tbody className="divide-y">
                      {day.purchases.flatMap((p, pi) =>
                        p.items.length
                          ? p.items.map((it, ii) => (
                              <tr key={`${pi}-${ii}`}>
                                <td className="py-2 pr-3 font-bold">
                                  {it.name}
                                  {ii === 0 && day.purchases.length > 1 && <span className="ml-2 text-[10px] font-normal text-stone-400">{timeLabel(p.time)}</span>}
                                  {it.returnedQty > 0 && <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-sky-700 font-bold"><RotateCcw className="w-3 h-3" />{it.returnedQty} ta qaytarilgan</span>}
                                </td>
                                <td className="pr-3 whitespace-nowrap">{it.quantity} ta</td>
                                <td className="pr-3 whitespace-nowrap">{money(it.unitPrice)}</td>
                                <td className="whitespace-nowrap font-bold text-right">{money(it.total)}</td>
                              </tr>
                            ))
                          : [
                              <tr key={`${pi}-n`}>
                                <td colSpan={3} className="py-2 pr-3 text-stone-700 italic">{p.note}</td>
                                <td className="whitespace-nowrap font-bold text-right">{money(p.amount)}</td>
                              </tr>
                            ]
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
            {!statement.days.length && <p className="bg-white border rounded-xl p-6 text-center text-sm text-stone-500">Bu davrda xarid yo'q.</p>}
          </div>

          <div className="bg-white border rounded-2xl overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex justify-between">
              <strong className="text-sm text-emerald-900">To'lovlar</strong>
              <strong className="text-sm text-emerald-900">{money(statement.period.payments + statement.period.returns)}</strong>
            </div>
            <div className="divide-y">
              {[...statement.payments, ...statement.returns].sort((a, b) => b.date.localeCompare(a.date)).map((p, i) => (
                <div key={i} className="px-4 py-2.5 text-sm flex flex-wrap justify-between gap-2">
                  <span className="text-stone-600">{dateTimeLabel(p.date)} · {METHOD[p.method] || p.method}{p.employeeName ? ` · ${p.employeeName}` : ''}</span>
                  <strong className={p.method === 'vazvrat' ? 'text-sky-700' : 'text-emerald-700'}>−{money(p.amount)}</strong>
                </div>
              ))}
              {!statement.payments.length && !statement.returns.length && <p className="px-4 py-4 text-sm text-stone-500">Bu davrda to'lov yo'q.</p>}
            </div>
          </div>
        </div>
      )}

      {purgeOpen && chosen && onPurgeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !purgeBusy && setPurgeOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-red-700 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Mijozni butunlay o'chirish</h3>
              <button type="button" onClick={() => setPurgeOpen(false)} className="text-stone-400 hover:text-stone-900 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-sm text-stone-700 space-y-1">
              <div><b>{chosen.name}</b> {chosen.phone && <span className="text-stone-500">· {chosen.phone}</span>}</div>
              <div>Barcha nasiyalari ({chosen.count} ta yozuv), to'lovlar tarixi, mijozlar ro'yxatidagi yozuvi va Telegram ulanishi o'chiriladi.</div>
              {statement && statement.currentDebt > 0 && <div className="text-red-700 font-bold">Hozirgi qarzi {money(statement.currentDebt)} — u ham hisobdan yo'qoladi.</div>}
              <div className="text-xs text-stone-500">Sotuv tarixi (kunlik savdo, ombor) o'zgarmaydi. Bu amalni qaytarib bo'lmaydi.</div>
            </div>
            <label className="block text-xs font-bold text-stone-700">
              Tasdiqlash uchun <span className="text-red-700">O'CHIRISH</span> deb yozing
              <input value={purgeText} onChange={(e) => setPurgeText(e.target.value)} autoFocus
                className="mt-1 w-full px-3 py-2 border-2 border-stone-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-400" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPurgeOpen(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-sm font-bold cursor-pointer">Bekor</button>
              <button type="button" disabled={purgeText.trim().toUpperCase() !== "O'CHIRISH" || purgeBusy}
                onClick={async () => {
                  setPurgeBusy(true);
                  const ok = await onPurgeCustomer({ name: chosen.name, phone: chosen.phone });
                  setPurgeBusy(false);
                  if (ok) { setPurgeOpen(false); setSelected(''); }
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-black cursor-pointer">
                {purgeBusy ? "O'chirilmoqda…" : "Butunlay o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
