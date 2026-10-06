import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerDebtTotal, saleAccounting, movementPaymentSummary, debtOverdueDays, groupDebtsByCustomer, clampDebtPayment, debtPeriodReport } from './saleAccounting';
import { thermalReceiptHtml } from './thermalReceiptHtml';
import { DebtRecord, StockMovement, SaleReceiptData } from '../types';

const debt = (remaining: number, name = 'Akromjon'): DebtRecord => ({ id: String(remaining), customerName: name, customerPhone: '', totalDebt: 50000, paidAmount: 50000 - remaining, remainingAmount: remaining, dueDate: '2026-10-10', createdAt: '2026-09-30T10:00:00Z', status: remaining ? 'faol' : 'yopildi' });
const movement = (line: ReturnType<typeof saleAccounting>['lines'][number], id: string): StockMovement => ({ id, type: 'chiqim', productId: id, productName: 'Sinov', category: '', quantity: 1, unitCost: 10000, unitPrice: line.revenue, totalCost: 10000, totalRevenue: line.revenue, profit: line.revenue - 10000, timestamp: '2026-09-30T10:00:00Z', counterparty: 'Akromjon', paymentMethod: 'nasiya', paidAmount: line.paid, debtRemaining: line.debt, previousCustomerDebt: 50000, customerTotalDebt: 120000 });

test('partial payment is preserved on saved movements and reprints; balance follows later debt payments', () => {
  const a = saleAccounting([60000, 40000], 30000);
  const rows = a.lines.map((line, i) => movement(line, String(i)));
  const records = [debt(50000), debt(70000)];
  const receipt = movementPaymentSummary(rows[0], rows, records);
  assert.equal(receipt.paidAmount, 30000);
  assert.equal(receipt.debtRemaining, 70000);
  assert.equal(receipt.customerTotalDebt, 120000);
  const afterPayment = movementPaymentSummary(rows[0], rows, [debt(50000), debt(50000)]);
  assert.equal(afterPayment.paidAmount, 30000); // Sale-time history must not change.
  assert.equal(afterPayment.customerTotalDebt, 100000);
});

test('discounts, zero payments, overpayments and allocation rounding conserve totals', () => {
  for (const [amounts, paid, discount] of [[[60000, 40000], 30000, 10000], [[100000], 0, 0], [[100000], 150000, 0], [[0], 0, 0], [[0.01, 0.02, 0.03], 0.02, 0.01]] as [number[], number, number][]) {
    const a = saleAccounting(amounts, paid, discount);
    assert.ok(Math.abs(a.lines.reduce((s, l) => s + l.revenue, 0) - a.total) < 1e-8);
    assert.ok(Math.abs(a.lines.reduce((s, l) => s + l.paid, 0) - a.paid) < 1e-8);
    assert.ok(a.lines.every(l => l.paid >= 0 && l.debt >= -1e-8));
    assert.ok(a.paid <= a.total);
  }
  assert.equal(saleAccounting([100000], 30000, 10000).remaining, 60000);
});

test('only the same named customer contributes to their balance', () => {
  assert.equal(customerDebtTotal([debt(50000, ' Akromjon '), debt(70000, 'AKROMJON'), debt(30000, 'Rustam'), debt(0)], 'akromjon'), 120000);
  assert.equal(customerDebtTotal([debt(10000, "Do'kon mijozi")], "Do'kon mijozi"), 0);
});

test('same names with different phone numbers remain separate customers', () => {
  const first = { ...debt(50000, 'Ali'), id: 'ali-1', customerPhone: '+998 90 111 11 11' };
  const second = { ...debt(70000, 'Ali'), id: 'ali-2', customerPhone: '+998 90 222 22 22' };
  assert.equal(customerDebtTotal([first, second], 'Ali', first.customerPhone), 50000);
  assert.equal(customerDebtTotal([first, second], 'Ali', second.customerPhone), 70000);
  assert.equal(groupDebtsByCustomer([first, second]).length, 2);
  assert.equal(debtPeriodReport([first, second], [], 0, Date.now()).length, 2);
});

test('legacy reprint uses initial payment, not later payments', () => {
  const row = movement(saleAccounting([100000], 0).lines[0], 'old');
  delete row.paidAmount;
  const d = { ...debt(50000), totalDebt: 100000, paidAmount: 50000, movementId: 'old', paymentHistory: [{ date: '2026-09-30T10:00:00Z', amount: 30000, method: 'naqd' as const }, { date: '2026-10-01T10:00:00Z', amount: 20000, method: 'naqd' as const }] };
  assert.equal(movementPaymentSummary(row, [row], [d]).paidAmount, 30000);
});

test('thermal receipt prints paid amount, new debt and total customer debt, escaping names', () => {
  const r: SaleReceiptData = { receiptNumber: 'TEST', date: '2026-09-30', customerName: '<Akrom>', paymentMethod: 'nasiya', items: [], subtotal: 100000, total: 100000, paidAmount: 30000, isDebt: true, debtRemaining: 70000, previousCustomerDebt: 50000, customerTotalDebt: 120000 };
  const html = thermalReceiptHtml(r, { name: 'Test', address: '', phone: '', accountantName: '' }, true);
  for (const label of ["Hozir to'langan", 'Bu savdodan qarz', 'Eski qarz', 'Umumiy qarzdorlik']) assert.ok(html.includes(label.replaceAll("'", '&#39;')));
  for (const n of [30000, 70000, 50000, 120000]) assert.ok(html.includes(n.toLocaleString('ru-RU')));
  assert.ok(html.includes('&lt;Akrom&gt;'));
});

