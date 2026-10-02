import type { DebtRecord, StockMovement } from '../src/types';
import { tashkentDate } from './expenseLogic';

export const WORKER_RETURN_WINDOW_DAYS = 7;
export const RETURN_FLAG_DAILY_COUNT = Number(process.env.POS_RETURN_FLAG_COUNT) > 0 ? Number(process.env.POS_RETURN_FLAG_COUNT) : 3;
export const RETURN_FLAG_DAILY_AMOUNT = Number(process.env.POS_RETURN_FLAG_AMOUNT) > 0 ? Number(process.env.POS_RETURN_FLAG_AMOUNT) : 500_000;

export const normalizeName = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

const dayNumber = (date: string): number => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
export const daysAgo = (iso: string, today = tashkentDate()): number => dayNumber(today) - dayNumber(tashkentDate(iso));
export const isWithinWorkerWindow = (iso: string, today = tashkentDate()): boolean => daysAgo(iso, today) <= WORKER_RETURN_WINDOW_DAYS;

export const returnedQuantity = (movements: StockMovement[], originalId: string): number =>
  movements.filter(item => item.type === 'vazvrat' && item.originalMovementId === originalId).reduce((sum, item) => sum + item.quantity, 0);

export const returnableQuantity = (original: StockMovement, movements: StockMovement[]): number =>
  Math.max(0, original.quantity - returnedQuantity(movements, original.id));

/** Qaytariladigan summa: sotuvdagi haqiqiy tushumning (chegirmadan keyingi) proporsional ulushi. */
export const refundAmount = (original: StockMovement, quantity: number): number =>
  Math.round((original.totalRevenue * quantity) / Math.max(1, original.quantity));

/** Mijozning faol nasiyalaridan qaytarilgan summani FIFO tartibida ayiradi. O'zgargan nusxalarni qaytaradi. */
export const applyRefundToDebts = (
  debts: DebtRecord[], customerName: string, amount: number, receiptNumber: string, nowIso: string,
  actor: { id?: string; name?: string }
): { debts: DebtRecord[]; applied: number } => {
  let left = Math.max(0, Math.round(amount));
  let applied = 0;
  const name = normalizeName(customerName);
  const candidates = debts
    .filter(debt => debt.status !== 'yopildi' && debt.remainingAmount > 0 && normalizeName(debt.customerName) === name)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const updated = new Map<string, DebtRecord>();
  for (const debt of candidates) {
    if (left <= 0) break;
    const deduction = Math.min(debt.remainingAmount, left);
    left -= deduction;
    applied += deduction;
    const remaining = debt.remainingAmount - deduction;
    updated.set(debt.id, {
      ...debt,
      paidAmount: debt.paidAmount + deduction,
      remainingAmount: remaining,
      status: remaining <= 0 ? 'yopildi' : 'qisman_tolandi',
      notes: `${debt.notes ? `${debt.notes} | ` : ''}Qaytarish (${receiptNumber}) hisobiga ${deduction} so'm kamaytirildi`.trim(),
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
    const row = map.get(id) || { employeeId: id, employeeName: item.employeeName || 'Rahbar / eski yozuv', todayCount: 0, todayAmount: 0, weekCount: 0, weekAmount: 0, flagged: false, reasons: [], todayBatches: new Set<string>(), weekBatches: new Set<string>() };
    const batch = item.batchSaleId || item.id;
    row.weekBatches.add(batch); row.weekAmount += item.totalRevenue;
    if (tashkentDate(item.timestamp) === today) { row.todayBatches.add(batch); row.todayAmount += item.totalRevenue; }
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
