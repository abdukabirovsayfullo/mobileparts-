import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import readline from 'node:readline/promises';

const source = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(process.env.LOCALAPPDATA, 'MobilePartsCRM');
const data = path.join(target, 'data');
const url = 'http://127.0.0.1:3318';

async function install() {
  const updating = fs.existsSync(data);
  const wasRunning = updating && await running();
  if (!updating) {
    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    const token = (await input.question('VPS ulash kodini kiriting: ')).trim();
    input.close();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Ulash kodi noto‘g‘ri.');
    const response = await fetch('https://77-81-138-243.sslip.io/api/device-sync/state', {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('VPS bilan ulanib bo‘lmadi. Kod va internetni tekshiring.');
    const { revision, state } = await response.json();
    if (!/^[a-f0-9]{64}$/.test(revision) || !Array.isArray(state?.pos?.products) ||
        !Array.isArray(state?.auth?.users) || !Array.isArray(state?.repairs?.orders)) {
      throw new Error('VPS bazasini yuklab bo‘lmadi.');
    }

    fs.mkdirSync(target, { recursive: true });
    for (const name of ['node.exe', 'dist', 'offline-device.mjs', 'NODE-LICENSE.txt']) {
      fs.cpSync(path.join(source, name), path.join(target, name), { recursive: true });
    }
    const stage = fs.mkdtempSync(path.join(target, '.data-setup-'));
    const files = {
      'pos_database.json': JSON.stringify(state.pos),
      'auth.json': JSON.stringify(state.auth),
      'repairs.json': JSON.stringify(state.repairs),
      'device-token': token,
      'device-baseline': revision,
      'device-baseline.json': JSON.stringify(state)
    };
    for (const [name, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(stage, name), contents, { mode: 0o600 });
    }
    fs.renameSync(stage, data);
  } else {
    for (const name of ['dist', 'offline-device.mjs']) {
      fs.cpSync(path.join(source, name), path.join(target, name), { recursive: true });
    }
  }

  if (!process.argv.includes('--native-shortcut')) {
    const desktop = execFileSync('powershell.exe', [
      '-NoProfile', '-Command', "[Console]::OutputEncoding = [Text.Encoding]::UTF8; [Environment]::GetFolderPath('DesktopDirectory')"
    ], { encoding: 'utf8', windowsHide: true }).trim();
    const escapeCmd = text => text.replaceAll('%', '%%');
    fs.writeFileSync(path.join(desktop, 'Mobile Parts CRM.cmd'),
      `@echo off\r\nchcp 65001 >nul\r\n"${escapeCmd(path.join(target, 'node.exe'))}" "${escapeCmd(path.join(target, 'offline-device.mjs'))}"\r\nif errorlevel 1 pause\r\n`);
  }
  console.log('CRM fayllari tayyor. Ish stolida Mobile Parts CRM yorlig‘i bor.');
  if (wasRunning) {
    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    await input.question('Yangilanish ishlashi uchun Windowsni qayta yuklang. Davom etish uchun Enter bosing.');
    input.close();
  }
  return !wasRunning;
}

async function running() {
  try {
    const response = await fetch(url + '/api/device-sync/status', { signal: AbortSignal.timeout(1000) });
    return response.ok && typeof (await response.json()).status === 'string';
  } catch { return false; }
}

async function open() {
  if (!(await running())) {
    const log = fs.openSync(path.join(target, 'crm.log'), 'a');
    const child = spawn(path.join(target, 'node.exe'), ['dist/server.cjs'], {
      cwd: target, detached: true, windowsHide: true, stdio: ['ignore', log, log],
      env: { ...process.env, PORT: '3318', NODE_ENV: 'production', POS_LOCAL_DEVICE: '1' }
    });
    child.unref();
    fs.closeSync(log);
    for (let attempt = 0; attempt < 20 && !(await running()); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  if (!(await running())) throw new Error('CRM ishga tushmadi. %LOCALAPPDATA%\\MobilePartsCRM\\crm.log faylini tekshiring.');
  spawn('explorer.exe', [url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

try {
  if (process.argv[2] !== 'install' || await install()) await open();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
