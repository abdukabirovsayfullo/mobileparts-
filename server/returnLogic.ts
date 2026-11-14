import type { Currency, DebtRecord, StockMovement } from '../src/types';
import { currencyOf, roundMoney } from '../src/utils/money';
import { tashkentDate } from './expenseLogic';
import { normalizeSearchText } from '../src/utils/customerSearch';
import { firstNameToken, sameCustomerDebts } from '../src/utils/saleAccounting';

export const WORKER_RETURN_WINDOW_DAYS = 7;
export const RETURN_FLAG_DAILY_COUNT = Number(process.env.POS_RETURN_FLAG_COUNT) > 0 ? Number(process.env.POS_RETURN_FLAG_COUNT) : 3;
export const RETURN_FLAG_DAILY_AMOUNT = Number(process.env.POS_RETURN_FLAG_AMOUNT) > 0 ? Number(process.env.POS_RETURN_FLAG_AMOUNT) : 500_000;

export const normalizeName = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

const phoneKey = (value?: string): string => String(value || '').replace(/\D/g, '').slice(-9);

export const sameCustomer = (nameA: string, phoneA: string | undefined, nameB: string, phoneB: string | undefined): boolean => {
  const aPhone = phoneKey(phoneA);
  const bPhone = phoneKey(phoneB);
  if (aPhone.length >= 9 && bPhone.length >= 9) return aPhone === bPhone && firstNameToken(nameA) === firstNameToken(nameB);
  return normalizeSearchText(nameA) === normalizeSearchText(nameB);
};

const dayNumber = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
export const daysAgo = (iso: string, today = tashkentDate()): number => dayNumber(today) - dayNumber(tashkentDate(iso));
export const isWithinWorkerWindow = (iso: string, today = tashkentDate()): boolean => daysAgo(iso, today) <= WORKER_RETURN_WINDOW_DAYS;

export const returnedQuantity = (movements: StockMovement[], originalId: string): number =>
  movements.filter(item => item.type === 'vazvrat' && item.originalMovementId === originalId).reduce((sum, item) => sum + item.quantity, 0);

export const returnableQuantity = (original: StockMovement, movements: StockMovement[]): number =>
  Math.max(0, original.quantity - returnedQuantity(movements, original.id));

/** Qaytariladigan summa: sotuvdagi haqiqiy tushumning (chegirmadan keyingi) proporsional ulushi. */
export const refundAmount = (original: StockMovement, quantity: number): number =>
  roundMoney((original.totalRevenue * quantity) / Math.max(1, original.quantity), currencyOf(original));

/** Mijozning faol nasiyalaridan qaytarilgan summani FIFO tartibida ayiradi. O'zgargan nusxalarni qaytaradi. */
export const applyRefundToDebts = (
  debts: DebtRecord[], customerName: string, customerPhone: string | undefined, amount: number, receiptNumber: string, nowIso: string,
  actor: { id?: string; name?: string }, currency: Currency = 'UZS'
): { debts: DebtRecord[]; applied: number } => {
  // Faqat o'sha valyutadagi nasiyalar kamayadi: dollarli qaytarish so'mli nasiyaga tegmaydi va aksincha.
  let left = Math.max(0, roundMoney(amount, currency));
  let applied = 0;
  const candidates = sameCustomerDebts(debts, customerName, customerPhone)
    .filter(debt => debt.status !== 'yopildi' && debt.remainingAmount > 0 && currencyOf(debt) === currency)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const updated = new Map<string, DebtRecord>();
  for (const debt of candidates) {
    if (left <= 0) break;
    const deduction = Math.min(debt.remainingAmount, left);
    left = roundMoney(left - deduction, currency);
    applied = roundMoney(applied + deduction, currency);
    const remaining = roundMoney(debt.remainingAmount - deduction, currency);
    updated.set(debt.id, {
      ...debt,
      paidAmount: roundMoney(debt.paidAmount + deduction, currency),
      remainingAmount: remaining,
      status: remaining <= 0 ? 'yopildi' : 'qisman_tolandi',
      notes: `${debt.notes ? `${debt.notes} | ` : ''}Qaytarish (${receiptNumber}) hisobiga ${currency === 'USD' ? `$${deduction}` : `${deduction} so'm`} kamaytirildi`.trim(),
      paymentHistory: [...(debt.paymentHistory || []), { date: nowIso, amount: deduction, method: 'vazvrat', employeeId: actor.id, employeeName: actor.name }]
    });
  }
  return { debts: debts.map(debt => updated.get(debt.id) || debt), applied };
};

export interface ReturnActivity {
  employeeId: string;
  employeeName: string;
  todayCount: number;
  todayAmount: number;
  weekCount: number;
  weekAmount: number;
  /** Dollarli qaytarishlar summasi (so'm chegarasiga qo'shilmaydi). */
  todayAmountUsd: number;
  weekAmountUsd: number;
  flagged: boolean;
  reasons: string[];
}

/** Rahbar uchun: har bir xodimning qaytarishlari. Bloklamaydi, faqat belgilaydi. */
export const summarizeReturns = (
  movements: StockMovement[], today = tashkentDate(),
  limits = { count: RETURN_FLAG_DAILY_COUNT, amount: RETURN_FLAG_DAILY_AMOUNT }
): ReturnActivity[] => {
  const map = new Map<string, ReturnActivity & { todayBatches: Set<string>; weekBatches: Set<string> }>();
  for (const item of movements) {
    if (item.type !== 'vazvrat' || daysAgo(item.timestamp, today) > 6) continue;
    const id = item.employeeId || 'owner-or-legacy';
    const row = map.get(id) || { employeeId: id, employeeName: item.employeeName || 'Rahbar / eski yozuv', todayCount: 0, todayAmount: 0, weekCount: 0, weekAmount: 0, todayAmountUsd: 0, weekAmountUsd: 0, flagged: false, reasons: [], todayBatches: new Set<string>(), weekBatches: new Set<string>() };
    const batch = item.batchSaleId || item.id;
    const usd = currencyOf(item) === 'USD';
    row.weekBatches.add(batch); if (usd) row.weekAmountUsd = roundMoney(row.weekAmountUsd + item.totalRevenue, 'USD'); else row.weekAmount += item.totalRevenue;
    if (tashkentDate(item.timestamp) === today) { row.todayBatches.add(batch); if (usd) row.todayAmountUsd = roundMoney(row.todayAmountUsd + item.totalRevenue, 'USD'); else row.todayAmount += item.totalRevenue; }
    map.set(id, row);
  }
  return [...map.values()].map(({ todayBatches, weekBatches, ...row }) => {
    row.todayCount = todayBatches.size; row.weekCount = weekBatches.size;
    if (row.todayCount >= limits.count) row.reasons.push(`Bugun ${row.todayCount} ta qaytarish`);
    if (row.todayAmount >= limits.amount) row.reasons.push(`Bugungi qaytarish summasi ${row.todayAmount} so'm`);
    row.flagged = row.reasons.length > 0;
    return row;
  }).sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.weekAmount - a.weekAmount);
};
