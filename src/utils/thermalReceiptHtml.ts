import { SaleReceiptData, StoreSettings } from '../types';

export function thermalReceiptHtml(receipt: SaleReceiptData, store: StoreSettings, showPrices: boolean): string {
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]!));
  const money = (value: number) => escape(Number(value || 0).toLocaleString('ru-RU'));
  const line = (label: string, value: unknown) => `<div class="detail"><strong>${escape(label)}</strong> ${escape(value)}</div>`;
  const summary = (label: string, value: number, total = false) => `<div class="summary${total ? ' total' : ''}"><strong>${escape(label)}</strong><span>${money(value)}</span></div>`;
  const date = new Date(receipt.date);
  const pad = (value: number) => String(value).padStart(2, '0');
  const dateText = Number.isNaN(date.getTime()) ? receipt.date
    : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const payment = { naqd: 'Naqd', click_payme: 'Click / Payme', uzum: 'Uzum Bank', nasiya: 'Nasiya' }[receipt.paymentMethod];
  const items = receipt.items.map((item, index) => `<tr>
    <td class="index">${index + 1}</td><td>${escape(item.name)}</td><td class="qty">${escape(item.quantity)}</td>
    ${showPrices ? `<td class="number">${money(item.unitPrice)}</td><td class="number">${money(item.total)}</td>` : ''}
  </tr>`).join('');
  const units = receipt.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek</title>
    <style>
      @page { size: 80mm 297mm; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      #thermal-receipt { box-sizing: border-box; width: 80mm; padding: 2mm 4mm 3mm;
        font: 9pt/1.25 Arial, sans-serif; }
      #thermal-receipt * { box-sizing: border-box; height: auto; min-height: 0; max-height: none;
        white-space: normal; word-break: normal; overflow-wrap: break-word; }
      .header { text-align: center; margin-bottom: 1.5mm; }
      .brand { font-size: 15pt; font-weight: 700; line-height: 1.15; margin: .5mm 0; }
      .header-address { font-weight: 700; }
      .meta { margin-bottom: 1mm; }
      .date { text-align: right; font-size: 8pt; }
      .detail { margin: .3mm 0; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px dashed black; padding: .7mm .5mm; vertical-align: top; }
      th { font-size: 8pt; font-weight: 700; text-align: center; }
      tr { break-inside: avoid; }
      .index, .qty { text-align: center; font-size: 8pt; }
      .number { text-align: right; font-size: 8pt; overflow-wrap: anywhere !important; }
      .summaries { margin-top: 1mm; }
      .summary { display: flex; justify-content: space-between; gap: 2mm; margin: .4mm 0; }
      .summary span { text-align: right; }
      .total { font-size: 11pt; font-weight: 700; }
      .footer { text-align: center; font-weight: 700; margin-top: 2mm; }
    </style></head><body><div id="thermal-receipt">
      <div class="header">
        ${receipt.isReturn ? '<div>TOVAR QAYTARISH</div>' : !showPrices ? "<div>BUYURTMA RO'YXATI</div>" : ''}
        <div class="brand">${escape(store.name)}</div>
        <div class="header-address">${escape(store.address)}</div>
        ${String(store.phone || '').split(/[,;\n]+/).filter(Boolean).map(phone => `<div>${escape(phone.trim())}</div>`).join('')}
      </div>
      <div class="meta">
        <div class="date">#${escape(receipt.receiptNumber)} · ${escape(dateText)}</div>
        ${receipt.customerName ? line('Mijoz:', receipt.customerName) : ''}
        ${receipt.customerPhone && receipt.customerPhone.trim() !== '+998' ? line('Telefon:', receipt.customerPhone) : ''}
        ${receipt.returnReason ? line('Sabab:', receipt.returnReason) : ''}
      </div>
      <table>
        <colgroup><col style="width:6%"><col style="width:${showPrices ? '40%' : '79%'}"><col style="width:${showPrices ? '12%' : '15%'}">${showPrices ? '<col style="width:21%"><col style="width:21%">' : ''}</colgroup>
        <thead><tr><th>№</th><th>Mahsulot</th><th>Soni</th>${showPrices ? '<th>Narxi</th><th>Summa</th>' : ''}</tr></thead>
        <tbody>${items}</tbody>
      </table>
      <div class="summaries">
        ${showPrices ? `
          ${summary(receipt.isReturn ? "Qaytarildi (so'm)" : "Jami (so'm)", receipt.total, true)}
          ${receipt.subtotal && receipt.subtotal > receipt.total ? summary('Chegirma', receipt.subtotal - receipt.total) : ''}
          ${!receipt.isReturn ? summary("Hozir to'langan", receipt.paidAmount ?? (receipt.isDebt ? receipt.total - (receipt.debtRemaining || 0) : receipt.total)) : ''}
          ${receipt.changeAmount && !receipt.isReturn ? summary('Qaytim', receipt.changeAmount) : ''}
          ${receipt.isDebt ? summary('Bu savdodan qarz', receipt.debtRemaining || 0) + line('Muddati:', receipt.debtDueDate || '-') : ''}
          ${!receipt.isReturn && receipt.customerTotalDebt !== undefined ? (receipt.previousCustomerDebt !== undefined ? summary('Eski qarz', receipt.previousCustomerDebt) : '') + summary('Umumiy qarzdorlik', receipt.customerTotalDebt, true) : ''}
        ` : line('Jami tovar:', units + ' dona')}
        ${receipt.notes ? line('Izoh:', receipt.notes) : ''}
      </div>
      <div class="footer">${receipt.isReturn ? 'Tovar qabul qilindi.' : 'Xaridingiz uchun rahmat!'}</div>
    </div></body></html>`;
}

