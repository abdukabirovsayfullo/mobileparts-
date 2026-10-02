import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

test('PIN login, server lockout and owner-only user management', async (context) => {
  const originalCwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mobileparts-auth-'));
  process.chdir(tempRoot);
  process.env.POS_OWNER_PIN = '9876';
  context.after(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const { authRouter } = await import(`./auth.ts?test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  const server = app.listen(0);
  context.after(() => server.close());
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/auth`;

  const publicUsers = await fetch(`${base}/users`).then(response => response.json()) as { users: Array<{ id: string }> };
  assert.equal(publicUsers.users[0]?.id, 'owner');

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.10' },
      body: JSON.stringify({ userId: 'owner', pin: '0000' })
    });
    assert.equal(response.status, attempt === 5 ? 429 : 401);
  }

  const ownerLogin = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.11' },
    body: JSON.stringify({ userId: 'owner', pin: '9876' })
  });
  assert.equal(ownerLogin.status, 200);
  const ownerCookie = ownerLogin.headers.get('set-cookie');
  assert(ownerCookie?.includes('HttpOnly'));

  const createWorker = await fetch(`${base}/manage/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ownerCookie || '' },
    body: JSON.stringify({ name: 'Test Kassir', pin: '4321' })
  });
  assert.equal(createWorker.status, 201);
  const created = await createWorker.json() as { user: { id: string } };

  const workerLogin = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: created.user.id, pin: '4321' })
  });
  const workerCookie = workerLogin.headers.get('set-cookie');
  const forbidden = await fetch(`${base}/manage/users`, { headers: { Cookie: workerCookie || '' } });
  assert.equal(forbidden.status, 403);

  const authFile = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'auth.json'), 'utf8')) as { users: Array<Record<string, unknown>> };
  assert.equal('pin' in authFile.users[0], false);
  assert.match(String(authFile.users[0].pinHash), /^scrypt\$/);
});
