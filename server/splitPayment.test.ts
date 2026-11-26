import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { allocateSplitPayment, movementMethodAmount } from '../src/utils/paymentParts';
import { calculateShiftTotals } from './shiftLogic';
import { buildCashBook, tashkentDay } from '../src/utils/cashBook';

test('split cash is spread over lines and always sums exactly', () => {
  const parts = allocateSplitPayment([10000, 25000, 3333], 20000);
  assert.equal(parts.reduce((s, p) => s + p.naqd, 0), 20000);
  assert.equal(parts.reduce((s, p) => s + p.click_payme, 0), 38333 - 20000);
  parts.forEach((p, i) => assert.equal(p.naqd + p.click_payme, [10000, 25000, 3333][i]));
});

test('aralash sale: cash part goes to kassa, click part to click, no debt', async ctx => {
  const cwd = process.cwd(), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'split-pay-')); process.chdir(temp);
  ctx.after(async () => { await new Promise(r => setTimeout(r, 400)); process.chdir(cwd); fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const { dataStore } = await import('./dataStore.ts?split=' + Date.now());
  const k = dataStore.recordKirim({ items: [{ name: 'KABEL', quantity: 5, unitCost: 5000, sellingPrice: 30000 }, { name: 'QULOQCHIN', quantity: 5, unitCost: 20000, sellingPrice: 70000 }] });
  const [a, b] = k.movements.map((m: any) => m.productId);
  const before = JSON.stringify(dataStore.getState());
  assert.throws(() => dataStore.recordSale({ items: [{ productId: a, quantity: 1 }], paymentMethod: 'aralash', cashPart: 30000 }), /naqd qism/);
  assert.throws(() => dataStore.recordSale({ items: [{ productId: a, quantity: 1 }], paymentMethod: 'aralash' }), /naqd qism/);
  assert.equal(JSON.stringify(dataStore.getState()), before);
  const sale = dataStore.recordSale({ items: [{ productId: a, quantity: 1 }, { productId: b, quantity: 1 }], paymentMethod: 'aralash', cashPart: 40000 });
  assert.equal(sale.totalRevenue, 100000);
  assert.equal(sale.debtRecord, undefined);
  assert.ok(sale.movements.every((m: any) => m.paymentMethod === 'aralash'));
  assert.equal(sale.movements.reduce((s: number, m: any) => s + movementMethodAmount(m, 'naqd'), 0), 40000);
  assert.equal(sale.movements.reduce((s: number, m: any) => s + movementMethodAmount(m, 'click_payme'), 0), 60000);
  const state = dataStore.getState();
  const day = tashkentDay(sale.movements[0].timestamp);
  const shift = calculateShiftTotals(state.movements, [], null, day, 0, state.debts);
  assert.equal(shift.cashRevenue, 40000);
  assert.equal(shift.clickRevenue, 60000);
  assert.equal(shift.expectedCash, 40000);
  const book = buildCashBook(state.movements, state.debts, day);
  assert.equal(book.salesTotal, 40000);
});
