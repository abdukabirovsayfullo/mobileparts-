import React, { useMemo, useState } from 'react';
import type { Currency, StockMovement } from '../types';
import { currencyOf } from '../utils/money';
import { formatMoney } from '../utils/formatters';
import { tashkentDate } from '../../server/expenseLogic';

export function DailySalesPanel({ movements, onPrint }: { movements: StockMovement[]; onPrint?: (m: StockMovement) => void }) {
  const [date, setDate] = useState(tashkentDate());
  const [method, setMethod] = useState('naqd');
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => movements.filter(m => (m.type === 'chiqim' || m.type === 'vazvrat') && tashkentDate(m.timestamp) === date && currencyOf(m) === currency && (method === 'all' || m.paymentMethod === method) && `${m.productName} ${m.counterparty || ''} ${m.receiptNumber || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b) => b.timestamp.localeCompare(a.timestamp)), [movements, date, currency, method, query]);
  const sales = rows.filter(m => m.type === 'chiqim');
  const returns = rows.filter(m => m.type === 'vazvrat');
  const total = sales.reduce((s,m) => s + m.totalRevenue, 0);
  const refunded = returns.reduce((s,m) => s + m.totalRevenue, 0);
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, pages - 1);
  const money = (v: number) => formatMoney(v, currency);
  return <section className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-4 min-w-0">
    <div><h3 className="text-lg font-black">Kunlik savdolar</h3><p className="text-xs text-stone-500">Sanani tanlang. Shu kuni sotilgan va qaytarilgan barcha tovarlar shu yerda. Vaqt: Toshkent.</p></div>
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-xs font-bold">Sana<input aria-label="Savdo sanasi" type="date" value={date} onChange={e => { setDate(e.target.value || tashkentDate()); setPage(0); }} className="block border rounded-xl px-3 py-2 text-sm mt-1" /></label>
      <button type="button" onClick={() => { setDate(tashkentDate()); setPage(0); }} className="border rounded-xl px-3 py-2 text-sm">Bugun</button>
      <label className="text-xs font-bold">To‘lov turi<select value={method} onChange={e => { setMethod(e.target.value); setPage(0); }} className="block border rounded-xl px-3 py-2 text-sm mt-1"><option value="naqd">Naqd savdolar</option><option value="all">Barcha savdolar</option><option value="click_payme">Click / Payme</option><option value="uzum">Uzum</option><option value="nasiya">Nasiya</option></select></label>
      <label className="text-xs font-bold">Valyuta<select value={currency} onChange={e => { setCurrency(e.target.value as Currency); setPage(0); }} className="block border rounded-xl px-3 py-2 text-sm mt-1"><option value="UZS">So‘m</option><option value="USD">Dollar</option></select></label>
      <input aria-label="Kunlik savdodan qidirish" placeholder="Tovar, mijoz yoki chekni qidiring" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} className="border rounded-xl px-3 py-2 text-sm min-w-0 flex-1 text-stone-900" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
      {[['Sotilgan', `${sales.reduce((s,m) => s+m.quantity,0)} dona · ${new Set(sales.map(m => m.batchSaleId || m.id)).size} ta chek`], ['Savdo summasi',money(total)], ['Qaytarilgan', `${returns.reduce((s,m) => s+m.quantity,0)} dona · ${money(refunded)}`], ['Qaytarishdan keyingi savdo',money(total-refunded)]].map(([label,value]) => <div key={label} className="bg-stone-50 border rounded-xl p-3"><span className="text-stone-500">{label}</span><strong className="block text-base mt-1">{value}</strong></div>)}
    </div>
    <p className="text-xs text-stone-500">Summalar tanlangan filtr bo‘yicha. Savdo summasi chegirmadan keyin. Bu savdo hisoboti; kassa xarajatlari va keyin to‘langan nasiyalar kiritilmagan.</p>
    <div className="overflow-x-auto"><table className="w-full text-xs text-left whitespace-nowrap"><thead className="bg-stone-100"><tr>{['Vaqt / Chek','Tovar / Kategoriya','Soni','Dona narxi','Jami summa','To‘lov','Mijoz / Xodim',''].map((h,i) => <th key={i} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.slice(currentPage*50,currentPage*50+50).map(m => <tr key={m.id} className={m.type === 'vazvrat' ? 'bg-rose-50' : ''}>
      <td className="p-3">{new Date(m.timestamp).toLocaleTimeString('uz-UZ',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit'})}<div className="text-stone-500">{m.receiptNumber || '—'}</div>{m.type === 'vazvrat' && <strong className="text-rose-600">QAYTARISH</strong>}</td>
      <td className="p-3 whitespace-normal min-w-48"><strong>{m.productName}</strong><div className="text-stone-500">{m.category}</div></td><td className="p-3">{m.quantity} ta</td><td className="p-3">{money(m.unitPrice)}</td><td className="p-3 font-black">{m.type === 'vazvrat' ? '−' : ''}{money(m.totalRevenue)}</td><td className="p-3">{{naqd:'Naqd',click_payme:'Click / Payme',uzum:'Uzum',nasiya:'Nasiya'}[m.paymentMethod || 'naqd']}</td><td className="p-3">{m.counterparty || 'Do‘kon mijozi'}<div className="text-stone-500">{m.employeeName || '—'}</div></td><td className="p-3">{onPrint && <button type="button" onClick={() => onPrint(m)} className="border rounded-lg px-3 py-2">Chek</button>}</td>
    </tr>)}</tbody></table>{!rows.length && <p className="text-center p-8 text-stone-500">Bu sana va filtr bo‘yicha savdo yo‘q.</p>}</div>
    <div className="flex items-center gap-3 text-xs"><span>Jami {rows.length} qator · {currentPage+1} / {pages} sahifa</span><button type="button" disabled={currentPage===0} onClick={() => setPage(currentPage-1)} className="border rounded-lg p-2 disabled:opacity-40">Oldingi</button><button type="button" disabled={currentPage+1>=pages} onClick={() => setPage(currentPage+1)} className="border rounded-lg p-2 disabled:opacity-40">Keyingi</button></div>
  </section>;
}
