import assert from 'node:assert/strict';
import test from 'node:test';
import type { CashExpense, DebtRecord, StockMovement } from '../src/types';
import { calculateShiftTotals } from './shiftLogic';

const sale = (paymentMethod: StockMovement['paymentMethod'], totalRevenue: number): StockMovement => ({
  id: crypto.randomUUID(), type: 'chiqim', productId: 'p', productName: 'Tovar', category: 'Test', quantity: 1,
  unitCost: 0, unitPrice: totalRevenue, totalCost: 0, totalRevenue, profit: 0,
  timestamp: '2026-10-02T08:00:00.000Z', paymentMethod, counterparty: 'Mijoz', employeeId: 'w1', employeeName: 'Ishchi'
});
const expense: CashExpense = { id: 'e1', occurredAt: '2026-10-02T09:00:00.000Z', recipient: 'Usta', amount: 20_000, reason: 'Transport', category: 'transport', createdById: 'w1', createdByName: 'Ishchi' };

test('naqd, Click, Uzum, nasiya va chiqim alohida hisoblanadi', () => {
  const totals = calculateShiftTotals([sale('naqd', 100_000), sale('click_payme', 40_000), sale('uzum', 30_000), sale('nasiya', 50_000)], [expense], 'w1', '2026-10-02', 10_000);
  assert.deepEqual(totals, { cashRevenue: 100_000, clickRevenue: 40_000, uzumRevenue: 30_000, debtRevenue: 50_000, debtCashReceived: 0, refundTotal: 0, expenseTotal: 20_000, expectedCash: 90_000 });
  assert.equal(85_000 - totals.expectedCash, -5_000);
});

test('naqd qaytarish kassadan ayriladi, naqd nasiya to‘lovi qo‘shiladi; boshqa xodim va boshqa kun hisobga kirmaydi', () => {
  const refund = (method: StockMovement['paymentMethod'], amount: number, employeeId = 'w1', timestamp = '2026-10-02T10:00:00.000Z'): StockMovement =>
    ({ ...sale(method, amount), type: 'vazvrat', isReturn: true, employeeId, timestamp });
  const debt = (payments: NonNullable<DebtRecord['paymentHistory']>): DebtRecord => ({
    id: 'd1', customerName: 'Mijoz', customerPhone: '+998', totalDebt: 500_000, paidAmount: 0, remainingAmount: 500_000, dueDate: '2026-10-20', createdAt: '2026-09-01T00:00:00.000Z', status: 'faol', paymentHistory: payments
  });
  const totals = calculateShiftTotals(
    [sale('naqd', 100_000), refund('naqd', 30_000), refund('click_payme', 10_000), refund('naqd', 99_000, 'w2'), refund('naqd', 77_000, 'w1', '2026-10-01T10:00:00.000Z')],
    [expense], 'w1', '2026-10-02', 10_000,
    [debt([
      { date: '2026-10-02T11:00:00.000Z', amount: 25_000, method: 'naqd', employeeId: 'w1' },
      { date: '2026-10-02T11:30:00.000Z', amount: 5_000, method: 'click_payme', employeeId: 'w1' },
      { date: '2026-10-02T12:00:00.000Z', amount: 9_000, method: 'naqd', employeeId: 'w2' },
      { date: '2026-10-02T13:00:00.000Z', amount: 4_000, method: 'vazvrat', employeeId: 'w1' }
    ])]
  );
  assert.equal(totals.refundTotal, 30_000);
  assert.equal(totals.debtCashReceived, 25_000);
  // 10 000 ochilish + 100 000 naqd savdo + 25 000 nasiya − 30 000 qaytarish − 20 000 chiqim
  assert.equal(totals.expectedCash, 85_000);
});
