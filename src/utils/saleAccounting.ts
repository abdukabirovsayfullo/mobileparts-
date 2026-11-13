import { Currency, DebtRecord, StockMovement } from '../types';
import { currencyOf, roundMoney } from './money';

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const customerKey = (name: string, phone?: string) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? `phone:${digits.slice(-9)}` : `name:${cleanName(name)}`;
};

export function customerDebtTotal(debts: DebtRecord[], name: string, phone?: string, currency: Currency = 'UZS'): number {
  const key = cleanName(name);
  if (!key || key === cleanName("Do'kon mijozi")) return 0;
  const identity = customerKey(name, phone);
  return roundMoney(debts.filter(d => customerKey(d.customerName, d.customerPhone) === identity && d.status !== 'yopildi' && currencyOf(d) === currency)
    .reduce((sum, d) => sum + Math.max(0, d.remainingAmount), 0), currency);
}

export function saleAccounting(amounts: number[], paidNow: number, discount = 0, currency: Currency = 'UZS') {
  const subtotal = amounts.reduce((s, n) => s + n, 0);
  const total = Math.max(0, subtotal - Math.min(subtotal, Math.max(0, discount)));
  const paid = Math.min(total, Math.max(0, paidNow));
  // Allocate rounded amounts, leaving the exact remainder on the last line.
  let revenueLeft = total;
  let paidLeft = paid;
  const lines = amounts.map((amount, index) => {
    const last = index === amounts.length - 1;
    const revenue = last ? revenueLeft : Math.min(revenueLeft, Math.round((subtotal ? total * amount / subtotal : 0) * 100) / 100);
    const linePaid = last ? paidLeft : Math.min(paidLeft, revenue, Math.round((total ? paid * revenue / total : 0) * 100) / 100);
    revenueLeft -= revenue;
    paidLeft -= linePaid;
    return { revenue, paid: linePaid, debt: revenue - linePaid, discount: amount - revenue };
  });
  if (currency === 'USD') {
    // Dollarda sent aniqligi: suzuvchi nuqta xatosi (0.30000000000000004) hisobga kirmasin.
    const r = (n: number) => roundMoney(n, 'USD');
    return { subtotal: r(subtotal), total: r(total), paid: r(paid), remaining: r(total - paid), lines: lines.map(l => ({ revenue: r(l.revenue), paid: r(l.paid), debt: r(l.debt), discount: r(l.discount) })) };
  }
  return { subtotal, total, paid, remaining: total - paid, lines };
}

export function movementPaymentSummary(m: StockMovement, related: StockMovement[], debts: DebtRecord[]) {
  const total = related.reduce((sum, row) => sum + row.totalRevenue, 0);
  const debt = debts.find(d => related.some(row => row.id === d.movementId));
  // Old sales lack payment metadata: only a payment recorded at sale time is an initial payment.
  const initialPaid = debt?.paymentHistory?.filter(p => p.date === debt.createdAt).reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const paidAmount = related.every(row => row.paidAmount !== undefined)
    ? related.reduce((sum, row) => sum + (row.paidAmount || 0), 0)
    : m.paymentMethod === 'nasiya' ? initialPaid : total;
  const remaining = Math.max(0, total - paidAmount);
  const currentDebt = customerDebtTotal(debts, m.counterparty, m.customerPhone, currencyOf(m));
  return {
    paidAmount, debtRemaining: remaining, isDebt: remaining > 0,
    previousCustomerDebt: m.previousCustomerDebt,
    customerTotalDebt: cleanName(m.counterparty) === cleanName("Do'kon mijozi")
      ? (debt?.remainingAmount ?? m.customerTotalDebt ?? remaining) : currentDebt,
    debtDueDate: m.debtDueDate || debt?.dueDate
  };
}

const DAY_MS = 86400000;

/** Muddati o'tgan kunlar soni (muddati o'tmagan yoki yopilgan qarz uchun 0). */
export function debtOverdueDays(debt: DebtRecord, now = Date.now()): number {
  if (debt.status === 'yopildi') return 0;
  const due = new Date(debt.dueDate).getTime();
  if (isNaN(due)) return 0;
  return Math.max(0, Math.floor((now - due) / DAY_MS));
}

