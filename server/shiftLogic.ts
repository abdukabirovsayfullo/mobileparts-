import type { CashExpense, DebtRecord, StockMovement } from '../src/types';
import { currencyOf } from '../src/utils/money';
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
  movements: StockMovement[], expenses: CashExpense[], employeeId: string | null, date: string, openingCash: number,
  debts: DebtRecord[] = []
): ShiftTotals => {
  // null means the shared store cash drawer; a worker ID keeps personal scope.
  const inScope = (id?: string) => employeeId === null || id === employeeId;
  // Kassa smenasi faqat so'mda: dollarli savdo va nasiya to'lovlari kutilgan so'm naqd pulga qo'shilmaydi.
  const sales = movements.filter(item => item.type === 'chiqim' && currencyOf(item) === 'UZS' && inScope(item.employeeId) && tashkentDate(item.timestamp) === date);
  const refunds = movements.filter(item => item.type === 'vazvrat' && currencyOf(item) === 'UZS' && inScope(item.employeeId) && tashkentDate(item.timestamp) === date);
  const sum = (method: string) => sales.filter(item => item.paymentMethod === method).reduce((total, item) => total + item.totalRevenue, 0);
  const activeExpenses = activeExpensesForDate(expenses, date).filter(item => inScope(item.createdById));
  const cashRevenue = sum('naqd');
  const expensesTotal = expenseTotal(activeExpenses);
  const refundTotal = refunds.filter(item => item.paymentMethod === 'naqd').reduce((total, item) => total + item.totalRevenue, 0);
  const debtCashReceived = debts
    .filter(debt => currencyOf(debt) === 'UZS')
    .flatMap(debt => debt.paymentHistory || [])
    .filter(payment => payment.method === 'naqd' && inScope(payment.employeeId) && tashkentDate(payment.date) === date)
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
