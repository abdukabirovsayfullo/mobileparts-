import type { DebtRecord, StockMovement } from '../types';

/** A payment or sync may change balances, never the owner of an existing debt. */
export function protectDebtOwnership(incoming: DebtRecord[], existing: DebtRecord[], movements: StockMovement[]) {
  const known = new Map(existing.map(d => [d.id, d]));
  const sales = new Map(movements.filter(m => m.type === 'chiqim').map(m => [m.id, m]));
  return incoming.map(d => {
    const prior = known.get(d.id);
    // Rahbar tahriri (tarixga "tahrir" yozuvi qo'shilgan) ism/telefonni o'zgartira oladi; savdo bog'lanishi va valyuta o'zgarmaydi.
    const audited = (d.auditLog?.length || 0) > (prior?.auditLog?.length || 0) && d.auditLog?.at(-1)?.action === 'tahrir';
    if (prior && audited) return { ...d, movementId: prior.movementId, currency: prior.currency };
    if (prior) return { ...d, customerName: prior.customerName, customerPhone: prior.customerPhone, movementId: prior.movementId, currency: prior.currency };
    const sale = d.movementId ? sales.get(d.movementId) : undefined;
    return sale ? { ...d, customerName: sale.counterparty, customerPhone: sale.customerPhone || '', currency: sale.currency } : d;
  });
}
