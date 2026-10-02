import type { CashExpense, DebtRecord, StockMovement } from '../src/types';
import { activeExpensesForDate, expenseTotal, tashkentDate } from './expenseLogic';

export interface ShiftTotals {
  cashRevenue: number;
  clickRevenue: number;
  uzumRevenue: number;
  debtRevenue: number;
  /** Xodim smenada naqd qabul qilgan nasiya to'lovlari (kassaga qo'shiladi). */
  debtCashReceived: number;
  /** Xodim smenada naqd qaytargan summa (kassadan ayriladi). */
  refundTotal: number;
  expenseTotal: number;
  expectedCash: number;
}

export const calculateShiftTotals = (
  movements: StockMovement[], expenses: CashExpense[], employeeId: string, date: string, openingCash: number,
  debts: DebtRecord[] = []
): ShiftTotals => {
  const sales = movements.filter(item => item.type === 'chiqim' && item.employeeId === employeeId && tashkentDate(item.timestamp) === date);
  const refunds = movements.filter(item => item.type === 'vazvrat' && item.employeeId === employeeId && tashkentDate(item.timestamp) === date);
  const sum = (method: string) => sales.filter(item => item.paymentMethod === method).reduce((total, item) => total + item.totalRevenue, 0);
  const activeExpenses = activeExpensesForDate(expenses, date).filter(item => item.createdById === employeeId);
  const cashRevenue = sum('naqd');
  const expensesTotal = expenseTotal(activeExpenses);
  const refundTotal = refunds.filter(item => item.paymentMethod === 'naqd').reduce((total, item) => total + item.totalRevenue, 0);
  const debtCashReceived = debts
    .flatMap(debt => debt.paymentHistory || [])
    .filter(payment => payment.method === 'naqd' && payment.employeeId === employeeId && tashkentDate(payment.date) === date)
    .reduce((total, payment) => total + payment.amount, 0);
  return {
    cashRevenue,
    clickRevenue: sum('click_payme'),
    uzumRevenue: sum('uzum'),
    debtRevenue: sum('nasiya'),
    debtCashReceived,
    refundTotal,
    expenseTotal: expensesTotal,
    expectedCash: Math.round(openingCash) + cashRevenue + debtCashReceived - refundTotal - expensesTotal
  };
};
