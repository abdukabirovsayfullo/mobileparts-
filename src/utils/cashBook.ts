import type { DebtRecord, StockMovement } from '../types';
import { currencyOf } from './money';

/**
 * Kassa kitobi: bugungi naqd (so'm) harakatlar ro'yxati va qoldig'i.
 * Hisob-kitob server smenasidagi (server/shiftLogic.ts) qoidalar bilan bir xil:
 * naqd savdo + naqd nasiya to'lovi − naqd qaytarish − kassadan chiqim.
 * Dollarli savdo so'm kassasiga qo'shilmaydi.
 */

export const tashkentDay = (iso: string | Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export interface CashBookEntry {
  key: string;
  kind: 'sale' | 'refund' | 'debt_payment';
  timestamp: string;
  receiptNumber?: string;
  customerName: string;
  employeeName?: string;
  /** Tovarlar qisqacha: "Hoco X21 ×2, Remax kabel" */
  itemsLabel: string;
  itemCount: number;
  /** Doim musbat; yo'nalish `kind` dan aniqlanadi. */
  amount: number;
}

export interface CashBook {
  entries: CashBookEntry[];
  salesTotal: number;
  salesCount: number;
  refundTotal: number;
  refundCount: number;
  debtCashTotal: number;
  /** Chiqimlarsiz: naqd savdo + nasiya to'lovi − qaytarish. */
  netCash: number;
}

const groupMovements = (list: StockMovement[], kind: 'sale' | 'refund'): CashBookEntry[] => {
  const groups = new Map<string, StockMovement[]>();
  for (const m of list) {
    const key = m.batchSaleId || m.receiptNumber || m.id;
    const group = groups.get(key);
    if (group) group.push(m); else groups.set(key, [m]);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    const first = items.reduce((a, b) => (a.timestamp <= b.timestamp ? a : b));
    return {
      key: `${kind}:${key}`,
      kind,
      timestamp: first.timestamp,
      receiptNumber: first.receiptNumber,
      customerName: (first.counterparty || '').trim() || "Do'kon mijozi",
      employeeName: first.employeeName,
      itemsLabel: items.map((m) => (m.quantity > 1 ? `${m.productName} ×${m.quantity}` : m.productName)).join(', '),
      itemCount: items.reduce((sum, m) => sum + m.quantity, 0),
      amount: items.reduce((sum, m) => sum + m.totalRevenue, 0)
    };
  });
};

export const buildCashBook = (movements: StockMovement[], debts: DebtRecord[], date = tashkentDay(new Date())): CashBook => {
  const todayUzs = movements.filter((m) => currencyOf(m) === 'UZS' && m.paymentMethod === 'naqd' && tashkentDay(m.timestamp) === date);
  const sales = groupMovements(todayUzs.filter((m) => m.type === 'chiqim'), 'sale');
  const refunds = groupMovements(todayUzs.filter((m) => m.type === 'vazvrat'), 'refund');

  const debtPayments: CashBookEntry[] = debts
    .filter((d) => currencyOf(d) === 'UZS')
    .flatMap((d) =>
      (d.paymentHistory || [])
        .filter((p) => p.method === 'naqd' && p.amount > 0 && tashkentDay(p.date) === date)
        .map((p, index) => ({
          key: `debt:${d.id}:${p.date}:${index}`,
          kind: 'debt_payment' as const,
          timestamp: p.date,
          customerName: d.customerName,
          employeeName: p.employeeName,
          itemsLabel: 'Nasiya to‘lovi',
          itemCount: 0,
          amount: p.amount
        }))
    );

  const total = (list: CashBookEntry[]) => list.reduce((sum, e) => sum + e.amount, 0);
  const salesTotal = total(sales);
  const refundTotal = total(refunds);
  const debtCashTotal = total(debtPayments);

  return {
    entries: [...sales, ...refunds, ...debtPayments].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    salesTotal,
    salesCount: sales.length,
    refundTotal,
    refundCount: refunds.length,
    debtCashTotal,
    netCash: salesTotal + debtCashTotal - refundTotal
  };
};
