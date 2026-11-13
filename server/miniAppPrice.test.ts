import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { miniAppPrice, isAccessoryCategory } from '../src/utils/miniAppPrice';

test('both prices are limited to accessories, including cables and chargers', () => {
  for (const category of ['AKSESUAR', 'Kabellar', 'Zaryadniklar', 'Avto Aksessuarlar', 'Powerbanklar', 'Himoya Oynalari', 'Chexollar', 'STEKLO', 'NAUSHNIK']) assert.equal(isAccessoryCategory(category), true);
  for (const category of ['EKRAN', 'ORGINAL EKRAN', 'INSTRUMENT', 'KORPUS', 'KRISHKA', 'OCA', 'TELEFON']) assert.equal(isAccessoryCategory(category), false);
});

test('legacy products without a positive wholesale price retain their regular price', () => {
  for (const wholesalePrice of [undefined, 0, -1, NaN]) {
    assert.equal(miniAppPrice({ wholesalePrice, sellingPrice: 9500 }), 9500);
  }
  assert.equal(miniAppPrice({ wholesalePrice: 3200, sellingPrice: 10000 }), 3200);
});

test('public catalog and order totals use server wholesale prices despite a forged client price', async () => {
  const originalCwd = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'mp-wholesale-test-')));
  process.env.POS_OWNER_PIN = '6719';
  const { dataStore } = await import('./dataStore');
  const { apiV1Router } = await import('./apiV1');
  const product = dataStore.saveProduct({ name: 'Kabel test', category: 'Kabellar', brand: 'Test', barcode: 'WHOLESALE-TEST', stock: 10, purchasePrice: 2500, wholesalePrice: 4000, sellingPrice: 10000, minStockAlert: 1 });
  const screen = dataStore.saveProduct({ name: 'Ekran test', category: 'EKRAN', brand: 'Test', barcode: 'SCREEN-TEST', stock: 1, purchasePrice: 50000, wholesalePrice: 70000, sellingPrice: 100000, minStockAlert: 1 });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiV1Router);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/api/v1/telegram/miniapp`;
    const catalog = await (await fetch(base + '/products')).json();
    const shown = catalog.products.find((p: { id: string }) => p.id === product.id);
    assert.equal(shown.price, 4000);
    assert.equal(shown.sellingPrice, 4000);
    assert.equal(shown.wholesalePrice, 4000);
    assert.equal(shown.retailPrice, 10000);
    assert.equal('purchasePrice' in shown, false);
    const shownScreen = catalog.products.find((p: { id: string }) => p.id === screen.id);
    assert.equal(shownScreen.price, 70000);
    assert.equal('retailPrice' in shownScreen, false);
    const response = await fetch(base + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ productId: product.id, quantity: 2, unitPrice: 1 }], customerName: 'Test', customerPhone: '+998901234567', paymentMethod: 'naqd', deliveryType: 'yetkazib_berish' }) });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.order.items[0].unitPrice, 4000);
    assert.equal(result.order.subtotal, 8000);
    assert.equal(result.totalAmount, 23000);
    assert.equal(result.receipt.items[0].unitPrice, 4000);
    assert.equal(dataStore.getProductById(product.id)?.stock, 8);
    const movement = dataStore.getState().movements.find(m => m.batchSaleId && m.productId === product.id);
    assert.equal(movement?.totalRevenue, 8000);
    assert.equal(movement?.profit, 3000);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await new Promise(resolve => setTimeout(resolve, 400));
    process.chdir(originalCwd);
  }
});