test('1000 sale with 100 paid leaves 900 debt, and the next receipt prints it as old debt', () => {
  const first = saleAccounting([1000], 100);
  assert.equal(first.paid, 100);
  assert.equal(first.remaining, 900);
  const old = customerDebtTotal([debt(900)], 'Akromjon');
  assert.equal(old, 900);
  const second = saleAccounting([500], 0);
  const r: SaleReceiptData = { receiptNumber: 'T2', date: '2026-09-30', customerName: 'Akromjon', paymentMethod: 'nasiya', items: [], subtotal: 500, total: 500, paidAmount: 0, isDebt: true, debtRemaining: second.remaining, previousCustomerDebt: old, customerTotalDebt: old + second.remaining };
  const html = thermalReceiptHtml(r, { name: 'Test', address: '', phone: '', accountantName: '' }, true);
  for (const label of ['Eski qarz', 'Umumiy qarzdorlik']) assert.ok(html.includes(label));
  assert.ok(html.includes('1' + String.fromCharCode(160) + '400') || html.includes('1 400'));
});

test('overdue days, customer grouping and payment clamping', () => {
  const now = new Date('2026-10-20T12:00:00Z').getTime();
  const a = { ...debt(50000, 'Akromjon'), dueDate: '2026-10-10' };
  const b = { ...debt(30000, ' akromjon '), dueDate: '2026-10-25' };
  const c = { ...debt(70000, 'Rustam'), dueDate: '2026-10-30' };
  const closed = { ...debt(0, 'Akromjon'), status: 'yopildi' as const };
  assert.equal(debtOverdueDays(a, now), 10);
  assert.equal(debtOverdueDays(b, now), 0);
  assert.equal(debtOverdueDays(closed, now), 0);
  const groups = groupDebtsByCustomer([a, b, c, closed], now);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Akromjon');
  assert.equal(groups[0].remaining, 80000);
  assert.equal(groups[1].remaining, 70000);
  assert.equal(groups[0].activeCount, 2);
  assert.equal(groups[0].maxOverdueDays, 10);
  assert.equal(groups[0].nearestDue, '2026-10-10');
  assert.equal(clampDebtPayment(a, 999999), 50000);
  assert.equal(clampDebtPayment(a, -5), 0);
  assert.equal(clampDebtPayment(closed, 1000), 0);
});

test('debt period report lists items, date and remaining debt per customer inside the range only', () => {
  const sale = (id: string, name: string, qty: number, batch?: string): StockMovement => ({ ...movement(saleAccounting([10000], 0).lines[0], id), productName: name, quantity: qty, batchSaleId: batch });
  const movements = [sale('m1', 'Kabel', 2, 'b1'), sale('m2', 'Himoya oynasi', 1, 'b1'), sale('m3', 'Quvvatlagich', 1)];
  const rec = (id: string, name: string, createdAt: string, movementId: string, remaining: number, notes?: string): DebtRecord =>
    ({ ...debt(remaining, name), id, createdAt, movementId, totalDebt: 100000, paidAmount: 100000 - remaining, notes });
  const debts = [
    rec('d1', 'Akromjon', '2026-10-02T09:15:00', 'm1', 70000),
    rec('d2', ' akromjon ', '2026-10-04T18:40:00', 'm3', 30000),
    rec('d3', 'Akromjon', '2026-09-20T10:00:00', 'm3', 99000),
    rec('d4', "Do'kon mijozi", '2026-10-03T12:00:00', 'manual-1', 5000, 'Qo\'lda kiritilgan nasiya')
  ];
  const from = new Date('2026-10-01T00:00:00').getTime();
  const to = new Date('2026-10-05T23:59:59.999').getTime();
  const report = debtPeriodReport(debts, movements, from, to);

  assert.equal(report.length, 2);
  const akrom = report[0];
  assert.equal(akrom.name, 'Akromjon');
  assert.equal(akrom.rows.length, 2); // d3 is outside the range
  assert.equal(akrom.remaining, 100000);
  assert.equal(akrom.saleTotal, 200000);
  assert.equal(akrom.paid, 100000);
  assert.equal(akrom.returned, 0);
  assert.deepEqual(akrom.rows[0].itemLines, ['Kabel × 2', 'Himoya oynasi × 1']);
  assert.deepEqual(akrom.rows[1].itemLines, ['Quvvatlagich × 1']);
  assert.equal(akrom.rows[0].debt.createdAt, '2026-10-02T09:15:00');
  assert.deepEqual(report[1].rows[0].itemLines, ["Qo'lda kiritilgan nasiya"]);
  assert.equal(debtPeriodReport(debts, movements, to + 1, to + 2).length, 0);
});

test('debt period report separates cash payments from return reductions', () => {
  const row = {
    ...debt(40000, 'Dilshod'),
    id: 'return-split', totalDebt: 100000, paidAmount: 60000,
    paymentHistory: [
      { date: '2026-10-02T10:00:00Z', amount: 40000, method: 'naqd' as const },
      { date: '2026-10-03T10:00:00Z', amount: 20000, method: 'vazvrat' as const }
    ]
  };
  const [report] = debtPeriodReport([row], [], 0, Date.now());
  assert.equal(report.paid, 40000);
  assert.equal(report.returned, 20000);
  assert.equal(report.rows[0].paid, 40000);
  assert.equal(report.rows[0].returned, 20000);
});
