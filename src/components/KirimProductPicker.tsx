import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Product } from '../types';
import { exactProductCodeMatch, searchProducts } from '../utils/productSearch';
import { LastKirim } from '../utils/kirimHelpers';
import { formatMoney } from '../utils/formatters';
import { currencyOf } from '../utils/money';
import { displayDay, toLocalDay } from '../utils/debtStatementReceipt';

interface Props {
  products: Product[];
  query: string;
  onQueryChange: (query: string) => void;
  lastKirim: Map<string, LastKirim>;
  marked: Product[];
  onToggle: (product: Product) => void;
  onAddMarked: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const MAX_ROWS = 12;

export const KirimProductPicker: React.FC<Props> = ({
  products, query, onQueryChange, lastKirim, marked, onToggle, onAddMarked, inputRef
}) => {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => query.trim() ? searchProducts(products, query) : [], [products, query]);

  useEffect(() => {
    setActive(0);
  }, [results.length, query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!query.trim()) return;
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.min(results.length, MAX_ROWS) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const exact = exactProductCodeMatch(products, query);
      const chosen = exact ?? results[active];
      if (chosen) onToggle(chosen);
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      onQueryChange('');
    }
  };

  const shown = results.slice(0, MAX_ROWS);

  return (
    <div className="space-y-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          placeholder="Tovar nomi, brend yoki shtrix-kod (Enter — tanlash)..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-8 pr-8 py-2 bg-white border border-stone-300 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            aria-label="Qidiruvni tozalash"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {query.trim() && <>
      <div ref={listRef} className="max-h-40 overflow-y-auto rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
        {shown.length === 0 ? (
          <div className="p-4 text-center text-xs text-stone-500">
            Mos tovar topilmadi. Yuqoridagi "Yangi tovar yaratish" tugmasidan foydalaning.
          </div>
        ) : (
          shown.map((p, index) => {
            const last = lastKirim.get(p.id)?.movement;
            const isSelected = marked.some((item) => item.id === p.id);
            const stockTone = p.stock <= 0 ? 'bg-rose-100 text-rose-700' : p.stock <= (p.minStockAlert ?? 0) ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600';
            return (
              <button
                key={p.id}
                type="button"
                data-active={index === active}
                aria-pressed={isSelected}
                onClick={() => onToggle(p)}
                onMouseEnter={() => setActive(index)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 cursor-pointer ${
                  isSelected ? 'bg-emerald-50' : index === active ? 'bg-stone-100' : 'bg-white'
                }`}
              >
                <span aria-hidden="true" className="w-4 shrink-0 font-black">{isSelected ? "✓" : "+"}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs truncate ${isSelected ? 'font-black text-emerald-900' : 'font-bold text-stone-900'}`}>{p.name}</div>
                  <div className="text-[10px] text-stone-500 truncate">
                    {p.category}
                    {p.brand ? ` · ${p.brand}` : ''}
                    {p.barcode ? ` · ${p.barcode}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${stockTone}`}>Qoldiq: {p.stock}</span>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    {last ? `Oxirgi: ${formatMoney(last.unitCost, currencyOf(last))} · ${displayDay(toLocalDay(last.timestamp))}` : `Tan: ${formatMoney(p.purchasePrice, currencyOf(p))}`}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div className="text-[10px] text-stone-500 px-1">
        {results.length} ta tovar{results.length > MAX_ROWS ? ` (dastlabki ${MAX_ROWS} tasi ko'rsatilgan, qidiruvni aniqlashtiring)` : ''} · ↑↓ tanlash, Enter — belgilash
      </div>
      </>}
      {marked.length > 0 && (
        <button type="button" onClick={onAddMarked}
          className="w-full rounded-xl bg-emerald-700 px-3 py-2 font-bold text-white">
          Belgilangan {marked.length} ta tovarni ro‘yxatga qo‘shish
        </button>
      )}
    </div>
  );
};
