import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyCashFlow } from './cashFlow';
import type { StockMovement, DebtRecord } from '../types';

test('cash refunds reduce balance, card/debt/USD refunds do not; negative cash is visible', () => {
  const row = (type: string, amount: number, paymentMethod = 'naqd', currency = 'UZS', timestamp = '2026-11-14T10:00:00Z') => ({ type, totalRevenue: amount, paymentMethod, currency, timestamp } as StockMovement);
  const movements = [row('chiqim', 10000), row('vazvrat', 20000), row('vazvrat', 9000, 'nasiya'), row('vazvrat', 6500, 'click_payme'), row('vazvrat', 200, 'naqd', 'USD'), row('vazvrat', 100, 'naqd', 'UZS', '2026-11-13T10:00:00Z')];
  const debts = [{ paymentHistory: [{ amount: 3200, method: 'naqd', date: '2026-11-14T10:00:00Z' }, { amount: 9500, method: 'vazvrat', date: '2026-11-14T10:00:00Z' }] } as DebtRecord];
  assert.deepEqual(dailyCashFlow(movements, debts, '2026-11-14'), { sales: 10000, refunds: 20000, debtPayments: 3200, netCash: -6800 });
});