export interface CustomerDebtSummary {
  key: string;
  currency: Currency;
  name: string;
  phone: string;
  remaining: number;
  paid: number;
  activeCount: number;
  maxOverdueDays: number;
  nearestDue: string;
}

/** Faol qarzlarni mijoz bo'yicha jamlaydi (eng katta qarz birinchi). "Do'kon mijozi" alohida qatorlarda qoladi. */
export function groupDebtsByCustomer(debts: DebtRecord[], now = Date.now()): CustomerDebtSummary[] {
  const anonymous = cleanName("Do'kon mijozi");
  const map = new Map<string, CustomerDebtSummary>();
  for (const d of debts) {
    if (d.status === 'yopildi' || d.remainingAmount <= 0) continue;
    const name = cleanName(d.customerName);
    const currency = currencyOf(d);
    const key = (!name || name === anonymous ? `id:${d.id}` : customerKey(d.customerName, d.customerPhone)) + `|${currency}`;
    const overdue = debtOverdueDays(d, now);
    const current = map.get(key);
    if (!current) {
      map.set(key, { key, currency, name: d.customerName.trim(), phone: d.customerPhone, remaining: d.remainingAmount, paid: d.paidAmount, activeCount: 1, maxOverdueDays: overdue, nearestDue: d.dueDate });
    } else {
      current.remaining += d.remainingAmount;
      current.paid += d.paidAmount;
      current.activeCount += 1;
      current.maxOverdueDays = Math.max(current.maxOverdueDays, overdue);
      if (d.dueDate && (!current.nearestDue || d.dueDate < current.nearestDue)) current.nearestDue = d.dueDate;
      if (!current.phone && d.customerPhone) current.phone = d.customerPhone;
    }
  }
  return [...map.values()].sort((a, b) => Number(a.currency === 'USD') - Number(b.currency === 'USD') || b.remaining - a.remaining);
}

/** To'lovni qoldiq bilan cheklaydi: ortiqcha to'lov va manfiy summa qabul qilinmaydi. */
export function clampDebtPayment(debt: DebtRecord, amount: number): number {
  if (debt.status === 'yopildi' || !(amount > 0)) return 0;
  return Math.min(amount, Math.max(0, debt.remainingAmount));
}

export interface PeriodDebtRow {
  debt: DebtRecord;
  /** "Tovar × soni" qatorlari; sotuv topilmasa nasiya izohi. */
  itemLines: string[];
  paid: number;
  returned: number;
}

export interface PeriodCustomerReport {
  key: string;
  currency: Currency;
  name: string;
  phone: string;
  rows: PeriodDebtRow[];
  saleTotal: number;
  paid: number;
  returned: number;
  remaining: number;
}

