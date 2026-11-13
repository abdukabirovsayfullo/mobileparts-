import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { lastSunday, weeklyMessage, debtsForCustomer } from './customerTelegramLogic';

test('Telegram management responds with 401 instead of hanging without a session', async () => {
  const originalCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-telegram-route-test-'));
  process.chdir(root);
  process.env.POS_OWNER_PIN = '6719';
  const { installCustomerTelegram } = await import('./customerTelegram');
  const app = express();
  installCustomerTelegram(app, true);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/customer-telegram`, { signal: AbortSignal.timeout(2000) });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    process.chdir(originalCwd);
  }
});

test('Sunday cutoff uses Tashkent time, including the exact boundary', () => {
  const sunday = Date.parse('2026-11-15T04:00:00Z');
  assert.equal(lastSunday(sunday, 9), sunday);
  assert.equal(lastSunday(sunday - 1, 9), sunday - 7 * 86400000);
  assert.equal(lastSunday(sunday + 3 * 86400000, 9), sunday);
});

test('weekly statement includes payments on old debts and keeps currencies separate', () => {
  const customer = { id: 'c', name: 'Mijoz', phone: '+998901234567', address: '' };
  const debts = [{
    id: 'd1', customerName: 'Mijoz', customerPhone: customer.phone, totalDebt: 10000,
    paidAmount: 3000, remainingAmount: 7000, dueDate: '', createdAt: '2026-11-01T10:00:00Z', status: 'qisman_tolandi' as const,
    paymentHistory: [{ date: '2026-11-12T10:00:00Z', amount: 3000, method: 'naqd' as const }]
  }, {
    id: 'd2', customerName: 'Mijoz', customerPhone: customer.phone, totalDebt: 6500,
    paidAmount: 500, remainingAmount: 6000, dueDate: '', createdAt: '2026-11-12T11:00:00Z', status: 'qisman_tolandi' as const,
    paymentHistory: [{ date: '2026-11-12T11:00:00Z', amount: 500, method: 'naqd' as const }]
  }];
  const result = weeklyMessage(customer, debts, [], Date.parse('2026-11-15T04:00:00Z')).replace(/[\s\u00a0]/g, '');
  assert.ok(result.includes('Avvalgiqarz:10000'));
  assert.ok(result.includes('Haftalikxaridlar:6500'));
  assert.ok(result.includes('To‘lovlarvaqaytarishlar:3500'));
  assert.ok(result.includes('Jamiqolganqarz:13000'));
  assert.equal(debtsForCustomer({ ...customer, phone: '+998909999999' }, [customer], debts).length, 0);
});

test('link approval, offline sale, durable queue, retry and weekly deduplication', async () => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-customer-telegram-test-'));
  process.chdir(root);
  process.env.POS_OWNER_PIN = '6719';
  let updates: unknown[] = [];
  const deliveries: string[] = [];
  let retryOnce = false;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const method = String(input).split('/').pop();
    const payload = JSON.parse(String(init?.body ?? '{}'));
    let result: unknown = {};
    if (method === 'getMe') result = { id: 123, username: 'test_customer_bot' };
    if (method === 'getWebhookInfo') result = { url: '' };
    if (method === 'getUpdates') { result = updates; updates = []; }
    if (method === 'sendMessage') {
      if (retryOnce) {
        retryOnce = false;
        return new Response(JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 1 } }));
      }
      deliveries.push(payload.text);
      result = { message_id: deliveries.length };
    }
    return new Response(JSON.stringify({ ok: true, result }));
  }) as typeof fetch;
  try {
    const { dataStore } = await import('./dataStore');
    const { CustomerTelegram } = await import('./customerTelegram');
    const customer = dataStore.upsertCustomer({ name: 'Test nasiya', phone: '+998901234567' });
    const product = dataStore.saveProduct({
      name: 'Test kabel', category: 'Kabellar', brand: 'Test', barcode: 'TG-TEST',
      stock: 20, purchasePrice: 1000, wholesalePrice: 5000, sellingPrice: 6500, minStockAlert: 1
    });
    const stateFile = path.join(root, 'telegram.json');
    let service = new CustomerTelegram(stateFile);
    await service.configure({ token: 'test-token', enabled: true, weeklyHour: 9 });
    const pair = service.pair(customer.id);
    const nonce = new URL(pair.url).searchParams.get('start');
    updates = [{ update_id: 1, message: { chat: { id: 55, type: 'private' }, from: { first_name: 'Test' }, text: '/start ' + nonce } }];
    await service.tick();
    assert.equal(service.overview().links[0].connected, false);
    assert.equal(service.overview().links[0].pending, true);
    assert.ok(deliveries.every(text => !text.includes('qarz:')));
    service.approve(customer.id);
    await service.tick();
    const before = deliveries.length;
    dataStore.recordSale({
      items: [{ productId: product.id, quantity: 1, unitPrice: 6500 }],
      customerName: customer.name, customerPhone: customer.phone,
      paymentMethod: 'nasiya', paidNow: 0, receiptNumber: 'TG-NASIYA-1'
    });
    retryOnce = true;
    await service.tick();
    assert.equal(service.overview().queued, 1);
    service = new CustomerTelegram(stateFile);
    await service.tick(Date.now() + 600000);
    assert.equal(deliveries.length, before + 1);
    assert.ok(deliveries.at(-1)?.includes('Test kabel — 1 dona'));
    assert.ok(deliveries.at(-1)?.includes('6'));
    await service.tick(Date.now() + 600000);
    assert.equal(deliveries.length, before + 1);
    const sunday = lastSunday(Date.now(), 9) + 7 * 86400000;
    await service.tick(sunday);
    const sent = deliveries.length;
    assert.ok(deliveries.at(-1)?.includes('Haftalik nasiya hisobi'));
    await service.tick(sunday + 5000);
    assert.equal(deliveries.length, sent);
    assert.equal(service.overview().queued, 0);
    const history = service.overview().jobs;
    assert.ok(history.some(job => job.status === 'sent' && job.sentAt && job.text.includes('Haftalik nasiya hisobi')));
    assert.equal('chatId' in history[0], false);
    assert.equal('token' in service.overview(), false);
    service.disconnect(customer.id);
    assert.equal(service.overview().links[0].connected, false);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
});
