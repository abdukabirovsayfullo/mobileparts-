import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDraftItem, costChangePercent, lastKirimByProduct, lowStockProducts, marginInfo, recentKirimProductIds } from './kirimHelpers';
import type { Product, StockMovement } from '../types';

const kirim = (id: string, productId: string, unitCost: number, timestamp: string, extra: Partial<StockMovement> = {}): StockMovement => ({
  id, type: 'kirim', productId, productName: productId, category: '', quantity: 5, unitCost, unitPrice: unitCost, totalCost: unitCost * 5,
  totalRevenue: 0, profit: 0, timestamp, counterparty: 'Baza', ...extra
});
const product = (id: string, stock: number, min = 5): Product => ({
  id, name: id, category: 'A', brand: 'B', barcode: id, purchasePrice: 1000, sellingPrice: 2000, stock, minStockAlert: min
});

test('last kirim per product picks the newest receipt and the cost before it', () => {
  const movements = [
    kirim('1', 'p1', 40000, '2026-09-01T10:00:00Z'),
    kirim('2', 'p1', 44000, '2026-10-01T10:00:00Z'),
    kirim('3', 'p1', 99999, '2026-10-02T10:00:00Z', { isReturn: true }),
    kirim('4', 'p2', 5000, '2026-09-15T10:00:00Z'),
    { ...kirim('5', 'p3', 1, '2026-10-03T10:00:00Z'), type: 'chiqim' as const }
  ];
  const map = lastKirimByProduct(movements);
  assert.equal(map.get('p1')!.movement.unitCost, 44000);
  assert.equal(map.get('p1')!.previousCost, 40000);
  assert.equal(map.get('p2')!.previousCost, undefined);
  assert.equal(map.has('p3'), false);
  assert.deepEqual(recentKirimProductIds(movements, 8), ['p1', 'p2']);
  assert.deepEqual(recentKirimProductIds(movements, 1), ['p1']);
});

test('low stock list, margin and cost change helpers', () => {
  assert.deepEqual(lowStockProducts([product('a', 10), product('b', 0), product('c', 3), product('d', 5)]).map((p) => p.id), ['b', 'c', 'd']);
  assert.deepEqual(marginInfo(40000, 50000), { profit: 10000, percent: 25 });
  assert.deepEqual(marginInfo(50000, 40000), { profit: -10000, percent: -20 });
  assert.equal(marginInfo(0, 100).percent, 0);
  assert.equal(costChangePercent(40000, 44000), 10);
  assert.equal(costChangePercent(undefined, 44000), undefined);
});

test('adding the same product at the same prices merges quantities, different prices stay separate', () => {
  const item = (cost: number, qty: number, usd?: number) => ({ product: { id: 'p1' }, quantity: qty, unitCost: cost, unitPrice: 60000, wholesalePrice: 50000, usdCost: usd, usdRate: usd ? 12600 : undefined });
  let list = addDraftItem([], item(40000, 5));
  list = addDraftItem(list, item(40000, 3));
  assert.equal(list.length, 1);
  assert.equal(list[0].quantity, 8);
  list = addDraftItem(list, item(42000, 2));
  assert.equal(list.length, 2);
  list = addDraftItem(list, item(40000, 1, 3.17));
  assert.equal(list.length, 3);
});