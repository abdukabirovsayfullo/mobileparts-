import { debtCustomerError } from './checkoutCustomer';
import type { DebtRecord, StockMovement } from '../types';

/** A payment or sync may change balances, never the owner of an existing debt. */
export function protectDebtOwnership(incoming: DebtRecord[], existing: DebtRecord[], movements: StockMovement[]) {
  const known = new Map(existing.map(d => [d.id, d]));
  const sales = new Map(movements.filter(m => m.type === 'chiqim').map(m => [m.id, m]));
  return incoming.map(d => {
    const prior = known.get(d.id);
    if (prior) return { ...d, customerName: prior.customerName, customerPhone: prior.customerPhone, movementId: prior.movementId, currency: prior.currency };
    const sale = d.movementId ? sales.get(d.movementId) : undefined;
    const result = sale ? { ...d, customerName: sale.counterparty, customerPhone: sale.customerPhone || '', currency: sale.currency } : d;
    if (result.remainingAmount > 0) {
      const error = debtCustomerError(result.customerName, result.customerPhone);
      if (error) throw new Error(error);
    }
    return result;
  });
}
