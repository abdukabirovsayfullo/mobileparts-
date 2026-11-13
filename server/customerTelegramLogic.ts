import type { CustomerProfile, DebtRecord, StockMovement } from '../src/types';
import { currencyOf } from '../src/utils/money';

const DAY = 86400000;
export const hashIdentity = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const phone = (value = '') => value.replace(/\D/g, '').slice(-9);

export function debtsForCustomer(customer: CustomerProfile, customers: CustomerProfile[], debts: DebtRecord[]) {
  return debts.filter(debt => {
    const a = phone(customer.phone), b = phone(debt.customerPhone);
    if (a.length === 9 && b.length === 9) return a === b;
    return hashIdentity(debt.customerName) === hashIdentity(customer.name) &&
      customers.filter(c => hashIdentity(c.name) === hashIdentity(customer.name)).length === 1;
  });
}

export function lastSunday(now: number, hour: number) {
  const local = new Date(now + 5 * 3600000);
  const cutoff = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour - 5);
  const sunday = cutoff - local.getUTCDay() * DAY;
  return sunday <= now ? sunday : sunday - 7 * DAY;
}

const amount = (value: number, currency: string) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(value) + (currency === 'USD' ? ' USD' : ' so‘m');
const date = (value: number | string) => new Date(value).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

export function saleLines(debt: DebtRecord, movements: StockMovement[]) {
  const first = movements.find(m => m.id === debt.movementId);
  const related = first ? movements.filter(m => m.type === 'chiqim' && !m.isReturn &&
    (first.batchSaleId ? m.batchSaleId === first.batchSaleId : m.id === first.id)) : [];
  return related.map(m => `${m.productName} — ${m.quantity} dona × ${amount(m.unitPrice, currencyOf(m))}, jami ${amount(m.totalRevenue, currencyOf(m))}`);
}

export function saleMessage(customer: CustomerProfile, debt: DebtRecord, debts: DebtRecord[], movements: StockMovement[]) {
  const currency = currencyOf(debt);
  const initialPaid = (debt.paymentHistory ?? []).filter(p => p.date === debt.createdAt).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, debt.totalDebt - initialPaid);
  const total = debts.filter(d => currencyOf(d) === currency).reduce((s, d) => s + Math.max(0, d.remainingAmount), 0);
  return [
    'MOBILE PARTS — Nasiya xaridi', customer.name, date(debt.createdAt),
    ...saleLines(debt, movements),
    `Xarid summasi: ${amount(debt.totalDebt, currency)}`,
    `Avans: ${amount(initialPaid, currency)}`,
    `Shu xariddan nasiya: ${amount(remaining, currency)}`,
    `Jami qolgan qarz: ${amount(total, currency)}`,
    'Hisob-kitob kuni — yakshanba.'
  ].join('\n');
}

export function weeklyMessage(customer: CustomerProfile, debts: DebtRecord[], movements: StockMovement[], cutoff: number) {
  const from = cutoff - 7 * DAY;
  const lines = ['MOBILE PARTS — Haftalik nasiya hisobi', customer.name, `${date(from)} — ${date(cutoff)}`];
  let meaningful = false;
  for (const currency of ['UZS', 'USD'] as const) {
    let opening = 0, purchases = 0, payments = 0, ending = 0;
    const details: string[] = [];
    for (const debt of debts.filter(d => currencyOf(d) === currency)) {
      const created = Date.parse(debt.createdAt);
      if (!(created < cutoff)) continue;
      const history = debt.paymentHistory ?? [];
      const legacyPaid = Math.max(0, debt.paidAmount - history.reduce((s, p) => s + p.amount, 0));
      const paidBefore = (limit: number) => (created < limit ? legacyPaid : 0) +
        history.filter(p => Date.parse(p.date) < limit).reduce((s, p) => s + p.amount, 0);
      opening += created < from ? Math.max(0, debt.totalDebt - paidBefore(from)) : 0;
      ending += Math.max(0, debt.totalDebt - paidBefore(cutoff));
      if (created >= from) {
        purchases += debt.totalDebt;
        details.push(...saleLines(debt, movements));
      }
    }
    // Effective payments also include returns and legacy payments applied in this
    // period, so the reconciliation exactly matches opening + purchases - paid.
    payments = opening + purchases - ending;
    if (opening || purchases || payments || ending) {
      meaningful = true;
      lines.push('', currency === 'USD' ? 'Dollar hisobi' : 'So‘m hisobi', ...details,
        `Avvalgi qarz: ${amount(opening, currency)}`,
        `Haftalik xaridlar: ${amount(purchases, currency)}`,
        `To‘lovlar va qaytarishlar: ${amount(payments, currency)}`,
        `Jami qolgan qarz: ${amount(ending, currency)}`);
    }
  }
  return meaningful ? lines.join('\n') : '';
}

export function splitMessage(text: string) {
  const parts: string[] = [];
  let current = '';
  for (const character of text) {
    if (current.length + character.length > 3500) { parts.push(current); current = ''; }
    current += character;
  }
  if (current) parts.push(current);
  return parts;
}
