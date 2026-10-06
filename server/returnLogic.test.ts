import assert from 'node:assert/strict';
import test from 'node:test';
import type { DebtRecord, StockMovement } from '../src/types';
import { applyRefundToDebts, daysAgo, isWithinWorkerWindow, refundAmount, returnableQuantity, summarizeReturns } from './returnLogic';

const base = { productId: 'p1', productName: 'Oyna', category: 'Oyna', unitCost: 10_000, totalCost: 0, profit: 0, counterparty: 'Ali Valiyev' };
const sale = (over: Partial<StockMovement> = {}): StockMovement => ({
  ...base, id: 's1', type: 'chiqim', quantity: 3, unitPrice: 35_000, totalRevenue: 90_000, // 105 000 − 15 000 chegirma
  timestamp: '2026-10-02T08:00:00.000Z', employeeId: 'w1', employeeName: 'Ishchi', paymentMethod: 'naqd', ...over
});
const ret = (over: Partial<StockMovement> = {}): StockMovement => ({
  ...sale(), id: crypto.randomUUID(), type: 'vazvrat', isReturn: true, quantity: 1, totalRevenue: 30_000, originalMovementId: 's1', batchSaleId: crypto.randomUUID(), ...over
});

test('7 kunlik oyna: 7 kun oldingi ruxsat, 8 kun oldingi yo‘q (Toshkent kuni bo‘yicha)', () => {
  assert.equal(daysAgo('2026-10-02T08:00:00.000Z', '2026-10-09'), 7);
  assert.equal(isWithinWorkerWindow('2026-10-02T08:00:00.000Z', '2026-10-09'), true);
  assert.equal(isWithinWorkerWindow('2026-10-02T08:00:00.000Z', '2026-10-10'), false);
  // 19:30 UTC = Toshkentda keyingi kun 00:30
  assert.equal(daysAgo('2026-10-02T19:30:00.000Z', '2026-10-03'), 0);
});

test('qisman qaytarishlar ketma-ket hisoblanadi va sotilgandan oshmaydi', () => {
  const original = sale();
  assert.equal(returnableQuantity(original, [original]), 3);
  assert.equal(returnableQuantity(original, [original, ret()]), 2);
  assert.equal(returnableQuantity(original, [original, ret(), ret({ quantity: 2, totalRevenue: 60_000 })]), 0);
  assert.equal(returnableQuantity(original, [original, ret({ originalMovementId: 'boshqa' })]), 3);
});

test('qaytariladigan summa chegirmadan keyingi haqiqiy tushumdan proporsional olinadi', () => {
  assert.equal(refundAmount(sale(), 1), 30_000);
  assert.equal(refundAmount(sale(), 3), 90_000);
  assert.equal(refundAmount(sale({ quantity: 3, totalRevenue: 100_000 }), 1), 33_333);
});

const debt = (id: string, createdAt: string, remaining: number, name = 'Ali Valiyev'): DebtRecord => ({
  id, customerName: name, customerPhone: '+998', totalDebt: remaining, paidAmount: 0, remainingAmount: remaining, dueDate: '2026-11-01', createdAt, status: 'faol', paymentHistory: []
});

test('nasiyaga qaytarish eng eski qarzdan ayiradi, ism katta-kichik harfga e’tiborsiz, boshqa mijozga tegmaydi', () => {
  const debts = [debt('new', '2026-09-20T00:00:00Z', 40_000), debt('old', '2026-09-01T00:00:00Z', 20_000), debt('other', '2026-09-02T00:00:00Z', 50_000, 'Vali')];
  const result = applyRefundToDebts(debts, '  ali  VALIYEV ', undefined, 30_000, 'VZV-1', '2026-10-02T10:00:00Z', { id: 'w1', name: 'Ishchi' });
  const byId = Object.fromEntries(result.debts.map(item => [item.id, item]));
  assert.equal(result.applied, 30_000);
  assert.equal(byId.old.remainingAmount, 0);
  assert.equal(byId.old.status, 'yopildi');
  assert.equal(byId.new.remainingAmount, 30_000);
  assert.equal(byId.new.status, 'qisman_tolandi');
  assert.equal(byId.other.remainingAmount, 50_000);
  assert.equal(byId.old.paymentHistory?.[0].method, 'vazvrat');
  assert.equal(applyRefundToDebts(debts, 'Noma\'lum', undefined, 10_000, 'VZV-2', '2026-10-02T10:00:00Z', {}).applied, 0);
});

test('bir xil ismli mijozlarning nasiyasi telefon bo‘yicha ajratiladi', () => {
  const first = { ...debt('ali-1', '2026-09-01T00:00:00Z', 50_000, 'Ali'), customerPhone: '+998 90 111 11 11' };
  const second = { ...debt('ali-2', '2026-09-01T00:00:00Z', 70_000, 'Ali'), customerPhone: '+998 90 222 22 22' };
  const result = applyRefundToDebts([first, second], 'Ali', first.customerPhone, 20_000, 'VZV-PHONE', '2026-10-02T10:00:00Z', {});
  assert.equal(result.debts.find(item => item.id === 'ali-1')?.remainingAmount, 30_000);
  assert.equal(result.debts.find(item => item.id === 'ali-2')?.remainingAmount, 70_000);
});

test('Rahbar nazorati: ko‘p yoki katta qaytarishlar belgilanadi, kam bo‘lsa belgilanmaydi', () => {
  const rows = summarizeReturns([
    ret({ employeeId: 'a', employeeName: 'A' }), ret({ employeeId: 'a', employeeName: 'A' }), ret({ employeeId: 'a', employeeName: 'A' }),
    ret({ employeeId: 'b', employeeName: 'B', totalRevenue: 600_000 }),
    ret({ employeeId: 'c', employeeName: 'C' }),
    ret({ employeeId: 'd', employeeName: 'D', timestamp: '2026-09-20T08:00:00.000Z' })
  ], '2026-10-02', { count: 3, amount: 500_000 });
  const byId = Object.fromEntries(rows.map(row => [row.employeeId, row]));
  assert.equal(byId.a.flagged, true);
  assert.equal(byId.a.todayCount, 3);
  assert.equal(byId.b.flagged, true);
  assert.equal(byId.c.flagged, false);
  assert.equal(byId.d, undefined);
  assert.equal(rows[0].flagged, true);
});
