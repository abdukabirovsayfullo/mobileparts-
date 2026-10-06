import type { StoreSettings } from '../types';
import type { PeriodCustomerReport } from './saleAccounting';

export interface DebtStatementParams {
  customer: PeriodCustomerReport;
  store: StoreSettings;
  /** Davr chegaralari, YYYY-MM-DD */
  from: string;
  to: string;
  /** Mijozning hozirgi jami qarzi (davrdan tashqari nasiyalar ham kiradi). */
  totalDebt: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** YYYY-MM-DD -> DD.MM.YYYY */
export function displayDay(day: string): string {
  const [y, m, d] = day.split('-');
  return y && m && d ? `${d}.${m}.${y}` : day;
}

/** Ming ajratgichli summa (oddiy bo'sh joy bilan: PDF standart shrifti uchun ham xavfsiz). */
export function formatSom(value: number): string {
  return `${Math.round(value || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** Bitta mijozning nasiya hisoboti uchun 80 mm termal chek. */
export function debtStatementReceiptHtml({ customer, store, from, to, totalDebt }: DebtStatementParams): string {
  const row = (label: string, value: string, strong = false) =>
    `<div class="summary${strong ? ' total' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

  const debts = customer.rows
    .map(
      (r) => `<div class="debt">
        <div class="when">${escapeHtml(formatDateTime(r.debt.createdAt))}</div>
        ${r.itemLines.map((line) => `<div class="item">${escapeHtml(line)}</div>`).join('')}
        ${row('Sotuv', formatSom(r.debt.totalDebt))}
        ${row("To'langan", formatSom(r.paid))}
        ${r.returned > 0 ? row('Qaytarish', formatSom(r.returned)) : ''}
        ${row('Nasiya', formatSom(r.debt.remainingAmount), true)}
        ${r.debt.dueDate ? `<div class="item">Muddat: ${escapeHtml(r.debt.dueDate)}</div>` : ''}
      </div>`
    )
    .join('');

  const phones = String(store.phone || '').split(/[,;\n]+/).filter(Boolean);

  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Nasiya hisobi</title>
    <style>
      @page { size: 80mm 297mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      #thermal-receipt { box-sizing: border-box; width: 80mm; padding: 2mm 4mm 3mm; font: 9pt/1.25 Arial, sans-serif; }
      #thermal-receipt * { box-sizing: border-box; overflow-wrap: break-word; }
      .header { text-align: center; margin-bottom: 1.5mm; }
      .brand { font-size: 15pt; font-weight: 700; line-height: 1.15; margin: .5mm 0; }
      .title { font-weight: 700; margin: 1mm 0; }
      .detail { margin: .3mm 0; }
      .debt { border-top: 1px dashed black; padding: 1mm 0; }
      .when { font-weight: 700; }
      .item { font-size: 8.5pt; }
      .summary { display: flex; justify-content: space-between; gap: 2mm; margin: .3mm 0; }
      .total { font-weight: 700; }
      .grand { border-top: 1px dashed black; margin-top: 1mm; padding-top: 1mm; font-size: 11pt; font-weight: 700; }
      .footer { text-align: center; font-weight: 700; margin-top: 2mm; }
    </style></head><body><div id="thermal-receipt">
      <div class="header">
        <div class="brand">${escapeHtml(store.name)}</div>
        ${store.address ? `<div>${escapeHtml(store.address)}</div>` : ''}
        ${phones.map((p) => `<div>${escapeHtml(p.trim())}</div>`).join('')}
        <div class="title">NASIYA HISOBI</div>
      </div>
      <div class="detail"><strong>Mijoz:</strong> ${escapeHtml(customer.name)}</div>
      ${customer.phone && customer.phone.trim() !== '+998' ? `<div class="detail"><strong>Telefon:</strong> ${escapeHtml(customer.phone)}</div>` : ''}
      <div class="detail"><strong>Davr:</strong> ${escapeHtml(displayDay(from))} - ${escapeHtml(displayDay(to))}</div>
      ${debts}
      <div class="grand">
        ${row('Davr nasiyasi', formatSom(customer.remaining), true)}
        ${customer.returned > 0 ? row('Qaytarishlar', formatSom(customer.returned), true) : ''}
        ${row('Umumiy qarz', formatSom(totalDebt), true)}
      </div>
      <div class="footer">Iltimos, nasiyani muddatida to'lang. Rahmat!</div>
    </div></body></html>`;
}

/** Berilgan termal HTML'ni yashirin iframe orqali printerga yuboradi (PrintReceiptModal bilan bir xil usul). */
export async function printThermalHtml(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.title = 'XP-80 nasiya hisobi';
  frame.style.cssText = 'position:fixed;left:0;top:0;width:80mm;height:1px;opacity:0;pointer-events:none;border:0';
  document.body.appendChild(frame);
  const cleanup = () => frame.remove();
  try {
    const doc = frame.contentDocument!;
    const win = frame.contentWindow!;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    const root = doc.getElementById('thermal-receipt')!;
    const height = Math.max(50, Math.ceil((root.getBoundingClientRect().height * 25.4) / 96) + 2);
    const page = doc.createElement('style');
    page.textContent = `@page {size:80mm ${height}mm;margin:0;}`;
    doc.head.appendChild(page);
    win.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(cleanup, 300000);
    win.focus();
    win.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}

/** Sana yoki ISO qiymatini mahalliy vaqt bo'yicha YYYY-MM-DD ga aylantiradi. */
export function toLocalDay(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}