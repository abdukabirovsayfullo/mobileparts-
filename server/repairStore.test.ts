import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('repair orders get sequential numbers and persist status', async context => {
  const originalCwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mobileparts-repairs-'));
  process.chdir(tempRoot);
  context.after(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const { repairStore } = await import(`./repairStore.ts?test=${Date.now()}`);
  repairStore.resetForTests();
  const first = repairStore.create({ customerName: 'Ali', customerPhone: '901234567', deviceModel: 'Samsung A52', deviceColor: 'qora', complaint: 'Ekran ishlamaydi', agreedPrice: 350000, advance: 50000, dueDate: '2026-10-07', dueTime: '18:00' });
  const second = repairStore.create({ customerName: 'Vali', customerPhone: '909999999', deviceModel: 'iPhone 12', complaint: 'Quvvat olmaydi', dueDate: '2026-10-08' });
  assert.equal(first.orderNumber, 1);
  assert.equal(second.orderNumber, 2);
  assert.equal(repairStore.update(first.id, { status: 'ready' }).status, 'ready');
  assert.equal(repairStore.list()[0].id, second.id);
  assert.equal(fs.existsSync(path.join(tempRoot, 'data', 'repairs.json')), true);
});
