import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, LogOut, Plus, Printer, Search, Smartphone, Wrench } from 'lucide-react';
import type { AuthUser } from '../types';

type RepairStatus = 'received' | 'repairing' | 'ready' | 'delivered' | 'cancelled';
type SearchDateFilter = 'today' | 'yesterday' | 'all';

interface RepairOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  deviceColor: string;
  complaint: string;
  agreedPrice?: number;
  advance: number;
  dueDate: string;
  dueTime?: string;
  note?: string;
  status: RepairStatus;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

const statusLabels: Record<RepairStatus, string> = {
  received: 'Qabul qilindi',
  repairing: 'Ta’mirda',
  ready: 'Tayyor',
  delivered: 'Topshirildi',
  cancelled: 'Bekor qilindi'
};

const statusClasses: Record<RepairStatus, string> = {
  received: 'bg-sky-100 text-sky-800',
  repairing: 'bg-amber-100 text-amber-800',
  ready: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-stone-200 text-stone-700',
  cancelled: 'bg-rose-100 text-rose-700'
};

function tashkentDate(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateInTashkent(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function formatMoney(value?: number): string {
  return value == null ? 'Diagnostikadan keyin' : `${Math.round(value).toLocaleString('uz-UZ')} so‘m`;
}

const emptyForm = () => ({
  customerName: '', customerPhone: '', deviceModel: '', deviceColor: '', complaint: '', agreedPrice: '', advance: '', dueDate: tashkentDate(), dueTime: '', note: ''
});

export const TechnicianServiceView: React.FC<Props> = ({ user, onLogout }) => {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(true);
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<SearchDateFilter>('today');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [printOrder, setPrintOrder] = useState<RepairOrder | null>(null);

  const refresh = async () => {
    const response = await fetch('/api/v1/repairs');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Buyurtmalar yuklanmadi.');
    setOrders(Array.isArray(data.data) ? data.data : []);
  };

  useEffect(() => { refresh().catch(error => setMessage(error instanceof Error ? error.message : 'Buyurtmalar yuklanmadi.')); }, []);

  const visibleOrders = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('uz');
    const digits = onlyDigits(query);
    const targetDate = dateFilter === 'today' ? tashkentDate() : dateFilter === 'yesterday' ? tashkentDate(-1) : '';
    return orders.filter(order => {
      if (targetDate && dateInTashkent(order.createdAt) !== targetDate) return false;
      if (!value) return true;
      const textMatch = [String(order.orderNumber), order.customerName, order.deviceModel, order.deviceColor, order.complaint]
        .some(field => field.toLocaleLowerCase('uz').includes(value));
      const phoneMatch = digits.length >= 3 && onlyDigits(order.customerPhone).includes(digits);
      return textMatch || phoneMatch;
    });
  }, [orders, query, dateFilter]);

  const counts = useMemo(() => ({
    active: orders.filter(order => order.status === 'received' || order.status === 'repairing').length,
    ready: orders.filter(order => order.status === 'ready').length,
    today: orders.filter(order => order.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  }), [orders]);

  const printTicket = (order: RepairOrder) => {
    setPrintOrder(order);
    window.setTimeout(() => window.print(), 80);
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/repairs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, agreedPrice: form.agreedPrice === '' ? undefined : Number(form.agreedPrice), advance: form.advance === '' ? 0 : Number(form.advance) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Telefon qabul qilinmadi.');
      const created: RepairOrder = data.data;
      setOrders(current => [created, ...current]);
      setForm(emptyForm());
      setMessage(`№ ${String(created.orderNumber).padStart(5, '0')} saqlandi.`);
      printTicket(created);
      setShowForm(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Telefon qabul qilinmadi.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (order: RepairOrder, status: RepairStatus) => {
    setMessage('');
    const response = await fetch(`/api/v1/repairs/${encodeURIComponent(order.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'Holat yangilanmadi.');
    setOrders(current => current.map(item => item.id === order.id ? data.data : item));
  };

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    onLogout();
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } body * { visibility: hidden !important; } #repair-ticket, #repair-ticket * { visibility: visible !important; } #repair-ticket { display: block !important; position: absolute; left: 0; top: 0; width: 72mm; color: #000; font-family: Arial, sans-serif; } }`}</style>
      <header className="sticky top-0 z-20 border-b border-stone-800 bg-stone-950 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-stone-950"><Wrench className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h1 className="truncate font-black">Mobileparts • Usta</h1><p className="text-[10px] text-stone-400">{user.name} • Telefon ta’miri</p></div>
          <button type="button" onClick={logout} className="flex items-center gap-1.5 rounded-xl border border-stone-700 px-3 py-2 text-xs font-bold"><LogOut className="h-4 w-4" /> Chiqish</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-sm"><span className="text-[10px] text-stone-500">Jarayonda</span><strong className="block text-xl">{counts.active}</strong></div>
          <div className="rounded-2xl bg-white p-3 shadow-sm"><span className="text-[10px] text-stone-500">Tayyor</span><strong className="block text-xl text-emerald-700">{counts.ready}</strong></div>
          <div className="rounded-2xl bg-white p-3 shadow-sm"><span className="text-[10px] text-stone-500">Bugun qabul</span><strong className="block text-xl">{counts.today}</strong></div>
        </div>

        <button type="button" onClick={() => setShowForm(value => !value)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 font-black text-stone-950 shadow-sm sm:w-auto sm:px-6"><Plus className="h-5 w-5" /> Yangi telefon qabul qilish</button>

        {showForm && (
          <form onSubmit={createOrder} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="text-lg font-black">Yangi qabul</h2><p className="text-xs text-stone-500">Qisqa ma’lumotni kiriting — saqlanganda 80 mm yorliq chiqadi.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input required value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Mijoz ismi *" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <input required inputMode="tel" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="Telefon raqami *" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <input required value={form.deviceModel} onChange={e => setForm({ ...form, deviceModel: e.target.value })} placeholder="Telefon modeli *" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <input value={form.deviceColor} onChange={e => setForm({ ...form, deviceColor: e.target.value })} placeholder="Rangi" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <textarea required value={form.complaint} onChange={e => setForm({ ...form, complaint: e.target.value })} placeholder="Mijoz shikoyati *" className="min-h-24 rounded-xl border border-stone-200 p-3 text-base outline-none focus:border-amber-400 sm:col-span-2" />
              <input inputMode="numeric" value={form.agreedPrice} onChange={e => setForm({ ...form, agreedPrice: e.target.value.replace(/\D/g, '') })} placeholder="Kelishilgan narx (bo‘sh bo‘lsa keyin)" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <input inputMode="numeric" value={form.advance} onChange={e => setForm({ ...form, advance: e.target.value.replace(/\D/g, '') })} placeholder="Avans" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <div className="rounded-xl border border-stone-200 p-2 sm:col-span-2 lg:col-span-1">
                <span className="mb-1 block text-[10px] font-bold text-stone-500">TAYYOR BO‘LISH KUNI</span>
                <div className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map(day => <button key={day} type="button" onClick={() => setForm({ ...form, dueDate: tashkentDate(day) })} className={`rounded-lg px-1 py-2 text-[11px] font-black ${form.dueDate === tashkentDate(day) ? 'bg-stone-950 text-white' : 'bg-stone-100'}`}>{day === 0 ? 'Bugun' : `+${day}`}</button>)}</div>
              </div>
              <input type="date" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <input type="time" value={form.dueTime} onChange={e => setForm({ ...form, dueTime: e.target.value })} className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Qisqa izoh (ixtiyoriy)" className="h-12 rounded-xl border border-stone-200 px-3 text-base outline-none focus:border-amber-400" />
            </div>
            <button disabled={busy} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 font-black text-white disabled:opacity-50"><Printer className="h-5 w-5" /> {busy ? 'Saqlanmoqda…' : 'Saqlash va 80 mm qog‘oz chiqarish'}</button>
          </form>
        )}

        {message && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">{message}</p>}

        <section className="rounded-3xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="mb-3"><h2 className="font-black">Telefonlarni qidirish</h2><p className="text-xs text-stone-500">Mijoz telefon raqami, telefon modeli, buyurtma raqami yoki ism bo‘yicha.</p></div>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-stone-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Masalan: 90 123 45 67 yoki Samsung A52" className="h-11 w-full rounded-xl border border-stone-200 pl-9 pr-3 text-sm outline-none focus:border-amber-400" /></div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
              {([{ value: 'today', label: 'Bugun' }, { value: 'yesterday', label: 'Kecha' }, { value: 'all', label: 'Barchasi' }] as Array<{ value: SearchDateFilter; label: string }>).map(option => (
                <button key={option.value} type="button" onClick={() => setDateFilter(option.value)} className={`rounded-lg px-3 py-2 text-xs font-black ${dateFilter === option.value ? 'bg-stone-950 text-white shadow-sm' : 'text-stone-600'}`}>{option.label}</button>
              ))}
            </div>
          </div>
          <p className="mb-3 text-[11px] font-bold text-stone-500">{visibleOrders.length} ta natija • {dateFilter === 'today' ? 'bugungi' : dateFilter === 'yesterday' ? 'kechagi' : 'barcha'} ishlar</p>
          <div className="space-y-2">
            {visibleOrders.map(order => (
              <article key={order.id} className="rounded-2xl border border-stone-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-stone-950 text-sm font-black text-amber-300">#{String(order.orderNumber).padStart(4, '0')}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate">{order.deviceModel}{order.deviceColor ? ` • ${order.deviceColor}` : ''}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusClasses[order.status]}`}>{statusLabels[order.status]}</span></div><p className="text-xs text-stone-600">{order.customerName} • {order.customerPhone}</p><p className="mt-1 text-sm"><b>Shikoyat:</b> {order.complaint}</p><div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-stone-500"><span><b>Qabul:</b> {formatDate(dateInTashkent(order.createdAt))}</span><span>{formatMoney(order.agreedPrice)}</span><span><Clock3 className="mr-1 inline h-3 w-3" />Tayyor: {formatDate(order.dueDate)} {order.dueTime || ''}</span></div></div>
                  <button type="button" onClick={() => printTicket(order)} title="Yorliqni qayta chiqarish" className="rounded-xl border border-stone-200 p-2 text-stone-600"><Printer className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex">
                  {(['received', 'repairing', 'ready', 'delivered'] as RepairStatus[]).map(status => <button key={status} type="button" onClick={() => updateStatus(order, status)} className={`rounded-lg px-3 py-2 text-[11px] font-black ${order.status === status ? 'bg-stone-950 text-white' : 'bg-stone-100 text-stone-600'}`}>{statusLabels[status]}</button>)}
                </div>
              </article>
            ))}
            {visibleOrders.length === 0 && <div className="py-12 text-center text-sm text-stone-400"><Smartphone className="mx-auto mb-2 h-8 w-8" />Telefon topilmadi.</div>}
          </div>
        </section>
      </main>

      {printOrder && (
        <section id="repair-ticket" className="hidden text-[11px] leading-tight">
          <div className="border-b-2 border-black pb-2 text-center"><strong className="block text-sm">MOBILEPARTS SERVIS</strong><span className="block text-3xl font-black">№ {String(printOrder.orderNumber).padStart(5, '0')}</span></div>
          <div className="space-y-1 py-2"><p><b>Mijoz:</b> {printOrder.customerName}</p><p><b>Tel:</b> {printOrder.customerPhone}</p><p><b>Telefon:</b> {printOrder.deviceModel}{printOrder.deviceColor ? `, ${printOrder.deviceColor}` : ''}</p><p><b>Muammo:</b> {printOrder.complaint}</p><p><b>Narx:</b> {formatMoney(printOrder.agreedPrice)}</p>{printOrder.advance > 0 && <p><b>Avans:</b> {formatMoney(printOrder.advance)}</p>}<p><b>Qabul:</b> {new Date(printOrder.createdAt).toLocaleString('uz-UZ')}</p><p className="border-t border-dashed border-black pt-1 text-base"><b>Tayyor:</b> {formatDate(printOrder.dueDate)} {printOrder.dueTime || ''}</p></div>
          <div className="border-t border-black pt-1 text-center text-[9px]">Telefon qulf kodi olinmagan • Kafolat berilmaydi</div>
        </section>
      )}
    </div>
  );
};
