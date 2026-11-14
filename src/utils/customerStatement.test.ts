import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DebtRecord, StockMovement } from '../types';
import { buildCustomerStatement } from './customerStatement';

test("buildCustomerStatement: kun bo'yicha xaridlar, davrdagi to'lovlar, umumiy qarz", () => {
  const mv = (o: Partial<StockMovement>): StockMovement => ({ id: 'x', type: 'chiqim', productId: 'p', productName: 'T', category: 'EKRAN', quantity: 1, unitCost: 0, unitPrice: 0, totalCost: 0, totalRevenue: 0, profit: 0, timestamp: '2026-11-10T06:00:00Z', ...o } as StockMovement);
  const movements = [
    mv({ id: 'm1', batchSaleId: 'b1', productName: 'SAMSUNG A05 EKB', quantity: 2, unitPrice: 75000, totalRevenue: 150000 }),
    mv({ id: 'm2', batchSaleId: 'b1', productName: 'Kabel', quantity: 1, unitPrice: 20000, totalRevenue: 20000 }),
    mv({ id: 'm3', productName: 'REDMI 9A LCD PRO', quantity: 1, unitPrice: 80000, totalRevenue: 80000, timestamp: '2026-11-12T08:00:00Z' })
  ];
  const d = (o: Partial<DebtRecord>): DebtRecord => ({ id: 'd', customerName: 'Nurullo aka', customerPhone: '+998905554433', totalDebt: 0, paidAmount: 0, remainingAmount: 0, dueDate: '', createdAt: '', status: 'faol', ...o });
  const debts = [
    // To'lov ichkarida eski nasiyani yopgan — hisobda bu ko'rinmaydi, faqat umumiy qarz
    d({ id: 'a', movementId: 'm1', totalDebt: 170000, paidAmount: 170000, remainingAmount: 0, status: 'yopildi', createdAt: '2026-11-10T06:00:00Z',
      paymentHistory: [{ date: '2026-11-13T10:00:00Z', amount: 170000, method: 'naqd', employeeName: 'Akmal' }] }),
    d({ id: 'b', movementId: 'm3', totalDebt: 80000, paidAmount: 30000, remainingAmount: 50000, status: 'qisman_tolandi', createdAt: '2026-11-12T08:00:00Z',
      paymentHistory: [{ date: '2026-11-13T10:00:03Z', amount: 30000, method: 'naqd', employeeName: 'Akmal' }] }),
    d({ id: 'c', totalDebt: 40000, remainingAmount: 40000, createdAt: '2026-11-14T09:00:00Z', notes: '1 ta bron oyna' }),
    d({ id: 'x', totalDebt: 99999, remainingAmount: 0, status: 'yopildi', cancelledAt: '2026-11-14T10:00:00Z', createdAt: '2026-11-11T09:00:00Z' }),
    d({ id: 'o', customerName: 'Omadillo', totalDebt: 5000, remainingAmount: 5000, createdAt: '2026-11-12T09:00:00Z' })
  ];
  const all = buildCustomerStatement(debts, movements, 'Nurullo aka', '+998 90 555 44 33', 'UZS');
  assert.deepEqual(all.days.map((x) => [x.day, x.total]), [['2026-11-10', 170000], ['2026-11-12', 80000], ['2026-11-14', 40000]]);
  assert.deepEqual(all.days[0].purchases[0].items.map((i) => [i.name, i.quantity, i.total]), [['SAMSUNG A05 EKB', 2, 150000], ['Kabel', 1, 20000]]);
  assert.equal(all.days[2].purchases[0].note, '1 ta bron oyna');
  assert.deepEqual(all.payments.map((p) => p.amount), [200000]); // bir to'lov — ikki nasiyaga bo'lingan bo'lsa ham bitta
  assert.deepEqual(all.period, { purchases: 290000, payments: 200000, returns: 0 });
  assert.equal(all.currentDebt, 90000);

  const part = buildCustomerStatement(debts, movements, 'Nurullo aka', '+998 90 555 44 33', 'UZS', '2026-11-11', '2026-11-12');
  assert.deepEqual(part.days.map((x) => x.day), ['2026-11-12']);
  assert.equal(part.payments.length, 0);
  assert.equal(part.currentDebt, 90000); // umumiy qarz davrdan qat'i nazar
});
