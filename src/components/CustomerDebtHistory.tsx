import React, { useMemo, useState } from 'react';
import type { DebtRecord, StockMovement } from '../types';
import { currencyOf } from '../utils/money';
import { formatMoney } from '../utils/formatters';
import { tashkentDate } from '../../server/expenseLogic';

const identity = (d: DebtRecord) => {
  const name = d.customerName.trim().toLowerCase().replace(/\s+/g,' ');
  const phone = (d.customerPhone || '').replace(/\D/g,'').slice(-9);
  return `${name}|${phone.length===9 ? phone : ''}|${currencyOf(d)}${!name || name.includes('mijozi') ? '|'+d.id : ''}`;
};
const dateLabel = (s: string) => new Date(s).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

export function CustomerDebtHistory({debts, movements, query, onPay}: {debts: DebtRecord[]; movements: StockMovement[]; query: string; onPay: (d: DebtRecord)=>void}) {
  const [selected, setSelected] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const groups = useMemo(() => {
    const map = new Map<string, DebtRecord[]>();
    for(const d of debts) { const key=identity(d); map.set(key,[...(map.get(key)||[]),d]); }
    return [...map].map(([key,items])=>({key,items:items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),remaining:items.reduce((s,d)=>s+d.remainingAmount,0)})).sort((a,b)=>b.remaining-a.remaining);
  },[debts]);
  const visible = groups.filter(g=>(!onlyActive||g.remaining>0)&&`${g.items[0].customerName} ${g.items[0].customerPhone}`.toLowerCase().includes(query.trim().toLowerCase()));
  const chosen = visible.find(g=>g.key===selected)||visible[0];
  const d=chosen?.items[0];
  const money=(n:number)=>formatMoney(n,d ? currencyOf(d) : 'UZS');
  const records=chosen?.items.filter(r=>(!from||tashkentDate(r.createdAt)>=from)&&(!to||tashkentDate(r.createdAt)<=to))||[];
  const sums=chosen?.items.reduce((s,r)=>({total:s.total+r.totalDebt,paid:s.paid+r.paidAmount,returned:s.returned+(r.paymentHistory||[]).filter(p=>p.method==='vazvrat').reduce((a,p)=>a+p.amount,0)}),{total:0,paid:0,returned:0});
  const phone=d?.customerPhone.replace(/\D/g,'').slice(-9);
  const shared=phone?.length===9&&groups.some(g=>g.key!==chosen?.key&&g.items[0].customerName.toLowerCase()!==d?.customerName.toLowerCase()&&g.items[0].customerPhone.replace(/\D/g,'').slice(-9)===phone);
  return <section className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
    <aside className="bg-white rounded-2xl border p-3 space-y-3"><h3 className="font-black">Mijozlar · {visible.length}</h3><label className="flex gap-2 text-xs"><input type="checkbox" checked={onlyActive} onChange={e=>setOnlyActive(e.target.checked)}/>Faqat qarzi bor mijozlar</label><div className="max-h-[600px] overflow-y-auto space-y-2">{visible.map(g=><button type="button" key={g.key} onClick={()=>{setSelected(g.key);setFrom('');setTo('');}} className={`w-full text-left border rounded-xl p-3 ${g.key===chosen?.key?'bg-amber-50 border-amber-400':'bg-white'}`}><strong className="block text-sm">{g.items[0].customerName}</strong><span className="text-xs text-stone-500">{g.items[0].customerPhone || 'Telefon kiritilmagan'}</span><strong className="block text-rose-700 mt-1">{formatMoney(g.remaining,currencyOf(g.items[0]))}</strong><span className="text-xs">{g.items.length} ta xarid / yozuv</span></button>)}{!visible.length&&<p className="p-4 text-sm text-stone-500">Mijoz topilmadi.</p>}</div></aside>
    {d&&chosen&&sums&&<div className="min-w-0 space-y-4"><header className="rounded-2xl bg-stone-950 text-white p-5"><p className="text-xs text-amber-300">MIJOZNING NASIYA TARIXI</p><h2 className="text-xl font-black mt-1">{d.customerName}</h2><p className="text-sm text-stone-300">{d.customerPhone || 'Telefon kiritilmagan'} · {currencyOf(d)}</p><p className="mt-3 text-xs text-stone-300">Hozirgi qarz</p><strong className="text-3xl text-amber-400">{money(chosen.remaining)}</strong></header>
      {shared&&<p className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs">Bu telefon boshqa ismda ham yozilgan. Hisoblar alohida saqlanmoqda. Mijozning haqiqiy telefonini aniqlashtiring.</p>}
      <div className="grid sm:grid-cols-3 gap-2">{[['Jami nasiya xaridlari',sums.total],['Pul bilan to‘langan',sums.paid-sums.returned],['Qaytarish bilan ayrilgan',sums.returned]].map(([label,value])=><div key={label} className="bg-white border rounded-xl p-3 text-xs text-stone-500">{label}<strong className="block text-base text-stone-900 mt-1">{money(Number(value))}</strong></div>)}</div>
      <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3 items-end"><label className="text-xs font-bold">Xarid sanasidan<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="block border rounded-lg p-2 mt-1"/></label><label className="text-xs font-bold">Sanagacha<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="block border rounded-lg p-2 mt-1"/></label><button type="button" onClick={()=>{setFrom('');setTo('');}} className="border rounded-lg p-2 text-xs">Butun tarix</button><span className="text-xs text-stone-500">{records.length} ta yozuv · Jami qarz sana filtridan qat’i nazar ko‘rsatiladi.</span></div>
      {records.map(r=>{const first=movements.find(m=>m.id===r.movementId);const items=first?movements.filter(m=>m.type==='chiqim'&&(first.batchSaleId?m.batchSaleId===first.batchSaleId:m.id===first.id)):[];return <article key={r.id} className="bg-white border rounded-2xl overflow-hidden"><div className="bg-stone-50 border-b p-4 flex flex-wrap justify-between gap-2"><div><strong>{dateLabel(r.createdAt)}</strong><p className="text-xs text-stone-500">{first?.receiptNumber||'Qo‘lda yozilgan nasiya'} · {first?.employeeName||'Xodim ko‘rsatilmagan'}</p></div><span className={`text-xs font-bold rounded-lg p-2 ${r.remainingAmount>0?'bg-rose-100 text-rose-700':'bg-emerald-100 text-emerald-700'}`}>{r.remainingAmount>0?'Qarz bor':'Yopilgan'}</span></div>
      <div className="p-4 space-y-4">{items.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-stone-500"><tr><th className="pb-2">Olingan tovar</th><th>Soni</th><th>Dona narxi</th><th>Jami</th></tr></thead><tbody className="divide-y">{items.map(m=><tr key={m.id}><td className="py-3 pr-3 font-bold">{m.productName}<span className="block text-xs text-stone-500 font-normal">{m.category}</span></td><td className="pr-3 whitespace-nowrap">{m.quantity} ta</td><td className="pr-3 whitespace-nowrap">{money(m.unitPrice)}</td><td className="whitespace-nowrap font-bold">{money(m.totalRevenue)}</td></tr>)}</tbody></table></div>:<p className="text-sm bg-amber-50 p-3 rounded-xl">Tovar tafsiloti bu yozuvga bog‘lanmagan. {r.notes||'Eski yoki qo‘lda kiritilgan qarz.'}</p>}
      <div className="grid grid-cols-3 gap-2 text-xs"><div>Xarid summasi<strong className="block text-sm">{money(r.totalDebt)}</strong></div><div>To‘lov va qaytarish<strong className="block text-sm">{money(r.paidAmount)}</strong></div><div>Qolgan qarz<strong className="block text-sm text-rose-700">{money(r.remainingAmount)}</strong></div></div>
      <details><summary className="cursor-pointer text-sm font-bold">To‘lov va qaytarish tarixi ({r.paymentHistory?.length||0})</summary><div className="divide-y mt-2">{(r.paymentHistory||[]).map((p,i)=><div key={i} className="py-2 text-xs flex flex-wrap justify-between gap-2"><span>{dateLabel(p.date)} · {p.method==='vazvrat'?'Tovar qaytarilgan':p.method==='naqd'?'Naqd to‘lov':'Click / Payme'}{p.employeeName&&` · ${p.employeeName}`}</span><strong>{money(p.amount)}</strong></div>)}{!r.paymentHistory?.length&&<p className="text-xs p-2 text-stone-500">To‘lov yozilmagan.</p>}</div></details>
      {r.remainingAmount>0&&<button type="button" onClick={()=>onPay(r)} className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-bold">Shu qarzga to‘lov kiritish</button>}</div></article>})}{!records.length&&<p className="bg-white border rounded-xl p-6 text-center">Bu davrda xarid yo‘q.</p>}
    </div>}
  </section>;
}
