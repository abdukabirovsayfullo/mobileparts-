import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerOptions, normalizeSearchText, searchCustomerOptions } from './customerSearch';
import type { CustomerProfile, DebtRecord } from '../types';

const customer = (name: string, phone = '', address = ''): CustomerProfile => ({ id: name, name, phone, address });
const debt = (customerName: string, remainingAmount: number, customerPhone = '', extra: Partial<DebtRecord> = {}): DebtRecord => ({
  id: `${customerName}-${remainingAmount}`, customerName, customerPhone, totalDebt: remainingAmount, paidAmount: 0,
  remainingAmount, dueDate: '2026-12-01', createdAt: '2026-11-01T10:00:00Z', status: 'faol', ...extra
});

test('normalizes case, apostrophes and Cyrillic', () => {
  assert.equal(normalizeSearchText("  NURULLO  aka "), 'nurullo aka');
  assert.equal(normalizeSearchText("G'ayrat O‘tkir"), 'gayrat otkir');
  assert.equal(normalizeSearchText('Нурулло ака'), 'nurullo aka');
});

test('prefix of a regular customer name finds them', () => {
  const options = buildCustomerOptions([customer('Kozimjon'), customer('Nurullo aka usta', '+998 90 123 45 67')], []);
  const found = searchCustomerOptions(options, 'NURU');
  assert.equal(found[0]?.name, 'Nurullo aka usta');
});

test('words in any order match', () => {
  const options = buildCustomerOptions([customer('Nurullo aka usta')], []);
  assert.equal(searchCustomerOptions(options, 'usta nur').length, 1);
});

test('Cyrillic stored name is found with Latin query', () => {
  const options = buildCustomerOptions([customer('Нурулло уста')], []);
  assert.equal(searchCustomerOptions(options, 'nurul').length, 1);
});

test('debtor missing from the regular list still appears with debt', () => {
  const options = buildCustomerOptions([customer('Kozimjon')], [debt('NURULLO AKA USTA', 250000), debt('NURULLO AKA USTA', 50000)]);
  const [hit] = searchCustomerOptions(options, 'nuru');
  assert.equal(hit.name, 'NURULLO AKA USTA');
  assert.equal(hit.debtUZS, 300000);
  assert.equal(hit.activeDebts.length, 2);
});

test('debt merges into the matching customer by name or phone', () => {
  const options = buildCustomerOptions(
    [customer('Nurullo aka usta', '+998901234567')],
    [debt('nurullo aka usta', 100000), debt('Nurullo', 20, '90 123 45 67', { currency: 'USD' })]
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].debtUZS, 100000);
  assert.equal(options[0].debtUSD, 20);
});

test('closed debts are ignored and placeholder names are skipped', () => {
  const options = buildCustomerOptions([customer("Do'kon mijozi")], [debt('Ali', 1000, '', { status: 'yopildi' })]);
  assert.equal(options.length, 0);
});

test('search by phone digits', () => {
  const options = buildCustomerOptions([customer('Nurullo', '+998 90 123 45 67')], []);
  assert.equal(searchCustomerOptions(options, '4567')[0]?.name, 'Nurullo');
});

test('empty query lists debtors first', () => {
  const options = buildCustomerOptions([customer('Ali'), customer('Vali')], [debt('Vali', 5000)]);
  assert.equal(searchCustomerOptions(options, "Do'kon mijozi")[0]?.name, 'Vali');
});

test('remote server hits are merged without duplicates', () => {
  const options = buildCustomerOptions(
    [customer('Nurullo aka usta')],
    [],
    [customer('Nurullo aka usta'), customer('Nurbek')],
    [{ id: 'd1', customerName: 'Nurbek', remainingAmount: 70000 }, { id: 'd1', customerName: 'Nurbek', remainingAmount: 70000 }]
  );
  assert.equal(options.length, 2);
  assert.equal(options.find((o) => o.name === 'Nurbek')?.debtUZS, 70000);
});
