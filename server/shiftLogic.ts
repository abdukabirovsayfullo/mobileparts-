import type { CashExpense, StockMovement } from '../src/types';
import { activeExpensesForDate, expenseTotal, tashkentDate } from './expenseLogic';

export interface ShiftTotals {
  cashRevenue: number;
  clickRevenue: number;
  uzumRevenue: number;
  debtRevenue: number;
  expenseTotal: number;
  expectedCash: number;
}

export const calculateShiftTotals = (
  movements: StockMovement[], expenses: CashExpense[], employeeId: string, date: string, openingCash: number
): ShiftTotals => {
  const sales = movements.filter(item => item.type === 'chiqim' && item.employeeId === employeeId && tashkentDate(item.timestamp) === date);
  const sum = (method: string) => sales.filter(item => item.paymentMethod === method).reduce((total, item) => total + item.totalRevenue, 0);
  const activeExpenses = activeExpensesForDate(expenses, date).filter(item => item.createdById === employeeId);
  const cashRevenue = sum('naqd');
  const expensesTotal = expenseTotal(activeExpenses);
  return {
    cashRevenue,
    clickRevenue: sum('click_payme'),
    uzumRevenue: sum('uzum'),
    debtRevenue: sum('nasiya'),
    expenseTotal: expensesTotal,
    expectedCash: Math.round(openingCash) + cashRevenue - expensesTotal
  };
};
