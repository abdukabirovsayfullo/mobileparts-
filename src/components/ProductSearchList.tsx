import React from 'react';
import type { Product } from '../types';
import { currencyOf, roundMoney } from '../utils/money';
import { formatMoney } from '../utils/formatters';

export function ProductSearchList({ products, total, mode, onPick, onMore }: { products: Product[]; total: number; mode: 'optom' | 'chakana'; onPick: (p: Product) => void; onMore: () => void }) {
  return <div className="rounded-xl border border-stone-200 overflow-hidden bg-white" aria-label="Tovar qidiruv natijalari">
    <div role="status" className="px-3 py-2 bg-stone-50 text-xs text-stone-600">{total} ta tovar topildi · Savatga qo‘shish uchun qatorni bosing</div>
    <div className="max-h-[55vh] overflow-y-auto divide-y divide-stone-100">
      {products.map(p => {
        const price = mode === 'optom' ? p.wholesalePrice || roundMoney(p.sellingPrice * 0.8, currencyOf(p)) : p.sellingPrice;
        return <button key={p.id} type="button" disabled={p.stock <= 0} onClick={() => onPick(p)} className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-amber-50 focus:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
          <span className="min-w-0"><strong className="block text-sm sm:text-base text-stone-950 break-words">{p.name}</strong><span className="block mt-1 text-xs text-stone-500">{p.category} · Kod: {p.barcode || '—'}</span></span>
          <span className="shrink-0 text-right"><strong className="block text-sm sm:text-base text-amber-700">{formatMoney(price, currencyOf(p))}</strong><span className={`block text-xs mt-1 font-bold ${p.stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{p.stock > 0 ? `${p.stock} ta mavjud` : 'Tugagan'}</span><span className="text-[10px] text-stone-500">{mode === 'optom' ? 'Optom' : 'Chakana'}</span></span>
        </button>;
      })}
      {!total && <p className="p-5 text-sm text-stone-500">Tovar topilmadi. Nomini qisqaroq yoki modelini yozib ko‘ring.</p>}
    </div>
    {products.length < total && <button type="button" onClick={onMore} className="w-full p-3 border-t font-bold text-sm hover:bg-stone-50">Yana ko‘rsatish ({total - products.length} ta)</button>}
  </div>;
}
