import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerDebtTotal, customerDebtHistory, customerLedger, groupDebtsByCustomer, mergeLedgerPayments, planCustomerPayment, restoreDebt, sameCustomerDebts } from './saleAccounting';
import { cancelDebt } from './saleAccounting';
import { applyRefundToDebts } from '../../server/returnLogic';
import type { DebtRecord } from '../types';

let seq = 0;
const debt = (customerName: string, customerPhone: string, remainingAmount: number, createdAt = '2026-11-01T10:00:00Z'): DebtRecord => ({
  id: `d${++seq}`, customerName, customerPhone, totalDebt: remainingAmount, paidAmount: 0, remainingAmount,
  dueDate: '', createdAt, status: 'faol'
});

test('Omadillo: old debt without phone + new sale with phone = one customer', () => {
  const debts = [debt('Omadillo', '+998', 300000), debt('Omadillo', '+998 90 111 22 33', 50000, '2026-11-14T10:00:00Z')];
  const groups = groupDebtsByCustomer(debts);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].remaining, 350000);
  assert.equal(groups[0].phone, '+998 90 111 22 33');
});

test('reverse order: old debt with phone, new sale typed by name only', () => {
  const debts = [debt('Omadillo', '901112233', 300000), debt('omadillo ', '', 50000)];
  assert.equal(groupDebtsByCustomer(debts).length, 1);
  assert.equal(customerDebtTotal(debts, 'Omadillo', '+998 '), 350000);
  assert.equal(customerDebtTotal(debts, 'Omadillo', '+998 90 111 22 33'), 350000);
});

test('case, apostrophe and Cyrillic spellings are one customer', () => {
  const debts = [debt("G'ayrat", '', 1000), debt('GAYRAT', '', 2000), debt('Ғайрат', '', 3000)];
  const groups = groupDebtsByCustomer(debts);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].remaining, 6000);
});

test('same name with two different phones stays two people; phoneless record is not guessed', () => {
  const debts = [debt('Ali', '901111111', 1000), debt('Ali', '902222222', 2000), debt('Ali', '', 4000)];
  assert.equal(groupDebtsByCustomer(debts).length, 3);
  assert.equal(customerDebtTotal(debts, 'Ali', '901111111'), 1000);
});

test('payment by phone covers phoneless old debts, oldest first', () => {
  const debts = [debt('Omadillo', '', 100000, '2026-10-01T10:00:00Z'), debt('Omadillo', '901112233', 50000, '2026-11-10T10:00:00Z')];
  const plan = planCustomerPayment(debts, 'Omadillo', '+998 90 111 22 33', 'UZS', 120000);
  assert.equal(plan.totalRemaining, 150000);
  assert.deepEqual(plan.allocations.map((a) => a.amount), [100000, 20000]);
});

test('history and returns see the whole customer', () => {
  const debts = [debt('Omadillo', '', 100000, '2026-10-01T10:00:00Z'), debt('Omadillo', '901112233', 50000)];
  assert.equal(customerDebtHistory(debts, [], 'Omadillo', '901112233').debts.length, 2);
  assert.equal(sameCustomerDebts(debts, 'OMADILLO', '').length, 2);
  const { applied, debts: after } = applyRefundToDebts(debts, 'Omadillo', '+998 90 111 22 33', 120000, 'VZV-1', '2026-11-14T12:00:00Z', {});
  assert.equal(applied, 120000);
  assert.equal(after[0].remainingAmount, 0);
  assert.equal(after[1].remainingAmount, 30000);
});

test('a debt written with someone else\'s phone does not leak into their account', () => {
  // Nurullo nasiyasi adashib Omadillo telefoni bilan yozilgan.
  const debts = [
    debt('Omadillo', '901112233', 300000),
    debt('Nurullo aka usta', '901112233', 40000),
    debt('Nurullo aka usta', '', 60000),
    debt('Nurullo aka usta', '', 10000)
  ];
  assert.equal(customerDebtTotal(debts, 'Omadillo', '901112233'), 300000);
  assert.equal(customerDebtTotal(debts, 'Nurullo aka usta', ''), 110000);
  const groups = groupDebtsByCustomer(debts);
  assert.equal(groups.length, 2);
  assert.equal(customerDebtHistory(debts, [], 'Omadillo', '+998 90 111 22 33').debts.length, 1);
});

test('same phone with a longer form of the same name stays one customer', () => {
  const debts = [debt('Omadillo', '901112233', 1000), debt('Omadillo aka', '901112233', 2000)];
  assert.equal(groupDebtsByCustomer(debts).length, 1);
});

test('partial payment reduces the customer total; purchases stay visible', () => {
  const a = debt('Omadillo', '901112233', 100000, '2026-10-01T10:00:00Z');
  const b = debt('Omadillo', '', 50000, '2026-11-01T10:00:00Z');
  const plan = planCustomerPayment([a, b], 'Omadillo', '901112233', 'UZS', 30000);
  assert.deepEqual(plan.allocations.map((x) => x.amount), [30000]);
  a.remainingAmount = 70000; a.paidAmount = 30000; a.status = 'qisman_tolandi';
  a.paymentHistory = [{ date: '2026-11-14T09:00:00.000Z', amount: 30000, method: 'naqd' }];
  const ledger = customerLedger([a, b], [], 'Omadillo', '901112233', 'UZS')!;
  assert.equal(ledger.taken, 150000);
  assert.equal(ledger.paid, 30000);
  assert.equal(ledger.remaining, 120000);
  assert.equal(ledger.purchases.length, 2);
});

test('one customer payment split across debts shows as one line', () => {
  const merged = mergeLedgerPayments([
    { date: '2026-11-14T09:00:00.000Z', amount: 70000, method: 'naqd', employeeName: 'Kassir' },
    { date: '2026-11-14T09:00:00.020Z', amount: 30000, method: 'naqd', employeeName: 'Kassir' },
    { date: '2026-11-15T09:00:00.000Z', amount: 5000, method: 'click_payme' }
  ]);
  assert.deepEqual(merged.map((p) => p.amount), [5000, 100000]);
});

test('a mistakenly cancelled debt can be restored with its old balance', () => {
  const original = { ...debt('Nurullo aka usta', '', 80000), totalDebt: 100000, paidAmount: 20000, status: 'qisman_tolandi' as const };
  const cancelled = cancelDebt(original, "noto'g'ri kiritilgan", 'Rahbar', '2026-11-14T10:00:00Z');
  assert.equal(cancelled.remainingAmount, 0);
  const restored = restoreDebt(cancelled, 'Rahbar', '2026-11-14T11:00:00Z');
  assert.equal(restored.cancelledAt, undefined);
  assert.equal(restored.remainingAmount, 80000);
  assert.equal(restored.status, 'qisman_tolandi');
  assert.equal(restored.auditLog?.length, 2);
  assert.equal(customerDebtTotal([restored], 'Nurullo aka usta', ''), 80000);
});
