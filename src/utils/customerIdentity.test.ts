import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerDebtTotal, customerDebtHistory, groupDebtsByCustomer, planCustomerPayment, sameCustomerDebts } from './saleAccounting';
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
