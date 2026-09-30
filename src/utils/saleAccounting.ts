import { DebtRecord, StockMovement } from '../types';

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function customerDebtTotal(debts: DebtRecord[], name: string): number {
  const key = cleanName(name);
  if (!key || key === cleanName("Do'kon mijozi")) return 0;
  return debts.filter(d => cleanName(d.customerName) === key && d.status !== 'yopildi')
    .reduce((sum, d) => sum + Math.max(0, d.remainingAmount), 0);
}

export function saleAccounting(amounts: number[], paidNow: number, discount = 0) {
  const subtotal = amounts.reduce((s, n) => s + n, 0);
  const total = Math.max(0, subtotal - Math.min(subtotal, Math.max(0, discount)));
  const paid = Math.min(total, Math.max(0, paidNow));
  // Allocate rounded amounts, leaving the exact remainder on the last line.
  let revenueLeft = total;
  let paidLeft = paid;
  const lines = amounts.map((amount, index) => {
    const last = index === amounts.length - 1;
    const revenue = last ? revenueLeft : Math.min(revenueLeft, Math.round((subtotal ? total * amount / subtotal : 0) * 100) / 100);
    const linePaid = last ? paidLeft : Math.min(paidLeft, revenue, Math.round((total ? paid * revenue / total : 0) * 100) / 100);
    revenueLeft -= revenue;
    paidLeft -= linePaid;
    return { revenue, paid: linePaid, debt: revenue - linePaid, discount: amount - revenue };
  });
  return { subtotal, total, paid, remaining: total - paid, lines };
}

export function movementPaymentSummary(m: StockMovement, related: StockMovement[], debts: DebtRecord[]) {
  const total = related.reduce((sum, row) => sum + row.totalRevenue, 0);
  const debt = debts.find(d => related.some(row => row.id === d.movementId));
  // Old sales lack payment metadata: only a payment recorded at sale time is an initial payment.
  const initialPaid = debt?.paymentHistory?.filter(p => p.date === debt.createdAt).reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const paidAmount = related.every(row => row.paidAmount !== undefined)
    ? related.reduce((sum, row) => sum + (row.paidAmount || 0), 0)
    : m.paymentMethod === 'nasiya' ? initialPaid : total;
  const remaining = Math.max(0, total - paidAmount);
  const currentDebt = customerDebtTotal(debts, m.counterparty);
  return {
    paidAmount, debtRemaining: remaining, isDebt: remaining > 0,
    previousCustomerDebt: m.previousCustomerDebt,
    customerTotalDebt: cleanName(m.counterparty) === cleanName("Do'kon mijozi")
      ? (debt?.remainingAmount ?? m.customerTotalDebt ?? remaining) : currentDebt,
    debtDueDate: m.debtDueDate || debt?.dueDate
  };
}
