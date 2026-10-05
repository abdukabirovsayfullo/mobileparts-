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

const DAY_MS = 86400000;

/** Muddati o'tgan kunlar soni (muddati o'tmagan yoki yopilgan qarz uchun 0). */
export function debtOverdueDays(debt: DebtRecord, now = Date.now()): number {
  if (debt.status === 'yopildi') return 0;
  const due = new Date(debt.dueDate).getTime();
  if (isNaN(due)) return 0;
  return Math.max(0, Math.floor((now - due) / DAY_MS));
}

export interface CustomerDebtSummary {
  key: string;
  name: string;
  phone: string;
  remaining: number;
  paid: number;
  activeCount: number;
  maxOverdueDays: number;
  nearestDue: string;
}

/** Faol qarzlarni mijoz bo'yicha jamlaydi (eng katta qarz birinchi). "Do'kon mijozi" alohida qatorlarda qoladi. */
export function groupDebtsByCustomer(debts: DebtRecord[], now = Date.now()): CustomerDebtSummary[] {
  const anonymous = cleanName("Do'kon mijozi");
  const map = new Map<string, CustomerDebtSummary>();
  for (const d of debts) {
    if (d.status === 'yopildi' || d.remainingAmount <= 0) continue;
    const name = cleanName(d.customerName);
    const key = !name || name === anonymous ? `id:${d.id}` : name;
    const overdue = debtOverdueDays(d, now);
    const current = map.get(key);
    if (!current) {
      map.set(key, { key, name: d.customerName.trim(), phone: d.customerPhone, remaining: d.remainingAmount, paid: d.paidAmount, activeCount: 1, maxOverdueDays: overdue, nearestDue: d.dueDate });
    } else {
      current.remaining += d.remainingAmount;
      current.paid += d.paidAmount;
      current.activeCount += 1;
      current.maxOverdueDays = Math.max(current.maxOverdueDays, overdue);
      if (d.dueDate && (!current.nearestDue || d.dueDate < current.nearestDue)) current.nearestDue = d.dueDate;
      if (!current.phone && d.customerPhone) current.phone = d.customerPhone;
    }
  }
  return [...map.values()].sort((a, b) => b.remaining - a.remaining);
}

/** To'lovni qoldiq bilan cheklaydi: ortiqcha to'lov va manfiy summa qabul qilinmaydi. */
export function clampDebtPayment(debt: DebtRecord, amount: number): number {
  if (debt.status === 'yopildi' || !(amount > 0)) return 0;
  return Math.min(amount, Math.max(0, debt.remainingAmount));
}

export interface PeriodDebtRow {
  debt: DebtRecord;
  /** "Tovar × soni" qatorlari; sotuv topilmasa nasiya izohi. */
  itemLines: string[];
}

export interface PeriodCustomerReport {
  key: string;
  name: string;
  phone: string;
  rows: PeriodDebtRow[];
  saleTotal: number;
  paid: number;
  remaining: number;
}

/** [fromMs, toMs] oralig'ida (ikkala chegara kiradi) yozilgan nasiyalar: mijoz bo'yicha, olingan tovarlari bilan. Eng katta qoldiq birinchi. */
export function debtPeriodReport(debts: DebtRecord[], movements: StockMovement[], fromMs: number, toMs: number): PeriodCustomerReport[] {
  const anonymous = cleanName("Do'kon mijozi");
  const groups = new Map<string, PeriodCustomerReport>();
  for (const d of debts) {
    const created = new Date(d.createdAt).getTime();
    if (isNaN(created) || created < fromMs || created > toMs) continue;

    const sale = movements.find(m => m.id === d.movementId);
    const related = sale ? (sale.batchSaleId ? movements.filter(m => m.batchSaleId === sale.batchSaleId) : [sale]) : [];
    const itemLines = related.filter(m => m.type === 'chiqim' && !m.isReturn).map(m => `${m.productName} × ${m.quantity}`);
    if (!itemLines.length && d.notes) itemLines.push(d.notes);

    const name = cleanName(d.customerName);
    const key = !name || name === anonymous ? `id:${d.id}` : name;
    let group = groups.get(key);
    if (!group) {
      group = { key, name: d.customerName.trim(), phone: d.customerPhone, rows: [], saleTotal: 0, paid: 0, remaining: 0 };
      groups.set(key, group);
    }
    group.rows.push({ debt: d, itemLines });
    group.saleTotal += d.totalDebt;
    group.paid += d.paidAmount;
    group.remaining += d.remainingAmount;
    if (!group.phone && d.customerPhone) group.phone = d.customerPhone;
  }
  const result = [...groups.values()];
  for (const g of result) g.rows.sort((a, b) => a.debt.createdAt.localeCompare(b.debt.createdAt));
  return result.sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
}