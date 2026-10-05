import React, { useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import type { DebtRecord, StockMovement, StoreSettings } from '../types';
import { customerDebtTotal, debtPeriodReport, PeriodCustomerReport } from '../utils/saleAccounting';
import { downloadCSV, formatMoney } from '../utils/formatters';
import { triggerPdfDownload } from '../utils/pdfGenerator';
import { createDebtStatementPdf, debtStatementFileName } from '../utils/debtStatementPdf';
import { DebtStatementParams, debtStatementReceiptHtml, formatDateTime, printThermalHtml } from '../utils/debtStatementReceipt';

interface Props {
  debts: DebtRecord[];
  movements: StockMovement[];
  store: StoreSettings;
  query: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const toInputDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toInputDate(d);
};

export const DebtPeriodReport: React.FC<Props> = ({ debts, movements, store, query }) => {
  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(() => toInputDate(new Date()));

  const customers = useMemo(() => {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59.999`).getTime();
    if (isNaN(fromMs) || isNaN(toMs)) return [];
    const q = query.trim().toLowerCase();
    return debtPeriodReport(debts, movements, fromMs, toMs).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [debts, movements, from, to, query]);

  const totalSale = customers.reduce((s, c) => s + c.saleTotal, 0);
  const totalRemaining = customers.reduce((s, c) => s + c.remaining, 0);
  const rangeInvalid = from > to;

  const setRange = (fromDate: string, toDate: string) => {
    setFrom(fromDate);
    setTo(toDate);
  };

  const statementParams = (c: PeriodCustomerReport): DebtStatementParams => ({
    customer: c,
    store,
    from,
    to,
    totalDebt: c.key.startsWith('id:') ? c.remaining : customerDebtTotal(debts, c.name)
  });

  const downloadPdf = (c: PeriodCustomerReport) => {
    const p = statementParams(c);
    if (!triggerPdfDownload(createDebtStatementPdf(p), debtStatementFileName(c.name, from, to))) {
      alert('PDF saqlanmadi. Brauzerda yuklab olishga ruxsat berilganini tekshiring.');
    }
  };

  const printReceipt = async (c: PeriodCustomerReport) => {
    try {
      await printThermalHtml(debtStatementReceiptHtml(statementParams(c)));
    } catch (error) {
      console.error('[Print] Nasiya hisobi:', error);
      alert("Printer oynasi ochilmadi. CRM-AvtoPrint yorlig'idan oching yoki PDF dan foydalaning.");
    }
  };

  const exportCSV = () => {
    const rows: string[][] = [['Mijoz', 'Telefon', 'Sana va soat', 'Olingan tovarlar', 'Sotuv summasi', 'To‘langan', 'Nasiya qoldig‘i', 'Muddat']];
    for (const c of customers) {
      for (const r of c.rows) {
        rows.push([
          c.name,
          c.phone,
          formatDateTime(r.debt.createdAt),
          r.itemLines.join('; '),
          String(r.debt.totalDebt),
          String(r.debt.paidAmount),
          String(r.debt.remainingAmount),
          r.debt.dueDate
        ]);
      }
    }
    downloadCSV(`Nasiya_${from}_${to}.csv`, rows);
  };

  const quickButton = 'px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 cursor-pointer';
  const actionButton = 'px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-xs font-bold text-stone-800 flex items-center gap-1.5 cursor-pointer';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] font-bold text-stone-600">
            Boshlanish sanasi
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-sm"
            />
          </label>
          <label className="text-[11px] font-bold text-stone-600">
            Tugash sanasi
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={quickButton} onClick={() => setRange(daysAgo(0), daysAgo(0))}>Bugun</button>
            <button type="button" className={quickButton} onClick={() => setRange(daysAgo(6), daysAgo(0))}>7 kun</button>
            <button type="button" className={quickButton} onClick={() => setRange(daysAgo(29), daysAgo(0))}>30 kun</button>
            <button
              type="button"
              className={quickButton}
              onClick={() => {
                const now = new Date();
                setRange(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), toInputDate(now));
              }}
            >
              Shu oy
            </button>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            disabled={customers.length === 0}
            className="ml-auto px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>
        {rangeInvalid && <p className="text-xs font-bold text-red-600">Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak.</p>}
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-stone-500">Mijozlar</div>
          <div className="text-lg sm:text-2xl font-black text-stone-900 mt-1">{customers.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-stone-500">Nasiyaga olingan</div>
          <div className="text-sm sm:text-xl font-black text-stone-900 mt-1">{formatMoney(totalSale)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs">
          <div className="text-[10px] sm:text-xs font-bold uppercase text-stone-500">Nasiya qoldig‘i</div>
          <div className="text-sm sm:text-xl font-black text-red-600 mt-1">{formatMoney(totalRemaining)}</div>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-xs">
          Tanlangan kunlarda nasiyaga olingan tovar topilmadi
        </div>
      ) : (
        customers.map((c) => (
          <section key={c.key} className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-stone-50 border-b border-stone-200">
              <div>
                <div className="font-black text-sm text-stone-900">{c.name}</div>
                {c.phone && <div className="text-[11px] text-stone-500">{c.phone}</div>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <div className="text-stone-500">Nasiya qoldig‘i</div>
                  <div className="font-black text-red-600 text-sm">{formatMoney(c.remaining)}</div>
                </div>
                <button type="button" onClick={() => downloadPdf(c)} className={actionButton} title="Mijozga eslatish uchun PDF">
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button type="button" onClick={() => printReceipt(c)} className={actionButton} title="80 mm chek chiqarish">
                  <Printer className="w-3.5 h-3.5" />
                  Chek
                </button>
              </div>
            </header>
            <ul className="divide-y divide-stone-100">
              {c.rows.map((r) => (
                <li key={r.debt.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 text-xs">
                  <div className="sm:w-36 shrink-0 font-bold text-stone-700 whitespace-nowrap">{formatDateTime(r.debt.createdAt)}</div>
                  <div className="flex-1 text-stone-800">
                    {r.itemLines.length === 0 ? (
                      <span className="text-stone-400">Tovar ma’lumoti yo‘q</span>
                    ) : (
                      r.itemLines.map((line, i) => <div key={i}>{line}</div>)
                    )}
                  </div>
                  <div className="sm:text-right whitespace-nowrap space-y-0.5">
                    <div className="text-stone-500">Sotuv: <span className="font-semibold text-stone-800">{formatMoney(r.debt.totalDebt)}</span></div>
                    <div className="text-stone-500">To‘langan: <span className="font-semibold text-emerald-700">{formatMoney(r.debt.paidAmount)}</span></div>
                    <div className="font-black text-red-600">Nasiya: {formatMoney(r.debt.remainingAmount)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
};
