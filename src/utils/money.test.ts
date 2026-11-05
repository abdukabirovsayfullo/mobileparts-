import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currencyOf, roundMoney, sumByCurrency } from './money';
import { formatMoney } from './formatters';
import { customerDebtTotal, groupDebtsByCustomer, saleAccounting } from './saleAccounting';
import type { DebtRecord } from '../types';

const debt = (id: string, remaining: number, currency?: 'USD'): DebtRecord => ({
  id, customerName: 'Akmal', customerPhone: '+998 90 111 22 33', totalDebt: remaining, paidAmount: 0, remainingAmount: remaining,
  dueDate: '2026-10-12', createdAt: '2026-10-02T10:00:00', status: 'faol', ...(currency ? { currency } : {})
});

test('currency helpers: eski yozuvlar so‘m, yaxlitlash va yig‘indilar valyutaga bo‘lingan', () => {
  assert.equal(currencyOf({}), 'UZS');
  assert.equal(currencyOf(undefined), 'UZS');
  assert.equal(currencyOf({ currency: 'USD' }), 'USD');
  assert.equal(roundMoney(0.1 + 0.2, 'USD'), 0.3);
  assert.equal(roundMoney(1234.567, 'UZS'), 1235);
  assert.deepEqual(sumByCurrency([{ v: 100 }, { v: 4.5, currency: 'USD' as const }, { v: 0.5, currency: 'USD' as const }], (i) => i.v), { UZS: 100, USD: 5 });
});

test('formatMoney dollarni $ bilan, so‘mni so‘m bilan ko‘rsatadi', () => {
  assert.equal(formatMoney(15, 'USD'), '$15');
  assert.equal(formatMoney(4.5, 'USD'), '$4.50');
  assert.equal(formatMoney(1234.5, 'USD'), '$1 234.50');
  assert.equal(formatMoney(15000).replace(/\s/g, ' '), "15 000 so'm");
});

test('nasiya va savdo hisobi: dollar va so‘m qarzlari alohida yuritiladi', () => {
  const debts = [debt('a', 50000), debt('b', 12.5, 'USD'), debt('c', 7.25, 'USD')];
  assert.equal(customerDebtTotal(debts, 'Akmal', '+998 90 111 22 33'), 50000);
  assert.equal(customerDebtTotal(debts, 'Akmal', '+998 90 111 22 33', 'USD'), 19.75);
  const groups = groupDebtsByCustomer(debts);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(g => [g.currency, g.remaining]), [['UZS', 50000], ['USD', 19.75]]);
  const accounting = saleAccounting([4.5 * 3, 2.2], 5, 0.5, 'USD');
  assert.equal(accounting.total, 15.2);
  assert.equal(accounting.paid, 5);
  assert.equal(accounting.remaining, 10.2);
  assert.equal(accounting.lines.reduce((s, l) => s + l.revenue, 0).toFixed(2), '15.20');
});
