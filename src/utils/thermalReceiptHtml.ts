import { SaleReceiptData, StoreSettings } from '../types';
import { formatMoney } from './formatters';

export function thermalReceiptHtml(receipt: SaleReceiptData, store: StoreSettings, showPrices: boolean): string {
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]!));
  const line = (label: string, value: unknown) => `<div class="detail"><strong>${escape(label)}</strong> ${escape(value)}</div>`;
  const date = new Date(receipt.date);
  const pad = (value: number) => String(value).padStart(2, '0');
  const dateText = Number.isNaN(date.getTime()) ? receipt.date
    : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const payment = { naqd: 'Naqd', click_payme: 'Click / Payme', uzum: 'Uzum Bank', nasiya: 'Nasiya' }[receipt.paymentMethod];
  const items = receipt.items.map((item, index) => `
    <div class="item">
      <div class="item-name">${index + 1}. ${escape(item.name)}</div>
      ${item.category ? line('Toifa:', item.category) : ''}
      ${line('Soni:', item.quantity + ' dona')}
      ${showPrices ? line('Narxi:', formatMoney(item.unitPrice)) + line('Summa:', formatMoney(item.total)) : ''}
    </div>`).join('');
  const units = receipt.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek</title>
    <style>
      @page { size: 80mm 297mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      #thermal-receipt { box-sizing: border-box; width: 80mm; padding: 3mm 4mm 6mm;
        font: 10pt/1.5 Arial, sans-serif; font-weight: 500; }
      #thermal-receipt * { box-sizing: border-box; height: auto; min-height: 0; max-height: none;
        white-space: normal; word-break: normal; overflow-wrap: break-word; }
      .header { text-align: center; margin-bottom: 3mm; }
      .brand { font-size: 13pt; font-weight: 700; line-height: 1.35; margin-bottom: 2mm; }
      .section { border-top: 1px dashed black; padding-top: 2mm; margin-top: 2mm; }
      .detail { margin: 0 0 1mm; }
      .item { padding: 2mm 0; border-bottom: 1px dotted black; break-inside: avoid; }
      .item-name { font-weight: 700; font-size: 11pt; margin-bottom: 1mm; }
      .total { font-size: 13pt; font-weight: 700; margin: 2mm 0; line-height: 1.4; }
      .footer { text-align: center; margin-top: 3mm; }
    </style></head><body><div id="thermal-receipt">
      <div class="header"><div class="brand">${escape(store.name)}</div>
        <div>${escape(store.address)}</div><div>Tel: ${escape(store.phone)}</div></div>
      <div class="section">
        <div><strong>${receipt.isReturn ? 'TOVAR QAYTARISH' : showPrices ? 'SAVDO CHEKI' : "BUYURTMA RO'YXATI"}</strong></div>
        ${line('Chek raqami:', receipt.receiptNumber)}
        ${line('Sana:', dateText)}
        ${line('Kassir:', receipt.cashierName || store.accountantName)}
        ${line('Mijoz:', receipt.customerName)}
        ${receipt.customerPhone && receipt.customerPhone.trim() !== '+998' ? line('Telefon:', receipt.customerPhone) : ''}
        ${receipt.customerAddress ? line('Manzil:', receipt.customerAddress) : ''}
        ${receipt.returnReason ? line('Sabab:', receipt.returnReason) : ''}
      </div>
      <div class="section">${items}</div>
      <div class="section">
        ${showPrices ? `
          ${receipt.subtotal && receipt.subtotal > receipt.total
            ? line('Mahsulotlar:', formatMoney(receipt.subtotal)) + line('Chegirma:', formatMoney(receipt.subtotal - receipt.total)) : ''}
          <div class="total">${receipt.isReturn ? "MIJOZGA TO'LANDI:" : 'JAMI:'} ${escape(formatMoney(receipt.total))}</div>
          ${line("To'lov usuli:", payment)}
          ${receipt.paidAmount !== undefined && !receipt.isReturn ? line('Berilgan pul:', formatMoney(receipt.paidAmount)) : ''}
          ${receipt.changeAmount && !receipt.isReturn ? line('Qaytim:', formatMoney(receipt.changeAmount)) : ''}
          ${receipt.isDebt ? line('Qarz:', formatMoney(receipt.debtRemaining || 0)) + line('Muddati:', receipt.debtDueDate || '-') : ''}
        ` : line('Jami tovar:', units + ' dona')}
        ${receipt.notes ? line('Izoh:', receipt.notes) : ''}
      </div>
      <div class="footer"><strong>${receipt.isReturn ? 'Tovar qabul qilindi.' : 'Xaridingiz uchun rahmat!'}</strong></div>
    </div></body></html>`;
}
