import type { Currency } from '../types';

type WithCurrency = { currency?: Currency } | null | undefined;

/** Yozuvning valyutasi; belgilanmagan (eski) yozuvlar so'mda. */
export const currencyOf = (item: WithCurrency): Currency => (item?.currency === 'USD' ? 'USD' : 'UZS');

export const isUsd = (item: WithCurrency): boolean => currencyOf(item) === 'USD';

export const sameCurrency = (a: WithCurrency, b: WithCurrency): boolean => currencyOf(a) === currencyOf(b);

/** So'm butun songa, dollar sentgacha (2 xona) yaxlitlanadi. */
export function roundMoney(amount: number, currency: Currency = 'UZS'): number {
  const value = Number(amount) || 0;
  return currency === 'USD' ? Math.round(value * 100) / 100 : Math.round(value);
}

export interface CurrencyTotals {
  UZS: number;
  USD: number;
}

/** Yozuvlarni valyuta bo'yicha alohida jamlaydi; so'm va dollar hech qachon qo'shilmaydi. */
export function sumByCurrency<T extends { currency?: Currency }>(items: T[], pick: (item: T) => number): CurrencyTotals {
  const totals: CurrencyTotals = { UZS: 0, USD: 0 };
  for (const item of items) totals[currencyOf(item)] += Number(pick(item)) || 0;
  return { UZS: roundMoney(totals.UZS, 'UZS'), USD: roundMoney(totals.USD, 'USD') };
}