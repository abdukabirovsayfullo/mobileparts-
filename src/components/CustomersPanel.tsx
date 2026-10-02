import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Phone, Plus, Search, ShoppingCart, Trash2, Upload, Users } from 'lucide-react';
import type { CustomerProfile } from '../types';

interface Props {
  isOwner: boolean;
  /** Shu qurilmada (brauzerda) oldin saqlangan mijozlar: Rahbar ularni serverga ko'chira oladi. */
  localCustomers?: CustomerProfile[];
  onPick: (customer: CustomerProfile) => void;
}

const dateLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

/** Doimiy mijozlar: tez qidirish, sotuvga tanlash, yangisini qo'shish. */
export const CustomersPanel: React.FC<Props> = ({ isOwner, localCustomers = [], onPick }) => {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<CustomerProfile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '+998 ', address: '', notes: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (text: string) => {
    try {
      const response = await fetch(`/api/v1/customers?q=${encodeURIComponent(text)}`, { cache: 'no-store' });
      const body = await response.json();
      if (response.ok && Array.isArray(body.data)) setList(body.data);
    } catch {
      /* tarmoq xatosi */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { load(query); }, 200);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Mijoz saqlanmadi.');
      setMessage(`${body.data.name} saqlandi.`);
      setForm({ name: '', phone: '+998 ', address: '', notes: '' });
      setShowForm(false);
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mijoz saqlanmadi.');
    }
  };

  const remove = async (customer: CustomerProfile) => {
    if (!window.confirm(`${customer.name} doimiy mijozlar ro'yxatidan o'chirilsinmi? (Nasiya va savdo tarixi o'chmaydi.)`)) return;
    const response = await fetch(`/api/v1/customers/${encodeURIComponent(customer.id)}`, { method: 'DELETE' });
    if (response.ok) await load(query);
  };

  const importLocal = async () => {
    setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/customers/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customers: localCustomers }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Ko'chirilmadi.");
      setMessage(`${body.data.added} ta yangi mijoz serverga ko'chirildi (o'tkazib yuborilgan: ${body.data.skipped}).`);
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ko'chirilmadi.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-400 flex items-center justify-center"><Users className="w-5 h-5 text-stone-950" /></div>
          <div>
            <h2 className="text-xl font-black text-stone-950">Doimiy mijozlar</h2>
            <p className="text-xs text-stone-500">Mijozni toping va bitta bosish bilan sotuvga tanlang.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && localCustomers.length > 0 && (
            <button type="button" onClick={importLocal} className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold flex items-center gap-1.5 hover:bg-stone-100">
              <Upload className="w-4 h-4" /> Shu qurilmadagi {localCustomers.length} ta mijozni ko'chirish
            </button>
          )}
          <button type="button" onClick={() => setShowForm(v => !v)} className="px-4 py-2 rounded-xl bg-stone-950 text-white text-sm font-black flex items-center gap-1.5 hover:bg-stone-800">
            <Plus className="w-4 h-4" /> Yangi mijoz
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ism / do'kon nomi" className="px-3 py-2.5 border-2 border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-400" />
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefon" inputMode="tel" className="px-3 py-2.5 border-2 border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-400" />
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Manzil (ixtiyoriy)" className="px-3 py-2.5 border-2 border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Izoh (ixtiyoriy)" className="px-3 py-2.5 border-2 border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-stone-100 text-sm font-bold">Bekor</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-400 text-stone-950 text-sm font-black">Saqlash</button>
          </div>
        </form>
      )}

      {(message || error) && (
        <div className={`rounded-xl px-4 py-2.5 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{error || message}</div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          autoFocus={!showForm}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ism yoki telefon bo'yicha qidiring..."
          className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-stone-200 rounded-xl text-base font-semibold focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {loaded && list.length === 0 && (
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
            {query ? 'Bunday mijoz topilmadi.' : "Hali doimiy mijoz yo'q. «Yangi mijoz» tugmasi bilan qo'shing; ism va telefon bilan sotuv qilsangiz, mijoz o'zi qo'shiladi."}
          </div>
        )}
        {list.map(customer => (
          <div key={customer.id} className="bg-white rounded-xl border-2 border-stone-200 p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-black text-[15px] text-stone-900 truncate">{customer.name}</div>
                <div className="text-sm text-stone-600 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />{customer.phone || '—'}</div>
                {customer.address && <div className="text-xs text-stone-500 flex items-center gap-1.5 truncate"><MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />{customer.address}</div>}
                {customer.notes && <div className="text-xs text-stone-500 truncate">{customer.notes}</div>}
              </div>
              {isOwner && (
                <button type="button" onClick={() => remove(customer)} title="Ro'yxatdan o'chirish" className="text-stone-300 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-stone-400">{customer.lastVisit ? `Oxirgi savdo: ${dateLabel(customer.lastVisit)}` : ''}</span>
              <button type="button" onClick={() => onPick(customer)} className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-sm font-black flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" /> Sotuvga tanlash
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