/** [fromMs, toMs] oralig'ida (ikkala chegara kiradi) yozilgan nasiyalar: mijoz bo'yicha, olingan tovarlari bilan. Eng katta qoldiq birinchi. */
export function debtPeriodReport(debts: DebtRecord[], movements: StockMovement[], fromMs: number, toMs: number): PeriodCustomerReport[] {
  const anonymous = cleanName("Do'kon mijozi");
  const groups = new Map<string, PeriodCustomerReport>();
  for (const d of debts) {
    // Bu ekran mijozga yuboriladigan qarz eslatmasi uchun: to'liq yopilgan
    // nasiyalar tanlangan davrda yozilgan bo'lsa ham ro'yxatga kirmaydi.
    if (d.status === 'yopildi' || d.remainingAmount <= 0) continue;
    const created = new Date(d.createdAt).getTime();
    if (isNaN(created) || created < fromMs || created > toMs) continue;

    const sale = movements.find(m => m.id === d.movementId);
    const related = sale ? (sale.batchSaleId ? movements.filter(m => m.batchSaleId === sale.batchSaleId) : [sale]) : [];
    const itemLines = related.filter(m => m.type === 'chiqim' && !m.isReturn).map(m => `${m.productName} × ${m.quantity}`);
    if (!itemLines.length && d.notes) itemLines.push(d.notes);

    const name = cleanName(d.customerName);
    const currency = currencyOf(d);
    const key = (!name || name === anonymous ? `id:${d.id}` : customerKey(d.customerName, d.customerPhone)) + `|${currency}`;
    const returned = (d.paymentHistory || [])
      .filter(payment => payment.method === 'vazvrat')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const paid = Math.max(0, d.paidAmount - returned);
    let group = groups.get(key);
    if (!group) {
      group = { key, currency, name: d.customerName.trim(), phone: d.customerPhone, rows: [], saleTotal: 0, paid: 0, returned: 0, remaining: 0 };
      groups.set(key, group);
    }
    group.rows.push({ debt: d, itemLines, paid, returned });
    group.saleTotal += d.totalDebt;
    group.paid += paid;
    group.returned += returned;
    group.remaining += d.remainingAmount;
    if (!group.phone && d.customerPhone) group.phone = d.customerPhone;
  }
  const result = [...groups.values()];
  for (const g of result) {
    g.rows.sort((a, b) => a.debt.createdAt.localeCompare(b.debt.createdAt));
    g.saleTotal = roundMoney(g.saleTotal, g.currency);
    g.paid = roundMoney(g.paid, g.currency);
    g.returned = roundMoney(g.returned, g.currency);
    g.remaining = roundMoney(g.remaining, g.currency);
  }
  return result.sort((a, b) => Number(a.currency === 'USD') - Number(b.currency === 'USD') || b.remaining - a.remaining || a.name.localeCompare(b.name));
}
/** Mijozning hozirgi barcha faol nasiyalari (yopilmagan, qoldig'i bor) tovarlari bilan; bunday nasiya bo'lmasa undefined. */
export function activeCustomerDebtReport(debts: DebtRecord[], movements: StockMovement[], debt: DebtRecord): PeriodCustomerReport | undefined {
  const anonymous = cleanName("Do'kon mijozi");
  const name = cleanName(debt.customerName);
  const identity = customerKey(debt.customerName, debt.customerPhone);
  const sameCustomer = !name || name === anonymous ? [debt] : debts.filter(d => customerKey(d.customerName, d.customerPhone) === identity && currencyOf(d) === currencyOf(debt));
  const active = sameCustomer.filter(d => d.status !== 'yopildi' && d.remainingAmount > 0);
  return debtPeriodReport(active, movements, -Infinity, Infinity)[0];
}

export interface CustomerHistoryItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  returnedQty: number;
}

export interface CustomerHistoryDebt {
  debt: DebtRecord;
  items: CustomerHistoryItem[];
  /** Sotuv topilmasa (qo'lda yozilgan nasiya) izoh shu yerda bo'ladi. */
  note?: string;
  payments: { date: string; amount: number; method: string; employeeName?: string }[];
}

export interface CustomerDebtHistory {
  name: string;
  phone: string;
  debts: CustomerHistoryDebt[];
  totals: Record<Currency, { taken: number; paid: number; returned: number; remaining: number }>;
}

