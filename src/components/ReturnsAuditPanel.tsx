import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { formatMoney } from '../utils/formatters';

interface EmployeeRow {
  employeeId: string;
  employeeName: string;
  todayCount: number;
  todayAmount: number;
  weekCount: number;
  weekAmount: number;
  flagged: boolean;
  reasons: string[];
}

interface RecentRow {
  id: string;
  timestamp: string;
  receiptNumber?: string;
  productName: string;
  quantity: number;
  amount: number;
  method?: string;
  reason?: string;
  customerName: string;
  employeeName: string;
  approvedByName: string;
}

const methodLabel = (method?: string) => ({ naqd: 'naqd', click_payme: 'Click', uzum: 'Uzum', nasiya: 'nasiyadan ayrildi' }[method || ''] || method || '');
const dateLabel = (iso: string) => new Date(iso).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Rahbar uchun: kim qancha qaytargan. Ko'p yoki katta qaytarishlar belgilanadi, lekin bloklanmaydi. */
export const ReturnsAuditPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [limits, setLimits] = useState<{ dailyCount: number; dailyAmount: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/v1/returns', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        if (!body?.success) return;
        setEmployees(body.employees || []);
        setRecent(body.recent || []);
        setLimits(body.limits || null);
      })
      .catch(() => undefined);
  }, []);

  const flaggedCount = employees.filter(row => row.flagged).length;

  return (
    <section className="rounded-2xl border bg-white p-4">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <RotateCcw className="h-4 w-4 text-amber-600" />
        <h3 className="flex-1 text-sm font-black">Qaytarishlar nazorati (oxirgi 7 kun)</h3>
        {flaggedCount > 0 && <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700"><AlertTriangle className="h-3 w-3" />{flaggedCount} ta belgilangan</span>}
        <span className="text-xs text-stone-400">{open ? 'Yopish' : 'Ochish'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {limits && <p className="text-[11px] text-stone-500">Belgilash chegarasi: bir kunda {limits.dailyCount} ta qaytarish yoki {formatMoney(limits.dailyAmount)} dan ko‘p. Qaytarishlar bloklanmaydi, faqat ko‘rsatiladi.</p>}
          {employees.length === 0 ? <p className="text-xs text-stone-400">Oxirgi 7 kunda qaytarish bo‘lmagan.</p> : (
            <div className="space-y-1.5">
              {employees.map(row => (
                <div key={row.employeeId} className={`rounded-xl border px-3 py-2 text-xs ${row.flagged ? 'border-rose-300 bg-rose-50' : 'border-stone-200'}`}>
                  <div className="flex justify-between gap-2"><strong>{row.employeeName}</strong><span>7 kun: {row.weekCount} ta • {formatMoney(row.weekAmount)}</span></div>
                  <div className="text-stone-500">Bugun: {row.todayCount} ta • {formatMoney(row.todayAmount)}</div>
                  {row.flagged && <div className="mt-1 font-bold text-rose-700">{row.reasons.join(' • ')}</div>}
                </div>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-black">Oxirgi qaytarishlar</h4>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {recent.map(row => (
                  <div key={row.id} className="rounded-lg bg-stone-50 px-3 py-2 text-[11px]">
                    <div className="flex justify-between gap-2"><strong className="truncate">{row.productName} ×{row.quantity}</strong><span className="font-black">{formatMoney(row.amount)}</span></div>
                    <div className="text-stone-500">{dateLabel(row.timestamp)} • {row.employeeName || 'Rahbar'} • {methodLabel(row.method)} • {row.customerName}</div>
                    <div className="text-stone-600">Sabab: {row.reason || '—'}{row.approvedByName ? ` • Tasdiqladi: ${row.approvedByName}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
