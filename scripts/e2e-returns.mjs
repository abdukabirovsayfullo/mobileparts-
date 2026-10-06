import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(import.meta.dirname, '..');
const PORT = 3177;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-e2e-'));
fs.mkdirSync(path.join(tmp, 'data'));
let server;
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond, name, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); };

function start() {
  server = spawn(process.execPath, [path.join(REPO, 'node_modules/tsx/dist/cli.mjs'), path.join(REPO, 'server.ts')], {
    cwd: tmp, env: { ...process.env, PORT: String(PORT), POS_OWNER_PIN: '2508', NODE_ENV: 'development', DISABLE_HMR: 'true' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr.on('data', d => { const t = String(d); if (/error/i.test(t) && !/vite|esbuild/i.test(t)) console.log('[server err]', t.trim().slice(0, 200)); });
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(async () => {
      try { const r = await fetch(`${BASE}/health`); if (r.ok) { clearInterval(timer); resolve(); } } catch { /* wait */ }
      if (Date.now() - t0 > 60000) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 500);
  });
}
const stop = () => new Promise(resolve => { if (!server) return resolve(); server.once('exit', resolve); server.kill(); setTimeout(resolve, 3000); });

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body) {
    const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie'); if (set) this.cookie = set.split(';')[0];
    let data = null; try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
  }
  get(u) { return this.req('GET', u); }
  post(u, b) { return this.req('POST', u, b); }
}

