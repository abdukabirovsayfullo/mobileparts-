import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentReceiptHtml, paymentReceiptNumber } from './paymentReceipt';

test("paymentReceiptHtml: to'lov, taqsimot va qolgan qarz chekda", () => {
  const html = paymentReceiptHtml({
    receiptNumber: paymentReceiptNumber(new Date(2026, 10, 13, 21, 5, 9)),
    date: '2026-11-13T16:05:09Z',
    store: { name: 'MOBILE PARTS', address: 'Paxtaobod', phone: '+998 90 000 00 00' } as any,
    customerName: 'Nurullo <usta>', customerPhone: '+998 90 555 44 33', currency: 'UZS', amount: 130000, method: 'naqd',
    allocations: [{ createdAt: '2026-11-01T10:00:00Z', amount: 120000, remainingAfter: 0 }, { createdAt: '2026-11-10T10:00:00Z', amount: 10000, remainingAfter: 35000 }],
    debtBefore: 165000, debtAfter: 35000, cashier: 'Akmal'
  });
  assert.match(html, /TL-261113-210509/);
  assert.match(html, /130 000 so&#39;m/);
  assert.match(html, /165 000 so&#39;m/);
  assert.doesNotMatch(html, /YOPILDI/); // chekda xaridlar yopilmaydi — faqat umumiy qarz
  assert.match(html, /35 000 so&#39;m/);
  assert.match(html, /Nurullo &lt;usta&gt;/);
  assert.doesNotMatch(html, /<usta>/);
});

test("debtReminderHtml: faqat umumiy qarz, tovarlarsiz", async () => {
  const { debtReminderHtml } = await import('./paymentReceipt');
  const html = debtReminderHtml({ store: { name: 'MOBILE PARTS', address: 'Paxtaobod', phone: '+998 95 200 13 33, +998 91 174 13 33' } as any,
    customerName: 'Nurullo aka', customerPhone: '+998 90 555 44 33', currency: 'UZS', totalDebt: 95000, date: '2026-11-15T10:00:00Z' });
  assert.match(html, /QARZ ESLATMASI/);
  assert.match(html, /95 000 so&#39;m/);
  assert.match(html, /\+998 91 174 13 33/);
  assert.doesNotMatch(html, /Tovar|dona/);
});
