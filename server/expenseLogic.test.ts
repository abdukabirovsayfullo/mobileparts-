import assert from 'node:assert/strict';
import test from 'node:test';
import type { CashExpense } from '../src/types';
import { activeExpensesForDate, expenseTotal, tashkentDate } from './expenseLogic';

const expense = (id: string, amount: number, occurredAt: string, cancelled = false): CashExpense => ({
  id, amount, occurredAt, recipient: 'Test', reason: 'Test chiqim', category: 'boshqa',
  createdById: 'worker-1', createdByName: 'Ishchi',
  ...(cancelled ? { cancelledAt: '2026-10-02T14:00:00.000Z', cancellationReason: 'Xato yozildi' } : {})
});

test('uchta chiqimdan bekor qilingani kassa hisobiga kirmaydi', () => {
  const items = [
    expense('1', 10_000, '2026-10-02T05:00:00.000Z'),
    expense('2', 20_000, '2026-10-02T06:00:00.000Z', true),
    expense('3', 30_000, '2026-10-02T07:00:00.000Z')
  ];
  assert.equal(expenseTotal(activeExpensesForDate(items, '2026-10-02')), 40_000);
});

test('sana chegarasi Asia/Tashkent bo‘yicha hisoblanadi', () => {
  assert.equal(tashkentDate('2026-10-01T18:59:59.000Z'), '2026-10-01');
  assert.equal(tashkentDate('2026-10-01T19:00:00.000Z'), '2026-10-02');
});
