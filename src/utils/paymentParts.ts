import type { Currency, StockMovement } from '../types';
import { roundMoney } from './money';

/**
 * Aralash to'lov: bitta savdo uchun mijoz bir qismini naqd, qolganini Click bilan to'laydi.
 * Bunday savdoning har bir qatori paymentMethod = 'aralash' va paymentParts = { naqd, click_payme }
 * bilan yoziladi (qism summalari qator tushumiga teng). Hisobotlar summani shu funksiya orqali oladi.
 */
export type SplitMethod = 'naqd' | 'click_payme';

export const movementMethodAmount = (
  m: Pick<StockMovement, 'paymentMethod' | 'totalRevenue' | 'paymentParts'>,
  method: string
): number => {
  if (m.paymentMethod === 'aralash') {
    return method === 'naqd' || method === 'click_payme' ? Number(m.paymentParts?.[method]) || 0 : 0;
  }
  return m.paymentMethod === method ? m.totalRevenue : 0;
};

/** Naqd qismni qatorlarga tushumiga mutanosib taqsimlaydi; oxirgi qator yaxlitlash qoldig'ini oladi. */
export const allocateSplitPayment = (
  lineRevenues: number[],
  cashPart: number,
  currency: Currency = 'UZS'
): { naqd: number; click_payme: number }[] => {
  const total = roundMoney(lineRevenues.reduce((a, b) => a + b, 0), currency);
  const cash = Math.min(Math.max(0, roundMoney(cashPart, currency)), total);
  let given = 0;
  return lineRevenues.map((revenue, index) => {
    const last = index === lineRevenues.length - 1;
    const naqd = last ? roundMoney(cash - given, currency) : total > 0 ? roundMoney((cash * revenue) / total, currency) : 0;
    const safeNaqd = Math.min(Math.max(0, naqd), revenue);
    given = roundMoney(given + safeNaqd, currency);
    return { naqd: safeNaqd, click_payme: roundMoney(revenue - safeNaqd, currency) };
  });
};
