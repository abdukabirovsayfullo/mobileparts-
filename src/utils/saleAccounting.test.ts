import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerDebtTotal, saleAccounting, movementPaymentSummary } from './saleAccounting';
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

test('legacy reprint uses initial payment, not later payments', () => {
  const row = movement(saleAccounting([100000], 0).lines[0], 'old');
  delete row.paidAmount;
  const d = { ...debt(50000), totalDebt: 100000, paidAmount: 50000, movementId: 'old', paymentHistory: [{ date: '2026-09-30T10:00:00Z', amount: 30000, method: 'naqd' as const }, { date: '2026-10-01T10:00:00Z', amount: 20000, method: 'naqd' as const }] };
  assert.equal(movementPaymentSummary(row, [row], [d]).paidAmount, 30000);
});

test('thermal receipt prints paid amount, new debt and total customer debt, escaping names', () => {
  const r: SaleReceiptData = { receiptNumber: 'TEST', date: '2026-09-30', customerName: '<Akrom>', paymentMethod: 'nasiya', items: [], subtotal: 100000, total: 100000, paidAmount: 30000, isDebt: true, debtRemaining: 70000, previousCustomerDebt: 50000, customerTotalDebt: 120000 };
  const html = thermalReceiptHtml(r, { name: 'Test', address: '', phone: '', accountantName: '' }, true);
  for (const label of ["Hozir to'langan", 'Bu savdodan qarz', 'Avvalgi qarz', 'Jami qarzdorlik']) assert.ok(html.includes(label.replaceAll("'", '&#39;')));
  for (const n of [30000, 70000, 50000, 120000]) assert.ok(html.includes(n.toLocaleString('ru-RU')));
  assert.ok(html.includes('&lt;Akrom&gt;'));
});
