import assert from 'node:assert/strict';
import test from 'node:test';
import type { CashExpense, StockMovement } from '../src/types';
import { calculateShiftTotals } from './shiftLogic';

const sale = (paymentMethod: StockMovement['paymentMethod'], totalRevenue: number): StockMovement => ({
  id: crypto.randomUUID(), type: 'chiqim', productId: 'p', productName: 'Tovar', category: 'Test', quantity: 1,
  unitCost: 0, unitPrice: totalRevenue, totalCost: 0, totalRevenue, profit: 0,
  timestamp: '2026-10-02T08:00:00.000Z', paymentMethod, counterparty: 'Mijoz', employeeId: 'w1', employeeName: 'Ishchi'
});
const expense: CashExpense = { id: 'e1', occurredAt: '2026-10-02T09:00:00.000Z', recipient: 'Usta', amount: 20_000, reason: 'Transport', category: 'transport', createdById: 'w1', createdByName: 'Ishchi' };

test('naqd, Click, Uzum, nasiya va chiqim alohida hisoblanadi', () => {
  const totals = calculateShiftTotals([sale('naqd', 100_000), sale('click_payme', 40_000), sale('uzum', 30_000), sale('nasiya', 50_000)], [expense], 'w1', '2026-10-02', 10_000);
  assert.deepEqual(totals, { cashRevenue: 100_000, clickRevenue: 40_000, uzumRevenue: 30_000, debtRevenue: 50_000, expenseTotal: 20_000, expectedCash: 90_000 });
  assert.equal(85_000 - totals.expectedCash, -5_000);
});