try {
  await start();
  const owner = new Client();
  let r = await owner.post('/auth/login', { userId: 'owner', pin: '2508' });
  ok('Rahbar kirishi', r.status === 200, String(r.status));
  r = await owner.post('/auth/manage/users', { name: 'Test Ishchi', pin: '1234' });
  const workerId = r.data?.user?.id;
  ok('Ishchi yaratildi', r.status === 201 && !!workerId);
  r = await owner.post('/products', { name: 'TEST OYNA', category: 'Oyna', brand: 'T', barcode: 'TST001', purchasePrice: 12000, sellingPrice: 20000, wholesalePrice: 16000, stock: 10, minStockAlert: 1 });
  const productId = r.data?.data?.id;
  ok('Mahsulot yaratildi', (r.status === 201 || r.status === 200) && !!productId, String(r.status));

  const worker = new Client();
  r = await worker.post('/auth/login', { userId: workerId, pin: '1234' });
  ok('Ishchi kirishi', r.status === 200);

  r = await worker.get('/sync');
  const wp = r.data?.state?.products?.find(p => p.id === productId);
  ok('Ishchi /sync: optom narx saqlanadi, tannarx yashirin', wp?.wholesalePrice === 16000 && wp?.purchasePrice === 0 && wp?.costPrice === 0, JSON.stringify(wp));
  const workerRevision = r.data?.serverTimestamp;
  r = await worker.get(`/sync?since=${encodeURIComponent(workerRevision)}`);
  ok('O\'zgarish bo\'lmasa /sync ortiqcha ma\'lumot yubormaydi (304)', r.status === 304, String(r.status));

  // Sotuv (naqd, 3 dona) — ishchi
  r = await worker.post('/sales', { items: [{ productId, quantity: 3, unitPrice: 20000 }], paymentMethod: 'naqd', customerName: 'Naqd Mijoz' });
  const sale = r.data?.data;
  ok('Ishchi sotdi', r.status === 201 && sale?.movements?.length === 1, String(r.status));
  const movementId = sale?.movements?.[0]?.id;

  // Qidiruv
  r = await worker.get('/returns/search?q=');
  const found = r.data?.data?.find(g => g.lines.some(l => l.movementId === movementId));
  ok('Qaytarish qidiruvi sotuvni topdi', r.status === 200 && !!found);
  ok('Qidiruv natijasida tannarx/foyda yo\'q', !JSON.stringify(r.data).match(/unitCost|totalCost|profit|purchasePrice/));
  r = await worker.get('/returns/search?q=naqd%20mijoz');
  ok('Mijoz nomi bo\'yicha qidiruv', r.data?.data?.length === 1);

  // 1 dona qaytarish
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'naqd', restoreStock: true });
  ok('Ishchi 1 dona qaytardi', r.status === 201 && r.data?.data?.totalRefund === 20000, JSON.stringify(r.data?.data?.totalRefund ?? r.data));
  r = await worker.get(`/products/${productId}`);
  ok('Ombor: 10 - 3 + 1 = 8', (r.data?.data?.stock ?? r.data?.stock) === 8, JSON.stringify(r.data).slice(0, 120));

  // Ortiqcha qaytarish rad etiladi
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 3 }], reason: 'Mos kelmadi', refundMethod: 'naqd' });
  ok('Sotilgandan ortiq qaytarish rad etildi', r.status === 400, r.data?.error);
  // Sababsiz
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'x', refundMethod: 'naqd' });
  ok('Sababsiz qaytarish rad etildi', r.status === 400);
  // Yaroqsiz tovar (omborga qaytmaydi)
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'Nuqsonli', refundMethod: 'click_payme', restoreStock: false });
  ok('Yaroqsiz qaytarish (Click) qabul qilindi', r.status === 201);
  r = await worker.get(`/products/${productId}`);
  ok('Yaroqsiz tovar omborga qo\'shilmadi (8 qoldi)', (r.data?.data?.stock ?? r.data?.stock) === 8);
  // Qolgan 1 dona
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'Mijoz qaytardi', refundMethod: 'naqd' });
  ok('Oxirgi dona qaytarildi', r.status === 201);
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'Mijoz qaytardi', refundMethod: 'naqd' });
  ok('To\'liq qaytarilgan sotuvga yana qaytarish rad etildi', r.status === 400, r.data?.error);

  // Ruxsatlar
  r = await worker.get('/returns'); ok('Ishchi: /returns ro\'yxati 403', r.status === 403);
  r = await worker.get('/debts'); ok('Ishchi: /debts umumiy ro\'yxat 403', r.status === 403);
  r = await worker.get('/reports/summary?from=2026-01-01&to=2026-12-31'); ok('Ishchi: hisobot 403', r.status === 403);
  r = await worker.get('/sync'); ok('Ishchi /sync: qarz va xarajat ro\'yxati bo\'sh', r.status === 200 && r.data.state.debts.length === 0);
  r = await owner.get('/returns');
  ok('Rahbar: qaytarishlar nazorati', r.status === 200 && r.data.employees.length === 1 && r.data.recent.length === 3, JSON.stringify(r.data?.employees?.[0] ?? r.data).slice(0, 220));
  ok('Nazorat: 3 ta qaytarish bugun belgilandi (chegara 3)', r.data?.employees?.[0]?.flagged === true && r.data.employees[0].todayCount === 3);

  // Nasiya
  r = await worker.post('/sales', { items: [{ productId, quantity: 4, unitPrice: 20000 }], paymentMethod: 'nasiya', customerName: 'Ali Test', customerPhone: '+998901112233' });
  const debtId = r.data?.data?.debtRecord?.id; const nasiyaMovement = r.data?.data?.movements?.[0]?.id;
  ok('Ishchi nasiyaga sotdi (80 000)', r.status === 201 && r.data?.data?.debtRecord?.remainingAmount === 80000);
  r = await worker.get('/debts/lookup?q=a'); ok('Nasiya qidiruvi: 1 belgi bo\'sh', r.status === 200 && r.data.data.length === 0);
  r = await worker.get('/debts/lookup?q=ali');
  ok('Nasiya qidiruvi mijozni topdi, telefon faqat oxirgi 4 raqam', r.data?.data?.length === 1 && r.data.data[0].phoneTail === '2233' && !JSON.stringify(r.data).includes('+998901112233'));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  r = await worker.get(`/debts/period?from=${today}&to=${today}`);
  const periodCustomer = r.data?.data?.find(customer => customer.name === 'Ali Test');
  ok('Ishchi kunlar oralig‘idagi nasiya eslatmasini ko‘radi', r.status === 200 && periodCustomer?.rows?.[0]?.itemLines?.includes('TEST OYNA × 4'));
  ok('Ishchi nasiya hisobotida tannarx va foyda yo‘q', !JSON.stringify(r.data).match(/unitCost|totalCost|profit|purchasePrice/));
  r = await worker.post(`/debts/${debtId}/pay`, { amount: 30000, method: 'naqd' });
  ok('Ishchi nasiya to\'lovini qabul qildi (30 000 naqd)', r.status === 200 && r.data?.data?.remainingAmount === 50000, JSON.stringify(r.data?.data));
  r = await worker.post(`/debts/${debtId}/pay`, { amount: 999999, method: 'naqd' });
  ok('Qarzdan ko\'p to\'lov rad etildi', r.status === 400, r.data?.error);
  r = await worker.post(`/debts/${debtId}/pay`, { amount: 1000, method: 'bitcoin' }); const badMethodStatus = r.status;
  r = await worker.post(`/debts/${debtId}/pay`, { amount: 1000, method: 'naqd' });
  ok("Notanish to'lov usuli rad etildi (400)", badMethodStatus === 400);
  ok("Naqd 1 000 to'lov qabul qilindi", r.status === 200);
  // Nasiyadan ayirib qaytarish (20 000)
  r = await worker.post('/returns', { lines: [{ movementId: nasiyaMovement, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'nasiya' });
  ok('Nasiyaga qaytarish qarzni kamaytirdi', r.status === 201 && r.data?.data?.debtReduced === 20000, JSON.stringify(r.data?.data?.debtReduced ?? r.data));
  r = await owner.get('/debts');
  const d = r.data?.data?.find(x => x.id === debtId);
  ok('Qarz qoldig\'i: 80 000 − 30 000 − 1 000 − 20 000 = 29 000', d?.remainingAmount === 29000, String(d?.remainingAmount));
  ok('Tarixda xodim ismi va "vazvrat" usuli bor', d?.paymentHistory?.some(p => p.employeeName === 'Test Ishchi') && d.paymentHistory.some(p => p.method === 'vazvrat'));
  // Qarzi yo'q mijozga nasiya qaytarish
  r = await worker.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'nasiya' });
  ok('Faol qarzi yo\'q mijozga nasiya qaytarish rad etildi', r.status === 400);

  // Chegirmali sotuv: qaytarish mijoz haqiqatan to'lagan sof summadan hisoblanadi.
  r = await worker.post('/sales', { items: [{ productId, quantity: 2, unitPrice: 20000 }], paymentMethod: 'click_payme', customerName: 'Chegirma Test', discount: 10000 });
  const discountedMovement = r.data?.data?.movements?.[0];
  ok('Chegirma sotuv qatoriga yozildi (40 000 − 10 000 = 30 000)', r.status === 201 && discountedMovement?.totalRevenue === 30000 && discountedMovement?.discountAmount === 10000, JSON.stringify(discountedMovement));
  r = await worker.post('/returns', { lines: [{ movementId: discountedMovement?.id, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'click_payme' });
  ok('Chegirmali sotuvning 1/2 qaytarishi 15 000', r.status === 201 && r.data?.data?.totalRefund === 15000, JSON.stringify(r.data?.data));

  // Kassa yopish hisobi
  r = await worker.get('/cash-shifts/current?openingCash=0');
  const t = r.data?.totals;
  // naqd savdo 60 000; naqd qaytarish 2 x 20 000 = 40 000 (1-chi va oxirgi); Click qaytarish hisobga kirmaydi; nasiya naqd to'lov 30 000 + 1 000
  ok('Kassa: naqd qaytarish 40 000', t?.refundTotal === 40000, JSON.stringify(t));
  ok('Kassa: naqd nasiya to\'lovi 31 000', t?.debtCashReceived === 31000);
  ok('Kassa: kutilgan = 60 000 + 31 000 − 40 000 = 51 000', t?.expectedCash === 51000, String(t?.expectedCash));

  // Qisman to'lov va internet xatosidan keyingi xavfsiz qayta urinish.
  const partialReceipt = 'CHK-PARTIAL-IDEMPOTENT';
  const partialPayload = {
    items: [{ productId, quantity: 2, unitPrice: 20000 }],
    paymentMethod: 'nasiya',
    customerName: 'Partial Test',
    customerPhone: '+998909999999',
    paidNow: 10000,
    receiptNumber: partialReceipt
  };
  r = await worker.post('/sales', partialPayload);
  const partialMovement = r.data?.data?.movements?.[0];
  const partialDebt = r.data?.data?.debtRecord;
  ok('Qisman nasiya: 40 000 dan 10 000 to\'landi, 30 000 qarz', r.status === 201 && partialMovement?.paidAmount === 10000 && partialDebt?.paidAmount === 10000 && partialDebt?.remainingAmount === 30000, JSON.stringify(r.data?.data));
  r = await owner.get('/sync');
  const stockAfterPartial = r.data?.state?.products?.find(p => p.id === productId)?.stock;
  r = await worker.post('/sales', partialPayload);
  ok('Bir xil chekni qayta yuborish yangi savdo yaratmaydi', r.status === 201 && r.data?.data?.movements?.[0]?.id === partialMovement?.id, String(r.status));
  r = await owner.get('/sync');
  const duplicateLines = r.data?.state?.movements?.filter(m => m.receiptNumber === partialReceipt) || [];
  const stockAfterRetry = r.data?.state?.products?.find(p => p.id === productId)?.stock;
  ok('Qayta urinishda ombor ikki marta kamaymadi', duplicateLines.length === 1 && stockAfterRetry === stockAfterPartial, `${duplicateLines.length}/${stockAfterPartial}/${stockAfterRetry}`);

  // 7 kundan eski sotuv: bazaga qo'lda yozamiz
  await new Promise(res => setTimeout(res, 1500));
  await stop();
  const dbFile = path.join(tmp, 'data', 'pos_database.json');
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const old = JSON.parse(JSON.stringify(db.movements.find(m => m.id === movementId)));
  old.id = 'old-sale-1'; old.receiptNumber = 'CHK-OLD-1'; old.quantity = 2; old.totalRevenue = 40000; old.totalCost = 24000; old.profit = 16000;
  old.timestamp = new Date(Date.now() - 12 * 86400000).toISOString();
  old.counterparty = 'Eski Mijoz';
  db.movements.push(old);
  fs.writeFileSync(dbFile, JSON.stringify(db));
  await start();
  const worker2 = new Client(); await worker2.post('/auth/login', { userId: workerId, pin: '1234' });
  const owner2 = new Client(); await owner2.post('/auth/login', { userId: 'owner', pin: '2508' });
  r = await worker2.get('/returns/search?q=eski');
  ok('Ishchi 12 kunlik sotuvni qidiruvda ko\'rmaydi', r.data?.data?.length === 0);
  r = await worker2.post('/returns', { lines: [{ movementId: 'old-sale-1', quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'naqd' });
  ok('Eski sotuv: Rahbar tasdig\'i talab qilinadi (403 OWNER_APPROVAL_REQUIRED)', r.status === 403 && r.data?.code === 'OWNER_APPROVAL_REQUIRED', JSON.stringify(r.data));
  r = await worker2.post('/returns', { lines: [{ movementId: 'old-sale-1', quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'naqd', ownerPin: '9999' });
  ok('Noto\'g\'ri Rahbar PIN\'i rad etildi', r.status === 403 && !r.data?.code, r.data?.error);
  r = await worker2.post('/returns', { lines: [{ movementId: 'old-sale-1', quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'naqd', ownerPin: '2508' });
  ok('To\'g\'ri Rahbar PIN\'i bilan eski sotuv qaytarildi', r.status === 201, JSON.stringify(r.data).slice(0, 160));
  r = await owner2.get('/returns');
  ok('Nazoratda "Tasdiqladi: Rahbar" ko\'rinadi', r.data?.recent?.some(x => x.approvedByName === 'Rahbar'));
  // Rahbar qidiruvi eski sotuvni ham ko'radi
  r = await owner2.get('/returns/search?q=eski'); ok('Rahbar eski sotuvni qidiruvda ko\'radi', r.data?.data?.length === 1);

  // Smena yopilgach qaytarish/nasiya to'lovi bloklanadi
  r = await worker2.get('/cash-shifts/current'); const exp = r.data.totals.expectedCash;
  r = await worker2.post('/cash-shifts/close', { openingCash: 0, countedCash: exp, leftForNextDay: 0 });
  ok('Smena yopildi', r.status === 201, String(r.status));
  r = await worker2.post('/returns', { lines: [{ movementId, quantity: 1 }], reason: 'Mos kelmadi', refundMethod: 'naqd' });
  ok('Yopilgan smenada qaytarish bloklandi (409)', r.status === 409);
  r = await worker2.post(`/debts/${debtId}/pay`, { amount: 1000, method: 'naqd' });
  ok('Yopilgan smenada nasiya to\'lovi bloklandi (409)', r.status === 409);
} catch (error) {
  console.log('E2E ERROR', error);
  results.push([false, 'E2E exception', String(error)]);
} finally {
  await stop();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
}
const failed = results.filter(r => !r[0]);
console.log(`\nJAMI: ${results.length}, O'TDI: ${results.length - failed.length}, YIQILDI: ${failed.length}`);
process.exit(failed.length ? 1 : 0);
