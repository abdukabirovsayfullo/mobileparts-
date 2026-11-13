import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeBrowserSnapshot } from './browserSync';
const state = (stock: number, movements: any[] = []) => ({ products: [{ id: 'p', stock, name: 'Test' }], movements, debts: [], supplierDebts: [], categories: ['EKRAN'], storeInfo: {} });
test('new catalog card survives a server revision conflict', () => {
  const base = state(5), local = state(5), remote = state(4, [{ id: 's', productId: 'p', type: 'chiqim', quantity: 1 }]);
  local.products.push({ id: 'new', name: 'New', stock: 0 });
  const merged = mergeBrowserSnapshot(base, local, remote);
  assert.equal(merged.products.find(p => p.id === 'new')?.stock, 0);
  assert.equal(merged.products.find(p => p.id === 'p')?.stock, 4);
});
test('return and concurrent sale both survive refresh', () => {
  const ret = { id: 'r', productId: 'p', type: 'vazvrat', quantity: 2 };
  const sale = { id: 's', productId: 'p', type: 'chiqim', quantity: 1 };
  const merged = mergeBrowserSnapshot(state(5), state(7, [ret]), state(4, [sale]));
  assert.equal(merged.products[0].stock, 6);
  assert.deepEqual(new Set(merged.movements.map(m => m.id)), new Set(['r', 's']));
});
test('a return already accepted before a lost response is counted once', () => {
  const ret = { id: 'r', productId: 'p', type: 'vazvrat', quantity: 2 };
  const sale = { id: 's', productId: 'p', type: 'chiqim', quantity: 1 };
  const merged = mergeBrowserSnapshot(state(5), state(7, [ret]), state(6, [sale, ret]));
  assert.equal(merged.products[0].stock, 6);
  assert.equal(merged.movements.length, 2);
});
test('a shared debt refund is not deducted twice during a conflict', () => {
  const base: any = state(5), local: any = state(5), remote: any = state(5);
  const debt = { id: 'd', totalDebt: 10000, paidAmount: 0, remainingAmount: 10000, status: 'faol', paymentHistory: [] };
  base.debts = [debt];
  const payment = { amount: 2000, date: '2026-11-13T10:00:00Z', method: 'vazvrat' };
  local.debts = [{ ...debt, paidAmount: 2000, remainingAmount: 8000, status: 'qisman_tolandi', paymentHistory: [payment] }];
  remote.debts = structuredClone(local.debts);
  remote.categories.push('NEW');
  const merged = mergeBrowserSnapshot(base, local, remote);
  assert.equal(merged.debts[0].paidAmount, 2000);
  assert.equal(merged.debts[0].remainingAmount, 8000);
});
