import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test("to'langan chekdan nasiyaga qaytarish mijozning jami qarzidan ayriladi", async (ctx) => {
  const cwd = process.cwd();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'return-total-'));
  process.chdir(temp);
  ctx.after(async () => { await new Promise(r => setTimeout(r, 500)); process.chdir(cwd); fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const { dataStore } = await import('./dataStore.ts?total=' + Date.now());
  const user: any = { id: 'owner', name: 'Rahbar', role: 'owner' };
  const k = dataStore.recordKirim({ items: [{ name: 'REDMI 10 LCD PRO', quantity: 10, unitCost: 60000, sellingPrice: 90000 }] });
  const productId = k.movements[0].productId;
  const older = dataStore.recordSale({ items: [{ productId, quantity: 1 }], paymentMethod: 'nasiya', customerName: 'Hojambar', customerPhone: '901112233' });
  const newer = dataStore.recordSale({ items: [{ productId, quantity: 2 }], paymentMethod: 'nasiya', customerName: 'Hojambar', customerPhone: '901112233' });
  // Mijoz 90 000 to'ladi: eng eski chek yopildi, umumiy qarz 180 000 qoldi.
  dataStore.recordCustomerPayment({ name: 'Hojambar', phone: '901112233', amount: 90000, method: 'naqd' }, user);
  assert.equal(dataStore.getState().debts.find(d => d.id === older.debtRecord!.id)!.remainingAmount, 0);

  const result = dataStore.recordReturn({ lines: [{ movementId: older.movements[0].id, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'nasiya', user });
  assert.equal(result.debtReduced, 90000);
  assert.equal(dataStore.getState().debts.find(d => d.id === newer.debtRecord!.id)!.remainingAmount, 90000);

  // Qarz qolmasa — aniq xato, hech narsa o'zgarmaydi.
  dataStore.recordCustomerPayment({ name: 'Hojambar', phone: '901112233', amount: 90000, method: 'naqd' }, user);
  const before = JSON.stringify(dataStore.getState());
  assert.throws(() => dataStore.recordReturn({ lines: [{ movementId: newer.movements[0].id, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'nasiya', user }), /jami ochiq qarzi/);
  assert.equal(JSON.stringify(dataStore.getState()), before);
});
