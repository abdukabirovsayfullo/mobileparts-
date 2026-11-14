import type { DebtRecord, StockMovement } from '../types';
import { currencyOf } from './money';
import { tashkentDate } from '../../server/expenseLogic';

/** Today's cash before expenses; refunds must reduce cash even for older sales. */
export function dailyCashFlow(movements: StockMovement[], debts: DebtRecord[], date = tashkentDate()) {
  let sales = 0, refunds = 0, debtPayments = 0;
  for (const m of movements) {
    if (currencyOf(m) !== 'UZS' || m.paymentMethod !== 'naqd' || tashkentDate(m.timestamp) !== date) continue;
    if (m.type === 'chiqim') sales += m.totalRevenue;
    if (m.type === 'vazvrat') refunds += m.totalRevenue;
  }
  for (const d of debts) {
    if (currencyOf(d) !== 'UZS') continue;
    for (const p of d.paymentHistory || []) {
      if (p.method === 'naqd' && tashkentDate(p.date) === date) debtPayments += p.amount;
    }
  }
  return { sales, refunds, debtPayments, netCash: sales + debtPayments - refunds };
}
