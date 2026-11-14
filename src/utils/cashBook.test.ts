import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCashBook } from './cashBook';
import type { DebtRecord, StockMovement } from '../types';

const DAY = '2026-11-14';
const at = (hhmm: string, day = DAY) => new Date(`${day}T${hhmm}:00+05:00`).toISOString();

const mv = (over: Partial<StockMovement>): StockMovement => ({
  id: Math.random().toString(36).slice(2), productId: 'p', productName: 'Kabel', category: 'Kabellar', type: 'chiqim',
  quantity: 1, unitCost: 5000, unitPrice: 10000, totalCost: 5000, totalRevenue: 10000, profit: 5000,
  counterparty: 'Ali', paymentMethod: 'naqd', timestamp: at('10:00'), ...over
} as StockMovement);

test('cash refunds are subtracted from the cash book', () => {
  const book = buildCashBook([
    mv({ totalRevenue: 30000 }),
    mv({ type: 'vazvrat', totalRevenue: 12000, timestamp: at('12:00') })
  ], [], DAY);
  assert.equal(book.salesTotal, 30000);
  assert.equal(book.refundTotal, 12000);
  assert.equal(book.netCash, 18000);
});

test('one receipt with several products is one sale line', () => {
  const book = buildCashBook([
    mv({ batchSaleId: 'b1', receiptNumber: 'CHK-1', productName: 'Kabel', quantity: 2, totalRevenue: 20000, timestamp: at('09:15') }),
    mv({ batchSaleId: 'b1', receiptNumber: 'CHK-1', productName: 'Quloqchin', totalRevenue: 50000, timestamp: at('09:15') })
  ], [], DAY);
  assert.equal(book.salesCount, 1);
  const [sale] = book.entries;
  assert.equal(sale.amount, 70000);
  assert.equal(sale.itemsLabel, 'Kabel ×2, Quloqchin');
  assert.equal(sale.receiptNumber, 'CHK-1');
});

test('non-cash, dollar and other-day movements are excluded', () => {
  const book = buildCashBook([
    mv({ paymentMethod: 'click_payme' }),
    mv({ paymentMethod: 'nasiya' }),
    mv({ currency: 'USD', totalRevenue: 20 }),
    mv({ timestamp: at('10:00', '2026-11-13') }),
    mv({ type: 'vazvrat', paymentMethod: 'nasiya' }),
    mv({ totalRevenue: 7000 })
  ], [], DAY);
  assert.equal(book.salesTotal, 7000);
  assert.equal(book.refundTotal, 0);
  assert.equal(book.entries.length, 1);
});

test('cash debt payments are added, return deductions are not', () => {
  const debt: DebtRecord = {
    id: 'd1', customerName: 'Nurullo', customerPhone: '', totalDebt: 100000, paidAmount: 60000, remainingAmount: 40000,
    dueDate: DAY, createdAt: at('08:00', '2026-11-01'), status: 'qisman_tolandi',
    paymentHistory: [
      { date: at('11:00'), amount: 50000, method: 'naqd' },
      { date: at('11:30'), amount: 10000, method: 'vazvrat' },
      { date: at('11:00', '2026-11-10'), amount: 5000, method: 'naqd' }
    ]
  };
  const book = buildCashBook([mv({ totalRevenue: 10000 })], [debt], DAY);
  assert.equal(book.debtCashTotal, 50000);
  assert.equal(book.netCash, 60000);
});

test('entries are newest first', () => {
  const book = buildCashBook([
    mv({ receiptNumber: 'A', timestamp: at('09:00') }),
    mv({ receiptNumber: 'B', timestamp: at('15:00') })
  ], [], DAY);
  assert.deepEqual(book.entries.map((e) => e.receiptNumber), ['B', 'A']);
});
