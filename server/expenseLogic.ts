import type { CashExpense } from '../src/types';

export const tashkentDate = (value: string | Date = new Date()): string => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const activeExpensesForDate = (items: CashExpense[], date: string): CashExpense[] =>
  items.filter(item => !item.cancelledAt && tashkentDate(item.occurredAt) === date);

export const expenseTotal = (items: CashExpense[]): number =>
  items.reduce((sum, item) => sum + item.amount, 0);