/** Bitta mijozning barcha nasiyalari: nima olgani, qancha to'lagani va qaytargani. Yangi nasiyalar birinchi. */
export function customerDebtHistory(debts: DebtRecord[], movements: StockMovement[], name: string, phone?: string): CustomerDebtHistory {
  const anonymous = cleanName("Do'kon mijozi");
  const identity = customerKey(name, phone);
  const own = cleanName(name) === anonymous || !cleanName(name)
    ? []
    : debts.filter(d => customerKey(d.customerName, d.customerPhone) === identity);
  const totals = { UZS: { taken: 0, paid: 0, returned: 0, remaining: 0 }, USD: { taken: 0, paid: 0, returned: 0, remaining: 0 } };

  const rows: CustomerHistoryDebt[] = own.map(d => {
    const sale = movements.find(m => m.id === d.movementId);
    const related = sale ? (sale.batchSaleId ? movements.filter(m => m.batchSaleId === sale.batchSaleId) : [sale]) : [];
    const sold = related.filter(m => m.type === 'chiqim' && !m.isReturn);
    const items = sold.map(m => {
      const returnedQty = movements
        .filter(r => (r.type === 'vazvrat' || r.isReturn) && r.originalMovementId === m.id)
        .reduce((s, r) => s + Math.abs(r.quantity), 0);
      return { name: m.productName, quantity: m.quantity, unitPrice: m.unitPrice, total: m.totalRevenue, returnedQty };
    });
    const history = d.paymentHistory || [];
    const returned = history.filter(p => p.method === 'vazvrat').reduce((s, p) => s + p.amount, 0);
    const c = currencyOf(d);
    if (d.cancelledAt) return { debt: d, items, note: d.notes || undefined, payments: history.map(p => ({ date: p.date, amount: p.amount, method: p.method, employeeName: p.employeeName })) };
    totals[c].taken += d.totalDebt;
    totals[c].paid += Math.max(0, d.paidAmount - returned);
    totals[c].returned += returned;
    totals[c].remaining += d.status === 'yopildi' ? 0 : Math.max(0, d.remainingAmount);
    return {
      debt: d,
      items,
      note: items.length ? d.notes : d.notes || undefined,
      payments: history.map(p => ({ date: p.date, amount: p.amount, method: p.method, employeeName: p.employeeName }))
    };
  });

  for (const c of ['UZS', 'USD'] as const) {
    for (const k of ['taken', 'paid', 'returned', 'remaining'] as const) totals[c][k] = roundMoney(totals[c][k], c);
  }
  rows.sort((a, b) => b.debt.createdAt.localeCompare(a.debt.createdAt));
  const withPhone = own.find(d => d.customerPhone && d.customerPhone.replace(/\D/g, '').length >= 9);
  return { name: own[0]?.customerName.trim() || name.trim(), phone: withPhone?.customerPhone || phone || '', debts: rows, totals };
}

/** Bitta nasiyaga to'lov yozadi (o'zgartirmasdan yangi nusxa qaytaradi). Ortiqcha to'lov qoldiq bilan cheklanadi. */
export function applyDebtPayment(
  debt: DebtRecord, amount: number, method: 'naqd' | 'click_payme', nowIso: string, actor?: { id?: string; name?: string }
): { debt: DebtRecord; accepted: number } {
  const accepted = roundMoney(clampDebtPayment(debt, amount), currencyOf(debt));
  if (accepted <= 0) return { debt, accepted: 0 };
  const c = currencyOf(debt);
  const paid = roundMoney(debt.paidAmount + accepted, c);
  const remaining = Math.max(0, roundMoney(debt.totalDebt - paid, c));
  return {
    accepted,
    debt: {
      ...debt,
      paidAmount: paid,
      remainingAmount: remaining,
      status: remaining <= 0 ? 'yopildi' : 'qisman_tolandi',
      paymentHistory: [...(debt.paymentHistory || []), { date: nowIso, amount: accepted, method, employeeId: actor?.id, employeeName: actor?.name }]
    }
  };
}

export interface CustomerPaymentPlan {
  allocations: { debtId: string; amount: number; createdAt: string; remainingBefore: number }[];
  applied: number;
  /** Mijozning shu valyutadagi qarzidan ortib qolgan summa (qabul qilinmaydi). */
  leftover: number;
  totalRemaining: number;
}

