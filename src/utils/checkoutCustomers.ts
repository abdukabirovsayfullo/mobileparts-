import type { PaymentMethod } from '../types';

/** Nasiyaga o'tganda oldingi naqd summa avans bo'lib qolmasin; Nasiyada qayta bosish esa avansni saqlaydi. */
export function paidAfterMethodChange(previous: PaymentMethod, next: PaymentMethod, paid: number): number {
  return next === 'nasiya' && previous !== 'nasiya' ? 0 : paid;
}
