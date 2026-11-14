import type { Currency, StoreSettings } from '../types';
import { escapeHtml, formatDateTime, formatSom } from './debtStatementReceipt';

export interface PaymentReceiptData {
  receiptNumber: string;
  date: string;
  store: StoreSettings;
  customerName: string;
  customerPhone?: string;
  currency: Currency;
  amount: number;
  method: 'naqd' | 'click_payme';
  /** Qaysi nasiyalarga qancha tushgani (eng eskisidan). */
  allocations: { createdAt: string; amount: number; remainingAfter: number; label?: string }[];
  debtBefore: number;
  debtAfter: number;
  cashier?: string;
}

export const paymentReceiptNumber = (date = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `TL-${String(date.getFullYear()).slice(2)}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
};

/** Mijoz to'lovi uchun 80 mm termal chek. */
export function paymentReceiptHtml(r: PaymentReceiptData): string {
  const som = (v: number) => formatSom(v, r.currency);
  const row = (label: string, value: string, cls = '') =>
    `<div class="summary ${cls}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
  const phones = String(r.store.phone || '').split(/[,;\n]+/).filter(Boolean);

  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>To'lov cheki ${escapeHtml(r.receiptNumber)}</title>
    <style>
      @page { size: 80mm 200mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      #thermal-receipt { box-sizing: border-box; width: 80mm; padding: 2mm 4mm 3mm; font: 9pt/1.25 Arial, sans-serif; }
      #thermal-receipt * { box-sizing: border-box; overflow-wrap: break-word; }
      .header { text-align: center; margin-bottom: 1.5mm; }
      .brand { font-size: 15pt; font-weight: 700; line-height: 1.15; margin: .5mm 0; }
      .title { font-weight: 700; font-size: 11pt; margin: 1.5mm 0 1mm; }
      .detail { margin: .3mm 0; }
      .summary { display: flex; justify-content: space-between; gap: 2mm; margin: .3mm 0; }
      .paid { border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 1.5mm 0; margin: 1.5mm 0; font-size: 13pt; font-weight: 700; }
      .part { padding: .8mm 0; border-bottom: 1px dotted #555; }
      .item { font-size: 8.5pt; }
      .bold { font-weight: 700; }
      .grand { margin-top: 1.5mm; font-size: 11pt; font-weight: 700; }
      .sign { margin-top: 4mm; display: flex; justify-content: space-between; font-size: 8.5pt; }
      .footer { text-align: center; font-weight: 700; margin-top: 3mm; }
    </style></head><body><div id="thermal-receipt">
      <div class="header">
        <div class="brand">${escapeHtml(r.store.name)}</div>
        ${r.store.address ? `<div>${escapeHtml(r.store.address)}</div>` : ''}
        ${phones.map((p) => `<div>${escapeHtml(p.trim())}</div>`).join('')}
        <div class="title">NASIYA TO'LOVI CHEKI</div>
      </div>
      <div class="detail"><strong>Chek:</strong> ${escapeHtml(r.receiptNumber)}</div>
      <div class="detail"><strong>Sana:</strong> ${escapeHtml(formatDateTime(r.date))}</div>
      <div class="detail"><strong>Mijoz:</strong> ${escapeHtml(r.customerName)}</div>
      ${r.customerPhone && r.customerPhone.replace(/\D/g, '').length > 3 ? `<div class="detail"><strong>Telefon:</strong> ${escapeHtml(r.customerPhone)}</div>` : ''}
      ${r.cashier ? `<div class="detail"><strong>Qabul qildi:</strong> ${escapeHtml(r.cashier)}</div>` : ''}
      ${row('Avvalgi qarz', som(r.debtBefore), 'bold')}
      <div class="paid">${row(`TO'LANDI (${r.method === 'click_payme' ? 'Click/Payme' : 'Naqd'})`, som(r.amount))}</div>
      <div class="grand">${row('QOLGAN QARZ', r.debtAfter <= 0 ? "0 — to'liq yopildi" : som(r.debtAfter))}</div>
      <div class="sign"><span>Kassir: ________</span><span>Mijoz: ________</span></div>
      <div class="footer">To'lovingiz uchun rahmat!</div>
    </div></body></html>`;
}

export interface DebtReminderData {
  store: StoreSettings;
  customerName: string;
  customerPhone?: string;
  currency: Currency;
  totalDebt: number;
  date: string;
}

/** Haftalik qarz eslatmasi (80 mm): tovarlarsiz — faqat mijoz, umumiy qarz va iltimos. */
export function debtReminderHtml(r: DebtReminderData): string {
  const phones = String(r.store.phone || '').split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const hasPhone = r.customerPhone && r.customerPhone.replace(/\D/g, '').length > 3;
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Qarz eslatmasi</title>
    <style>
      @page { size: 80mm 140mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      #thermal-receipt { box-sizing: border-box; width: 80mm; padding: 3mm 4mm 4mm; font: 9.5pt/1.3 Arial, sans-serif; }
      #thermal-receipt * { box-sizing: border-box; overflow-wrap: break-word; }
      .center { text-align: center; }
      .brand { font-size: 15pt; font-weight: 700; margin: .5mm 0; }
      .title { font-weight: 700; font-size: 12pt; margin: 2mm 0 2.5mm; border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 1.5mm 0; }
      .detail { margin: .6mm 0; }
      .debt { margin: 3mm 0; padding: 2.5mm 0; border: 1.5px solid black; text-align: center; }
      .debt .label { font-size: 9pt; }
      .debt .sum { font-size: 17pt; font-weight: 700; margin-top: .5mm; }
      .note { margin-top: 2.5mm; font-size: 9.5pt; text-align: center; }
      .phones { margin-top: 3mm; text-align: center; font-weight: 700; }
    </style></head><body><div id="thermal-receipt">
      <div class="center brand">${escapeHtml(r.store.name)}</div>
      ${r.store.address ? `<div class="center">${escapeHtml(r.store.address)}</div>` : ''}
      <div class="center title">QARZ ESLATMASI</div>
      <div class="detail"><strong>Sana:</strong> ${escapeHtml(formatDateTime(r.date))}</div>
      <div class="detail"><strong>Mijoz:</strong> ${escapeHtml(r.customerName)}</div>
      ${hasPhone ? `<div class="detail"><strong>Telefon:</strong> ${escapeHtml(r.customerPhone)}</div>` : ''}
      <div class="debt"><div class="label">UMUMIY QARZINGIZ</div><div class="sum">${escapeHtml(formatSom(r.totalDebt, r.currency))}</div></div>
      <div class="note">Hurmatli mijoz! Iltimos, qarzingizni o'z vaqtida to'lang. Hamkorligingiz uchun rahmat!</div>
      ${phones.length ? `<div class="phones">${phones.map((p) => `<div>☎ ${escapeHtml(p)}</div>`).join('')}</div>` : ''}
    </div></body></html>`;
}
