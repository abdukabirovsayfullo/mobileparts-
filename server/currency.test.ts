import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { AuthUser } from '../src/types';

const owner: AuthUser = { id: 'owner', name: 'Rahbar', role: 'owner', active: true, createdAt: '2026-01-01T00:00:00Z' };

test('dollar tovar o‘z valyutasida kirim/savdo/nasiya/qaytariladi va so‘m bilan hech qachon aralashmaydi', async (context) => {
  const originalCwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mobileparts-currency-'));
  process.chdir(tempRoot);
  context.after(async () => {
    await new Promise(resolve => setTimeout(resolve, 400)); // scheduleSave kutayotgan yozuvlar tugasin
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const { dataStore } = await import(`./dataStore.ts?currency=${Date.now()}`);
  const { buildReport } = await import('./reportLogic.ts');
  const { calculateShiftTotals } = await import('./shiftLogic.ts');
  const { tashkentDate } = await import('./expenseLogic.ts');

  // --- Kirim: dollar narx o'girilmaydi, tovar valyutasi belgilanadi
  const uzsKirim = dataStore.recordKirim({ items: [{ name: "So'mli kabel", quantity: 10, unitCost: 10000, sellingPrice: 15000 }] });
  const usdKirim = dataStore.recordKirim({ isDebt: true, supplier: 'Dubay', items: [{ name: 'Airpods', quantity: 5, unitCost: 2, sellingPrice: 4.5, wholesalePrice: 3.2, currency: 'USD' }] });
  const uzsId = uzsKirim.movements[0].productId as string;
  const usdId = usdKirim.movements[0].productId as string;
  const usdProduct = dataStore.getProductById(usdId)!;
  assert.equal(usdProduct.currency, 'USD');
  assert.equal(usdProduct.purchasePrice, 2);
  assert.equal(usdProduct.sellingPrice, 4.5);
  assert.equal(usdProduct.wholesalePrice, 3.2);
  assert.equal(usdKirim.totalCost, 10);
  assert.equal(usdKirim.movements[0].currency, 'USD');
  assert.equal(usdKirim.supplierDebt?.currency, 'USD');
  assert.equal(usdKirim.supplierDebt?.remainingAmount, 10);
  assert.equal(dataStore.getProductById(uzsId)!.currency, undefined);

  // --- Valyuta o'zgarmaydi, aralash kirim/savdo rad etiladi va hech narsa yozilmaydi
  assert.throws(() => dataStore.recordKirim({ items: [{ productId: usdId, quantity: 1, unitCost: 30000, currency: 'UZS' }] }), /valyutasi o'zgarmaydi/);
  assert.throws(() => dataStore.recordKirim({ items: [{ productId: uzsId, quantity: 1, unitCost: 1000 }, { productId: usdId, quantity: 1, unitCost: 1 }] }), /bitta valyuta/);
  assert.throws(() => dataStore.recordSale({ items: [{ productId: uzsId, quantity: 1 }, { productId: usdId, quantity: 1 }] }), /bitta valyuta/);
  assert.equal(dataStore.getProductById(usdId)!.stock, 5);
  assert.equal(dataStore.getProductById(uzsId)!.stock, 10);

  // --- Dollarda savdo (nasiya), chegirma sent bilan
  const sale = dataStore.recordSale({ items: [{ productId: usdId, quantity: 3 }], paymentMethod: 'nasiya', customerName: 'Akmal', customerPhone: '+998 90 111 22 33', discount: 0.5, employeeId: 'w1' });
  assert.equal(sale.totalRevenue, 13);
  assert.equal(sale.totalCost, 6);
  assert.equal(sale.totalProfit, 7);
  assert.equal(sale.movements[0].currency, 'USD');
  assert.equal(sale.debtRecord?.currency, 'USD');
  assert.equal(sale.debtRecord?.totalDebt, 13);
  await new Promise(resolve => setTimeout(resolve, 5)); // nasiya ID'si millisekundga asoslangan: ikkita nasiya bir xil ID olmasin
  const uzsSale = dataStore.recordSale({ items: [{ productId: uzsId, quantity: 2 }], paymentMethod: 'nasiya', customerName: 'Akmal', customerPhone: '+998 90 111 22 33', employeeId: 'w1' });
  assert.equal(uzsSale.totalRevenue, 30000);
  assert.equal(uzsSale.debtRecord?.currency, undefined);

  // --- Nasiya to'lovi dollarda (sent), ortiqcha to'lov rad etiladi
  const paid = dataStore.recordDebtPayment(sale.debtRecord!.id, 5.25);
  assert.equal(paid.paidAmount, 5.25);
  assert.equal(paid.remainingAmount, 7.75);
  assert.throws(() => dataStore.recordDebtPayment(sale.debtRecord!.id, 8), /qoldiq/);

  // --- Qaytarish: dollar nasiyadan ayriladi, so'mli nasiya o'zgarmaydi
  const ret = dataStore.recordReturn({ lines: [{ movementId: sale.movements[0].id, quantity: 1 }], reason: 'Nuqson bor', refundMethod: 'nasiya', user: owner });
  assert.equal(ret.totalRefund, 4.33);
  assert.equal(ret.movements[0].currency, 'USD');
  const debts = dataStore.getState().debts;
  assert.equal(debts.find((d: { id: string }) => d.id === sale.debtRecord!.id)!.remainingAmount, 3.42);
  assert.equal(debts.find((d: { id: string }) => d.id === uzsSale.debtRecord!.id)!.remainingAmount, 30000);

  // --- Onlayn (Telegram) do'kon faqat so'mda: dollarli tovar rad etiladi, qoldiq o'zgarmaydi
  const stockBefore = dataStore.getProductById(usdId)!.stock;
  assert.throws(() => dataStore.recordOnlineOrder({ items: [{ productId: usdId, quantity: 1 }], customerName: 'X', customerPhone: '+998 90 000 00 00' } as never), /Dollarli tovarlar/);
  assert.equal(dataStore.getProductById(usdId)!.stock, stockBefore);

  // --- Hisobot: so'm hisoboti dollarni o'z ichiga olmaydi, dollar alohida
  const report = buildReport(dataStore.getState(), '2000-01-01', '2099-12-31') as { sales: { revenue: number }; usd?: { sales: { revenue: number; cost: number; grossProfit: number }; inventory: { currentCostValue: number }; debts: { remaining: number } } };
  assert.equal(report.sales.revenue, 30000);
  assert.ok(report.usd);
  assert.equal(report.usd!.sales.revenue, 8.67); // 13 - qaytarilgan 4.33
  assert.equal(report.usd!.debts.remaining, 3.42);
  assert.equal(report.usd!.inventory.currentCostValue, 6); // 5 - 3 sotildi + 1 qaytdi = 3 dona x $2

  // --- Kassa smenasi faqat so'mda: dollarli naqd savdo kutilgan so'm naqd pulga qo'shilmaydi
  dataStore.recordSale({ items: [{ productId: usdId, quantity: 1 }], paymentMethod: 'naqd', employeeId: 'w1' });
  dataStore.recordSale({ items: [{ productId: uzsId, quantity: 1 }], paymentMethod: 'naqd', employeeId: 'w1' });
  const shift = calculateShiftTotals(dataStore.getState().movements, [], 'w1', tashkentDate(), 0, dataStore.getState().debts);
  assert.equal(shift.cashRevenue, 15000);
  assert.equal(shift.expectedCash, 15000);
});
