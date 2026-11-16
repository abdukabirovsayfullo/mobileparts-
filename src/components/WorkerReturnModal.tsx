import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Currency, PaymentMethod, Product, SaleReceiptData, StockMovement } from '../types';
import { currencyOf, roundMoney } from '../utils/money';
import { formatMoney } from '../utils/formatters';
import { searchProducts } from '../utils/productSearch';
import { sameCustomer } from '../utils/customerIdentity';

type Line = { movementId: string; productId: string; productName: string; soldQuantity: number; returnedQuantity: number; returnableQuantity: number; unitRefund: number; lineTotal: number };
type Sale = { key: string; currency?: Currency; receiptNumber: string; timestamp: string; customerName: string; customerPhone?: string; employeeName: string; paymentMethod?: PaymentMethod; lines: Line[] };
type Pick = { sale: Sale; line: Line; quantity: number };
interface Props { isOpen: boolean; onClose: () => void; cashierName: string; onDone: (receipt: SaleReceiptData | null) => void; products?: Product[]; prefillMovement?: StockMovement; isOwner?: boolean }
const dateLabel = (s: string) => new Date(s).toLocaleString('uz-UZ', { timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' });
const reasons = ['Model / razmer mos kelmadi','Nuqsonli / ishlamadi','Mijoz fikridan qaytdi','Boshqa tovarga almashtirish','Boshqa'];
export function WorkerReturnModal({isOpen,onClose,cashierName,onDone,products=[],prefillMovement,isOwner=false}: Props) {
  const [tab,setTab]=useState<'history'|'products'>('history');
  const [query,setQuery]=useState(''),[date,setDate]=useState(''),[productQuery,setProductQuery]=useState('');
  const [productId,setProductId]=useState(''),[sales,setSales]=useState<Sale[]>([]),[selected,setSelected]=useState<Sale|null>(null);
  const [basket,setBasket]=useState<Record<string,Pick>>({});
  const [method,setMethod]=useState<PaymentMethod>('naqd'),[reason,setReason]=useState(reasons[0]),[custom,setCustom]=useState('');
  const [restore,setRestore]=useState(true),[print,setPrint]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  const [needsOwner,setNeedsOwner]=useState(false),[pin,setPin]=useState(''),[success,setSuccess]=useState('');
  // Rahbar: qaytarish summasini boshqa mijozning qarzidan ayirish (masalan, ism o'zgargan yoki boshqa odam to'laydi).
  type Target={debtId:string;name:string;phoneTail:string;remaining:number;currency?:Currency};
  const [target,setTarget]=useState<Target|null>(null),[targetQuery,setTargetQuery]=useState(''),[targetHits,setTargetHits]=useState<Target[]>([]),[pickingTarget,setPickingTarget]=useState(false);
  useEffect(()=>{if(!pickingTarget||targetQuery.trim().length<2){setTargetHits([]);return;}const abort=new AbortController();const t=setTimeout(async()=>{try{const r=await fetch('/api/v1/debts/customer-lookup?q='+encodeURIComponent(targetQuery),{cache:'no-store',signal:abort.signal});const b=await r.json();if(r.ok&&Array.isArray(b.data))setTargetHits(b.data.map((c:any)=>({debtId:c.debtId,name:c.name,phoneTail:c.phoneTail,remaining:c.remaining,currency:c.currency})));}catch{/* tarmoq */}},250);return()=>{clearTimeout(t);abort.abort();};},[pickingTarget,targetQuery]);
  const prefilled=useRef(false), busy=useRef(false);
  const attempt=useRef<{payload:string;id:string}|null>(null);
  useEffect(()=>{if(!isOpen)return;setTab('history');setQuery(prefillMovement?.receiptNumber||'');setDate('');setProductId('');setProductQuery('');setSelected(null);setBasket({});setMethod('naqd');setReason(reasons[0]);setCustom('');setRestore(true);setPrint(false);setError('');setSuccess('');setNeedsOwner(false);setPin('');setTarget(null);setPickingTarget(false);setTargetQuery('');prefilled.current=false;attempt.current=null;},[isOpen,prefillMovement]);
  useEffect(()=>{
    if(!isOpen)return; const abort=new AbortController();
    const timer=setTimeout(async()=>{setLoading(true);try {
      const params=new URLSearchParams({q:query,date,productId});
      const response=await fetch('/api/v1/returns/search?'+params,{cache:'no-store',signal:abort.signal});const body=await response.json();
      if(!response.ok)throw Error(body.error||'Savdolar yuklanmadi');
      if(abort.signal.aborted)return;setSales(body.data||[]);
      if(prefillMovement&&!prefilled.current){const sale=(body.data as Sale[]).find(s=>s.lines.some(l=>l.movementId===prefillMovement.id));if(sale){setSelected(sale);setMethod(sale.paymentMethod||'naqd');prefilled.current=true;}}
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Savdolar yuklanmadi');}finally{if(!abort.signal.aborted)setLoading(false);}},200);
    return()=>{clearTimeout(timer);abort.abort();};
  },[isOpen,query,date,productId,prefillMovement]);
  const picks=Object.values(basket), currency=currencyOf(picks[0]?.sale||selected||{});
  const amount=(p:Pick)=>roundMoney(p.line.lineTotal/p.line.soldQuantity*p.quantity,currencyOf(p.sale));
  const total=roundMoney(picks.reduce((s,p)=>s+amount(p),0),currency);
  const productResults=useMemo(()=>searchProducts(products,productQuery).slice(0,60),[products,productQuery]);
  function change(sale:Sale,line:Line,value:number){
    const quantity=Math.min(line.returnableQuantity,Math.max(0,Math.floor(value)||0));
    const first=picks.find(p=>p.line.movementId!==line.movementId);
    if(quantity&&first&&(currencyOf(first.sale)!==currencyOf(sale)||!sameCustomer(first.sale.customerName,first.sale.customerPhone,sale.customerName,sale.customerPhone))){setError('Bitta qaytarishda faqat bitta mijoz va bitta valyutadagi tovarlarni tanlang.');return;}
    setError('');setBasket(prev=>{const next={...prev};if(quantity)next[line.movementId]={sale,line,quantity};else delete next[line.movementId];return next;});
    if(!picks.length)setMethod(sale.paymentMethod||'naqd');
  }
  async function submit(){
    if(busy.current||!picks.length)return;busy.current=true;setSaving(true);setError('');
    const payload = {lines:picks.map(p=>({movementId:p.line.movementId,quantity:p.quantity})),reason:reason==='Boshqa'?custom:reason,refundMethod:method,restoreStock:restore,debtTargetId:method==='nasiya'&&target?target.debtId:undefined};
    const serialized=JSON.stringify(payload);
    if(attempt.current?.payload!==serialized)attempt.current={payload:serialized,id:crypto.randomUUID()};
    try{const response=await fetch('/api/v1/returns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:attempt.current.id,ownerPin:needsOwner?pin:undefined})});const body=await response.json();
      if(response.status===403&&body.code==='OWNER_APPROVAL_REQUIRED'){setNeedsOwner(true);throw Error(body.error);}
      if(!response.ok)throw Error(body.error||'Qaytarish saqlanmadi');const r=body.data;
      setSuccess(`${r.receiptNumber}: ${formatMoney(r.totalRefund,r.currency)} qaytarish saqlandi.`);
      onDone(print?{receiptNumber:r.receiptNumber,currency:r.currency,date:new Date().toISOString(),customerName:r.customerName,paymentMethod:method,items:r.movements.map((m:any)=>({id:m.productId,name:m.productName,category:m.category,quantity:m.quantity,unitPrice:m.unitPrice,total:m.totalRevenue})),subtotal:r.totalRefund,total:r.totalRefund,cashierName,isReturn:true,returnReason:reason==='Boshqa'?custom:reason}:null);
    }catch(e){setError(e instanceof Error?e.message:'Qaytarish saqlanmadi');}finally{busy.current=false;setSaving(false);}
  }
  if(!isOpen)return null;
  return <div role="dialog" aria-modal="true" aria-label="Tovar qaytarish" className="fixed inset-0 z-[80] bg-black/70 p-2 sm:p-5 flex items-center justify-center"><div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94dvh] flex flex-col overflow-hidden shadow-2xl">
    <header className="border-b p-4 flex justify-between items-center"><div><h2 className="font-black text-lg">Tovar qaytarish</h2><p className="text-xs text-stone-500">Savdoni toping → bir yoki bir nechta tovarni belgilang → sonini kiriting.{!isOwner&&' Ishchi uchun oxirgi 7 kun.'}</p></div><button type="button" onClick={onClose} disabled={saving} className="border rounded-xl px-3 py-2">Yopish</button></header>
    {success?<div className="p-8 text-center space-y-4"><strong className="block text-emerald-700">{success}</strong><button type="button" onClick={onClose} className="bg-emerald-600 text-white rounded-xl p-3">Yopish</button></div>:<div className="overflow-y-auto p-4 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)] gap-4">
      <div className="min-w-0 space-y-3"><div className="flex gap-2"><button type="button" onClick={()=>{setTab('history');setProductId('');setSelected(null);}} className={`p-3 rounded-xl font-bold text-sm ${tab==='history'?'bg-amber-400':'bg-stone-100'}`}>Savdo tarixi</button><button type="button" onClick={()=>{setTab('products');setSelected(null);setProductId('');setQuery('');}} className={`p-3 rounded-xl font-bold text-sm ${tab==='products'?'bg-amber-400':'bg-stone-100'}`}>Tovar qidirish</button></div>
      {!selected&&tab==='products'&&!productId?<><input aria-label="Qaytariladigan tovarni qidirish" placeholder="Tovar nomi yoki shtrix-kod" value={productQuery} onChange={e=>setProductQuery(e.target.value)} className="w-full border-2 rounded-xl p-3 text-stone-900"/><p className="text-xs text-stone-500">Tovarni tanlang, keyin qaysi savdodan qaytarilishini belgilang.</p><div className="max-h-[55vh] overflow-y-auto divide-y border rounded-xl">{productResults.map(p=><button type="button" key={p.id} onClick={()=>{setProductId(p.id);setQuery('');setDate('');}} className="block w-full text-left p-3 hover:bg-amber-50"><strong className="text-sm">{p.name}</strong><span className="block text-xs text-stone-500">{p.category} · {p.barcode}</span></button>)}{!productResults.length&&<p className="p-4 text-sm">Tovar topilmadi.</p>}</div></>:!selected?<>
      {productId&&<button type="button" onClick={()=>setProductId('')} className="text-sm font-bold text-amber-700">← Boshqa tovarni qidirish</button>}
      <input aria-label="Savdo tarixidan qidirish" placeholder="Chek, mijoz yoki tovar nomi" value={query} onChange={e=>setQuery(e.target.value)} className="w-full border-2 rounded-xl p-3 text-stone-900"/>
      <div className="flex gap-2 items-center text-xs"><label>Savdo sanasi<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="block border rounded-lg p-2 mt-1"/></label><button type="button" onClick={()=>setDate('')} className="border rounded-lg p-2">Barcha sanalar</button></div><p className="text-xs text-stone-500">Eng yangi 100 ta mos chek. Eski savdo uchun sana yoki chek raqamini yozing.</p>
      <div className="space-y-2 max-h-[55vh] overflow-y-auto">{loading&&<p className="p-4">Savdolar yuklanmoqda…</p>}{!loading&&!sales.length&&<p className="p-4 text-stone-500">Mos savdo topilmadi.</p>}{sales.map(s=><button key={s.key} type="button" onClick={()=>{setSelected(s);if(!picks.length)setMethod(s.paymentMethod||'naqd');setError('');}} className="w-full text-left border rounded-xl p-3 hover:bg-amber-50"><div className="flex justify-between text-xs text-stone-500 gap-2"><span>{s.receiptNumber||'Chek raqamsiz'}</span><span>{dateLabel(s.timestamp)}</span></div><strong className="block mt-1">{s.customerName}</strong><div className="text-xs text-stone-600 mt-1">{s.lines.map(l=>`${l.productName} × ${l.soldQuantity}`).join(' · ')}</div><div className="text-xs mt-1 text-emerald-700">Qaytarish mumkin: {s.lines.reduce((n,l)=>n+l.returnableQuantity,0)} dona</div></button>)}</div></>:<>
      <button type="button" onClick={()=>setSelected(null)} className="text-sm font-bold text-amber-700">← Yana savdo / tovar tanlash (ro‘yxat saqlanadi)</button><div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><strong>{selected.customerName}</strong><p className="text-xs">{selected.receiptNumber} · {dateLabel(selected.timestamp)}</p></div>
      <button type="button" onClick={()=>selected.lines.forEach(l=>{if(l.returnableQuantity>0)change(selected,l,l.returnableQuantity);})} className="border rounded-lg p-2 text-xs font-bold">Shu chekdagi barcha tovarlarni belgilash</button>
      {selected.lines.map(l=><div key={l.movementId} className={`border rounded-xl p-3 ${basket[l.movementId]?'bg-emerald-50 border-emerald-300':''}`}><label className="flex gap-2 items-start"><input type="checkbox" checked={!!basket[l.movementId]} disabled={!l.returnableQuantity} onChange={e=>change(selected,l,e.target.checked?1:0)}/><span className="font-bold text-sm">{l.productName}</span></label><p className="text-xs text-stone-500 my-2">Sotilgan: {l.soldQuantity} · Qaytgan: {l.returnedQuantity} · Qaytarish mumkin: {l.returnableQuantity}</p><div className="flex flex-wrap gap-3 items-center text-xs"><span>1 dona: {formatMoney(l.unitRefund,selected.currency)}</span><label className="font-bold">Qaytariladigan soni<input aria-label={`Qaytarish soni: ${l.productName}`} type="number" min="0" max={l.returnableQuantity} step="1" value={basket[l.movementId]?.quantity||''} placeholder="0" disabled={!l.returnableQuantity} onChange={e=>change(selected,l,Number(e.target.value))} className="ml-2 w-20 border rounded-lg p-2 bg-white"/></label></div></div>)}
      </>}
      </div>
      <aside className="border rounded-2xl p-4 space-y-3 self-start bg-stone-50 min-w-0"><h3 className="font-black">Qaytarish ro‘yxati · {picks.length} xil / {picks.reduce((s,p)=>s+p.quantity,0)} dona</h3>{!picks.length&&<p className="text-sm text-stone-500">Chapdan savdo yoki tovarni tanlang. Bir nechta qatorni belgilash mumkin.</p>}{picks.length>0&&<p className="text-sm font-bold">Mijoz: {picks[0].sale.customerName}</p>}
      <div className="space-y-2 max-h-60 overflow-y-auto">{picks.map(p=><div key={p.line.movementId} className="bg-white border rounded-xl p-3"><strong className="text-sm block">{p.line.productName}</strong><div className="text-xs text-stone-500">{p.sale.receiptNumber} · {p.quantity} dona</div><div className="flex items-center justify-between mt-1 text-sm"><strong>{formatMoney(amount(p),currency)}</strong><button type="button" onClick={()=>change(p.sale,p.line,0)} className="text-rose-600 text-xs">Olib tashlash</button></div></div>)}</div>
      <label className="block text-xs font-bold">Sabab<select value={reason} onChange={e=>setReason(e.target.value)} className="block w-full p-2 border rounded-lg mt-1">{reasons.map(r=><option key={r}>{r}</option>)}</select></label>{reason==='Boshqa'&&<input placeholder="Sababni yozing" value={custom} onChange={e=>setCustom(e.target.value)} className="w-full border rounded-lg p-2"/>}
      <label className="block text-xs font-bold">Pul / qarz qaytarish usuli<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)} className="block w-full border rounded-lg p-2 mt-1"><option value="nasiya">Shu mijozning nasiya qarzidan ayirish</option><option value="naqd">Kassadan naqd pul qaytarish</option><option value="click_payme">Click / karta orqali qaytarish</option><option value="uzum">Uzum orqali qaytarish</option></select></label>
      {method==='nasiya'&&isOwner&&picks.length>0&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2"><span>Qarzidan ayiriladi: <strong>{target?`${target.name}${target.phoneTail?` (…${target.phoneTail})`:''}`:picks[0].sale.customerName}</strong>{target&&<span className="block text-stone-600">Jami qarzi: {formatMoney(target.remaining,target.currency)}</span>}</span>
        <span className="flex gap-1">{target&&<button type="button" onClick={()=>setTarget(null)} className="border rounded-lg px-2 py-1 bg-white">Asl mijoz</button>}<button type="button" onClick={()=>setPickingTarget(v=>!v)} className="border rounded-lg px-2 py-1 bg-white font-bold">Boshqa mijoz</button></span></div>
        {pickingTarget&&<><input autoFocus placeholder="Qarzi bor mijoz ismi yoki telefoni" value={targetQuery} onChange={e=>setTargetQuery(e.target.value)} className="w-full border rounded-lg p-2"/>
        <div className="max-h-40 overflow-y-auto space-y-1">{targetHits.filter(h=>currencyOf(h)===currency).map(h=><button key={h.debtId} type="button" onClick={()=>{setTarget(h);setPickingTarget(false);setTargetQuery('');setError('');}} className="w-full text-left bg-white border rounded-lg p-2 hover:bg-amber-100"><strong>{h.name}</strong>{h.phoneTail&&` · …${h.phoneTail}`}<span className="float-right text-rose-600 font-bold">{formatMoney(h.remaining,h.currency)}</span></button>)}{targetQuery.trim().length>=2&&!targetHits.length&&<p className="text-stone-500">Qarzi bor mijoz topilmadi.</p>}</div></>}
      </div>}
      <p className="text-xs text-stone-600">{method==='nasiya'?'Mijoz qarzi kamayadi, kassadan pul chiqmaydi.':method==='naqd'?'Qaytarilgan summa kassadagi naqd puldan ayriladi.':'Naqd kassa o‘zgarmaydi.'}</p>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={restore} onChange={e=>setRestore(e.target.checked)}/>Tovar omborga qaytsin (yaroqsiz bo‘lsa belgini oling)</label><label className="flex gap-2 text-xs"><input type="checkbox" checked={print} onChange={e=>setPrint(e.target.checked)}/>Qaytarish chekini ochish</label>
      {needsOwner&&<input aria-label="Rahbar tasdiqlash PIN" type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Rahbar PIN" className="border rounded-lg p-2 w-full"/>}
      {error&&<p role="alert" className="bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl text-sm">{error}</p>}
      <div className="bg-stone-950 text-white rounded-xl p-4"><span className="text-xs">Jami qaytarish</span><strong className="block text-2xl text-amber-400">{formatMoney(total,currency)}</strong></div><button type="button" disabled={!picks.length||picks.length>30||saving||(reason==='Boshqa'&&custom.trim().length<3)||(needsOwner&&!pin)} onClick={submit} className="bg-amber-400 rounded-xl p-3 w-full font-black disabled:opacity-40">{saving?'Saqlanmoqda…':'Qaytarishni tasdiqlash'}</button>
      </aside>
    </div>}
  </div></div>;
}
