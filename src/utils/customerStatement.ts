import type { Currency, DebtRecord, StockMovement } from '../types';
import { customerDebtHistory, mergeLedgerPayments, LedgerPayment } from './saleAccounting';
import { currencyOf, roundMoney } from './money';
import { tashkentDate } from '../../server/expenseLogic';

export interface StatementItem { name: string; quantity: number; unitPrice: number; total: number; returnedQty: number }
export interface StatementDay {
  /** YYYY-MM-DD (Toshkent) */
  day: string;
  purchases: { time: string; items: StatementItem[]; note?: string; amount: number }[];
  total: number;
}

export interface CustomerStatement {
  name: string;
  phone: string;
  currency: Currency;
  from: string;
  to: string;
  days: StatementDay[];
  /** Davrdagi pul to'lovlari (qaytarishlarsiz), eng yangisi birinchi. */
  payments: LedgerPayment[];
  /** Davrdagi tovar qaytarishlar (qarzdan ayrilgan). */
  returns: LedgerPayment[];
  period: { purchases: number; payments: number; returns: number };
  /** Hozirgi umumiy qarz (davrdan qat'i nazar). */
  currentDebt: number;
}

const inRange = (iso: string, from: string, to: string) => {
  const d = tashkentDate(iso);
  return (!from || d >= from) && (!to || d <= to);
};

/**
 * Mijoz hisobi: tanlangan davrda nima olgani (kun bo'yicha), to'lovlari va hozirgi umumiy qarz.
 * Xaridlar "yopilgan/qarz" deb belgilanmaydi — to'lov mijozning umumiy qarzidan ayriladi.
 */
export function buildCustomerStatement(
  debts: DebtRecord[], movements: StockMovement[], name: string, phone: string | undefined, currency: Currency, from = '', to = ''
): CustomerStatement {
  const history = customerDebtHistory(debts, movements, name, phone);
  const rows = history.debts.filter((r) => !r.debt.cancelledAt && currencyOf(r.debt) === currency);
  const byDay = new Map<string, StatementDay>();
  for (const r of rows) {
    if (!inRange(r.debt.createdAt, from, to)) continue;
    const day = tashkentDate(r.debt.createdAt);
    const entry = byDay.get(day) || { day, purchases: [], total: 0 };
    entry.purchases.push({
      time: r.debt.createdAt,
      items: r.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, returnedQty: i.returnedQty })),
      note: r.items.length ? undefined : r.note || "Qo'lda yozilgan nasiya",
      amount: r.debt.totalDebt
    });
    entry.total = roundMoney(entry.total + r.debt.totalDebt, currency);
    byDay.set(day, entry);
  }
  const days = Array.from(byDay.values())
    .map((d) => ({ ...d, purchases: d.purchases.sort((a, b) => a.time.localeCompare(b.time)) }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const allPayments = rows.flatMap((r) => r.payments).filter((p) => inRange(p.date, from, to));
  const payments = mergeLedgerPayments(allPayments.filter((p) => p.method !== 'vazvrat'));
  const returns = mergeLedgerPayments(allPayments.filter((p) => p.method === 'vazvrat'));
  const sum = (list: { amount: number }[]) => roundMoney(list.reduce((s, x) => s + x.amount, 0), currency);
  const currentDebt = roundMoney(
    rows.filter((r) => r.debt.status !== 'yopildi').reduce((s, r) => s + Math.max(0, r.debt.remainingAmount), 0),
    currency
  );
  return {
    name: history.name,
    phone: history.phone,
    currency,
    from,
    to,
    days,
    payments,
    returns,
    period: { purchases: sum(days.map((d) => ({ amount: d.total }))), payments: sum(payments), returns: sum(returns) },
    currentDebt
  };
}
