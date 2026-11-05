import type { Currency } from '../types';

type WithCurrency = { currency?: Currency; category?: string } | null | undefined;

/** Dollarda sotib olinadigan va sotiladigan kataloglar (tugmali telefonlar). Qolgan barcha kataloglar so'mda. */
export const USD_CATEGORIES: readonly string[] = ['TELEFON', 'KNOPKALI'];

export const categoryCurrency = (category?: string): Currency =>
  USD_CATEGORIES.includes(String(category || '').trim().toUpperCase()) ? 'USD' : 'UZS';

/** Yozuvning valyutasi: aniq belgilangani, bo'lmasa katalogidan; ikkalasi ham bo'lmasa so'm. */
export const currencyOf = (item: WithCurrency): Currency =>
  item?.currency === 'USD' || item?.currency === 'UZS' ? item.currency : categoryCurrency(item?.category);

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
export function sumByCurrency<T extends { currency?: Currency; category?: string }>(items: T[], pick: (item: T) => number): CurrencyTotals {
  const totals: CurrencyTotals = { UZS: 0, USD: 0 };
  for (const item of items) totals[currencyOf(item)] += Number(pick(item)) || 0;
  return { UZS: roundMoney(totals.UZS, 'UZS'), USD: roundMoney(totals.USD, 'USD') };
}