/** Mijoz bergan umumiy summani uning faol nasiyalariga eng eskisidan boshlab taqsimlaydi. */
export function planCustomerPayment(debts: DebtRecord[], name: string, phone: string | undefined, currency: Currency, amount: number): CustomerPaymentPlan {
  const anonymous = cleanName("Do'kon mijozi");
  const identity = customerKey(name, phone);
  const active = cleanName(name) === anonymous || !cleanName(name) ? [] : debts
    .filter(d => d.status !== 'yopildi' && d.remainingAmount > 0 && currencyOf(d) === currency && customerKey(d.customerName, d.customerPhone) === identity)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const totalRemaining = roundMoney(active.reduce((s, d) => s + d.remainingAmount, 0), currency);
  let left = Math.max(0, roundMoney(Number(amount) || 0, currency));
  const allocations: CustomerPaymentPlan['allocations'] = [];
  for (const d of active) {
    if (left <= 0) break;
    const part = roundMoney(Math.min(d.remainingAmount, left), currency);
    if (part <= 0) continue;
    allocations.push({ debtId: d.id, amount: part, createdAt: d.createdAt, remainingBefore: d.remainingAmount });
    left = roundMoney(left - part, currency);
  }
  const applied = roundMoney(allocations.reduce((s, a) => s + a.amount, 0), currency);
  return { allocations, applied, leftover: left, totalRemaining };
}

/** Rahbar tahriri: ism, telefon, muddat, izoh; summa faqat savdoga bog'lanmagan (qo'lda) nasiyada. */
export function editDebt(
  debt: DebtRecord,
  changes: { customerName?: string; customerPhone?: string; dueDate?: string; notes?: string; totalDebt?: number },
  by: string | undefined,
  nowIso: string,
  allowTotalChange: boolean
): DebtRecord {
  if (debt.cancelledAt) throw new Error('Bekor qilingan nasiyani tahrirlab bo\'lmaydi.');
  const c = currencyOf(debt);
  const next: DebtRecord = { ...debt };
  const diff: string[] = [];
  const set = <K extends 'customerName' | 'customerPhone' | 'dueDate' | 'notes'>(key: K, label: string) => {
    const v = changes[key];
    if (v === undefined) return;
    const clean = String(v).trim();
    if (key === 'customerName' && !clean) throw new Error('Mijoz ismi bo\'sh bo\'lmasin.');
    if (clean !== String(debt[key] ?? '').trim()) { diff.push(`${label}: "${debt[key] ?? ''}" → "${clean}"`); (next as any)[key] = clean; }
  };
  set('customerName', 'Ism'); set('customerPhone', 'Telefon'); set('dueDate', 'Muddat'); set('notes', 'Izoh');
  if (changes.totalDebt !== undefined && roundMoney(changes.totalDebt, c) !== debt.totalDebt) {
    if (!allowTotalChange) throw new Error("Savdodan yozilgan nasiya summasini o'zgartirib bo'lmaydi — tovar qaytarish (vazvrat) orqali to'g'rilang.");
    const total = roundMoney(changes.totalDebt, c);
    if (!(total > 0)) throw new Error('Summa musbat bo\'lishi kerak.');
    if (total < debt.paidAmount) throw new Error('Summa to\'langan miqdordan kam bo\'lishi mumkin emas.');
    diff.push(`Summa: ${debt.totalDebt} → ${total}`);
    next.totalDebt = total;
    next.remainingAmount = roundMoney(total - debt.paidAmount, c);
    next.status = next.remainingAmount <= 0 ? 'yopildi' : debt.paidAmount > 0 ? 'qisman_tolandi' : 'faol';
  }
  if (!diff.length) return debt;
  next.auditLog = [...(debt.auditLog || []), { date: nowIso, by, action: 'tahrir', details: diff.join('; ') }];
  return next;
}

/** Xato yozilgan (qo'lda) nasiyani bekor qilish: yozuv o'chirilmaydi, qoldiq 0 bo'ladi, sabab tarixda qoladi. */
export function cancelDebt(debt: DebtRecord, reason: string, by: string | undefined, nowIso: string): DebtRecord {
  const why = reason.trim();
  if (why.length < 3) throw new Error('Bekor qilish sababini yozing.');
  if (debt.cancelledAt) return debt;
  return {
    ...debt,
    status: 'yopildi',
    remainingAmount: 0,
    cancelledAt: nowIso,
    auditLog: [...(debt.auditLog || []), { date: nowIso, by, action: 'bekor', details: `Bekor qilindi (qoldiq ${debt.remainingAmount} edi). Sabab: ${why}` }]
  };
}
