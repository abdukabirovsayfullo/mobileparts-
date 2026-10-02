import type { CashExpense, CashShift, DebtRecord, Product, StockMovement } from '../src/types';
import { activeExpensesForDate, expenseTotal, tashkentDate } from './expenseLogic';

export interface ReportInput { products: Product[]; movements: StockMovement[]; debts: DebtRecord[]; expenses: CashExpense[]; cashShifts: CashShift[]; }

const inRange = (iso: string, from: string, to: string) => { const day = tashkentDate(iso); return day >= from && day <= to; };
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const buildReport = (state: ReportInput, from: string, to: string) => {
  const sales = state.movements.filter(m => m.type === 'chiqim' && inRange(m.timestamp, from, to));
  const returns = state.movements.filter(m => m.type === 'vazvrat' && inRange(m.timestamp, from, to));
  const kirim = state.movements.filter(m => m.type === 'kirim' && inRange(m.timestamp, from, to));
  const expenses = state.expenses.filter(item => !item.cancelledAt && inRange(item.occurredAt, from, to));
  const shifts = state.cashShifts.filter(item => item.businessDate >= from && item.businessDate <= to && !item.reopenedAt);
  const refundRevenue = returns.reduce((sum, m) => sum + m.totalRevenue, 0);
  const revenue = sales.reduce((sum, m) => sum + m.totalRevenue, 0) - refundRevenue;
  const cost = sales.reduce((sum, m) => sum + m.totalCost, 0) - returns.reduce((sum, m) => sum + m.totalCost, 0);
  const grossProfit = revenue - cost;
  const expensesTotal = expenseTotal(expenses);
  const payment = (method: string) => sales.filter(m => m.paymentMethod === method).reduce((sum, m) => sum + m.totalRevenue, 0) - returns.filter(m => m.paymentMethod === method).reduce((sum, m) => sum + m.totalRevenue, 0);
  const saleIds = new Set(sales.map(m => m.batchSaleId || m.receiptNumber || m.id));
  const productMap = new Map<string, { id: string; name: string; quantity: number; revenue: number; profit: number }>();
  sales.forEach(m => { const row = productMap.get(m.productId) || { id: m.productId, name: m.productName, quantity: 0, revenue: 0, profit: 0 }; row.quantity += m.quantity; row.revenue += m.totalRevenue; row.profit += m.profit; productMap.set(m.productId, row); });
  const products = [...productMap.values()].sort((a, b) => b.quantity - a.quantity);
  const employeeMap = new Map<string, { name: string; revenue: number; sales: Set<string> }>();
  sales.forEach(m => { const id = m.employeeId || 'legacy'; const row = employeeMap.get(id) || { name: m.employeeName || 'Eski savdolar', revenue: 0, sales: new Set<string>() }; row.revenue += m.totalRevenue; row.sales.add(m.batchSaleId || m.id); employeeMap.set(id, row); });
  const categoryMap = new Map<string, number>(); expenses.forEach(item => categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + item.amount));
  const span = daysBetween(from, to); const monthly = span > 62;
  const timelineMap = new Map<string, { label: string; revenue: number; profit: number }>();
  sales.forEach(m => { const day = tashkentDate(m.timestamp); const label = monthly ? day.slice(0, 7) : day; const row = timelineMap.get(label) || { label, revenue: 0, profit: 0 }; row.revenue += m.totalRevenue; row.profit += m.profit; timelineMap.set(label, row); });
  const debtsCreated = state.debts.filter(d => inRange(d.createdAt, from, to));
  const debtPaid = state.debts.flatMap(d => d.paymentHistory || []).filter(p => p.method !== 'vazvrat' && inRange(p.date, from, to)).reduce((sum, p) => sum + p.amount, 0);
  return {
    range: { from, to, days: span, grouping: monthly ? 'month' : 'day' },
    sales: { revenue, cost, grossProfit, expenses: expensesTotal, netProfit: grossProfit - expensesTotal, count: saleIds.size, items: sales.reduce((sum, m) => sum + m.quantity, 0), averageCheck: saleIds.size ? Math.round(revenue / saleIds.size) : 0, payments: { cash: payment('naqd'), click: payment('click_payme'), uzum: payment('uzum'), debt: payment('nasiya') } },
    inventory: { kirimQuantity: kirim.reduce((s, m) => s + m.quantity, 0), kirimCost: kirim.reduce((s, m) => s + m.totalCost, 0), currentCostValue: state.products.reduce((s, p) => s + p.stock * (p.purchasePrice || 0), 0), currentRetailValue: state.products.reduce((s, p) => s + p.stock * p.sellingPrice, 0), top: products.slice(0, 10), low: products.slice().sort((a, b) => a.quantity - b.quantity).slice(0, 10), unsoldCount: state.products.filter(p => !productMap.has(p.id)).length },
    debts: { issued: debtsCreated.reduce((s, d) => s + d.totalDebt, 0), paid: debtPaid, remaining: state.debts.reduce((s, d) => s + d.remainingAmount, 0) },
    expenses: { total: expensesTotal, count: expenses.length, byCategory: [...categoryMap].map(([category, total]) => ({ category, total })) },
    returns: { count: new Set(returns.map(m => m.batchSaleId || m.id)).size, amount: refundRevenue },
    shifts: { count: shifts.length, shortage: shifts.filter(s => s.difference < 0).reduce((sum, s) => sum + Math.abs(s.difference), 0), surplus: shifts.filter(s => s.difference > 0).reduce((sum, s) => sum + s.difference, 0) },
    employees: [...employeeMap.values()].map(row => ({ name: row.name, revenue: row.revenue, sales: row.sales.size })).sort((a, b) => b.revenue - a.revenue),
    timeline: [...timelineMap.values()].sort((a, b) => a.label.localeCompare(b.label))
  };
};

export const previousRange = (from: string, to: string) => { const days = daysBetween(from, to); return { from: addDays(from, -days), to: addDays(from, -1) }; };
