#!/usr/bin/env node
// MobileParts POS — nasiyalar aralashib ketganini tekshirish va tuzatish (VPS'da).
//
// Muammo: 56e9790 versiyasi (PR #13) telefon raqami bir xil bo'lsa ismga qaramay
// mijozlarni birlashtirardi. O'sha paytda qilingan mijoz tahriri, mijoz to'lovi va
// qaytarishlar boshqa odamning nasiyasiga ham yozilgan bo'lishi mumkin.
//
// Ishlatish (VPS'da, root):
//   node nasiya-tekshiruv.mjs                 # faqat hisobot, hech narsa o'zgarmaydi
//   pm2 stop mobileparts-pos && node nasiya-tekshiruv.mjs --apply && pm2 start mobileparts-pos
// Qo'shimcha: --backup /yo'l/data-XXXX.tar.gz (yoki .json), APP_DIR=/var/www/mobileparts-pos
//
// --apply nima qiladi (oldin joriy bazaning nusxasini saqlaydi):
//   1) Boshqa ismga o'zgartirib yuborilgan nasiyalarning ismi/telefonini zaxiradagidek qaytaradi.
//   2) Boshqa odamning telefoni bilan yozilgan nasiyalardan o'sha telefonni olib tashlaydi.
// To'lovlar avtomatik ko'chirilmaydi: aralashgan to'lovlar ro'yxati chiqariladi.
// Noto'g'ri nasiyaga tushgan to'lovni egasiga ko'chirish (4-bo'limdagi id bilan):
//   ... --apply --tolovni-kochir <nasiya_id> [--tolovni-kochir <boshqa_id>]
// O'sha nasiyadan to'lov olib tashlanadi va shu to'lovdagi boshqa mijozning
// faol nasiyalariga (eng eskisidan) yoziladi.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const APP_DIR = process.env.APP_DIR || '/var/www/mobileparts-pos';
const PORT = process.env.PORT || '3000';
const BAD_SHA = '56e9790';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const moveIds = args.flatMap((a, i) => (a === '--tolovni-kochir' ? [args[i + 1]] : [])).filter(Boolean);
const backupArg = args.includes('--backup') ? args[args.indexOf('--backup') + 1] : '';
const DB = path.join(APP_DIR, 'data', 'pos_database.json');

const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h' };
const norm = (v) => String(v || '').toLowerCase().replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c).replace(/[ʻʼ'`‘’ʹ]/g, '').replace(/[^a-z0-9+\s]/g, ' ').replace(/\s+/g, ' ').trim();
const first = (name) => norm(name).split(' ')[0] || '';
const tail = (phone) => { const d = String(phone || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
const money = (n, c) => (c === 'USD' ? `$${n}` : `${Math.round(n).toLocaleString('ru-RU')} so'm`);
const day = (iso) => String(iso || '').replace('T', ' ').slice(0, 16);
const say = (s = '') => console.log(s);

function findBackup() {
  if (backupArg) return backupArg;
  const stamps = fs.readdirSync(APP_DIR)
    .filter((f) => f.startsWith(`dist.rollback-before-${BAD_SHA}`))
    .map((f) => f.split('-').pop())
    .sort();
  for (const stamp of stamps) {
    const file = path.join(APP_DIR, 'backups', 'deploy', `data-${stamp}.tar.gz`);
    if (fs.existsSync(file)) return file;
  }
  return '';
}

function readBackup(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const raw = execFileSync('tar', ['-xzOf', file, 'data/pos_database.json'], { maxBuffer: 1024 * 1024 * 1024 });
  return JSON.parse(raw.toString('utf8'));
}

async function serverRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const backupFile = findBackup();
if (!backupFile) {
  say(`XATO: ${BAD_SHA} versiyasidan oldingi zaxira topilmadi.`);
  say(`Mavjud zaxiralar (${path.join(APP_DIR, 'backups', 'deploy')}):`);
  try { fs.readdirSync(path.join(APP_DIR, 'backups', 'deploy')).sort().forEach((f) => say(`  ${f}`)); } catch { say('  (papka yo\'q)'); }
  say('Kerakligini tanlab: node nasiya-tekshiruv.mjs --backup /to\'liq/yo\'l/data-XXXX.tar.gz');
  process.exit(1);
}

const current = JSON.parse(fs.readFileSync(DB, 'utf8'));
const before = readBackup(backupFile);
const oldDebts = new Map((before.debts || []).map((d) => [d.id, d]));
const oldCustomers = new Map((before.customers || []).map((c) => [c.id, c]));
const debts = current.debts || [];
say(`Zaxira: ${backupFile} (${(before.debts || []).length} ta nasiya)`);
say(`Joriy:  ${DB} (${debts.length} ta nasiya)`);

// Zaxiradagi holat bo'yicha: qaysi telefon qaysi ism(lar)ga tegishli edi.
const ownersBefore = new Map();
for (const d of before.debts || []) { const t = tail(d.customerPhone); if (t) (ownersBefore.get(t) || ownersBefore.set(t, new Set()).get(t)).add(first(d.customerName)); }
for (const c of before.customers || []) { const t = tail(c.phone); if (t) (ownersBefore.get(t) || ownersBefore.set(t, new Set()).get(t)).add(first(c.name)); }

const fixes = [];

// 1) Boshqa ismga o'tkazib yuborilgan nasiyalar.
say('\n=== 1. Boshqa odam nomiga o\'tib ketgan nasiyalar ===');
let n1 = 0;
for (const d of debts) {
  const old = oldDebts.get(d.id);
  if (!old) continue;
  const nameMoved = first(old.customerName) !== first(d.customerName);
  const phoneMoved = tail(old.customerPhone) !== tail(d.customerPhone) && tail(d.customerPhone) && ![...(ownersBefore.get(tail(d.customerPhone)) || [])].every((f) => f === first(old.customerName));
  if (!nameMoved && !phoneMoved) continue;
  // Rahbarning o'z tahrirlari tegilmaydi:
  // - nasiya "Tahrirlash" orqali o'zgartirilgan (yangi audit yozuvi bor);
  // - mijozning o'zi qayta nomlangan va bu nasiya o'sha mijozniki edi.
  const manualEdit = (d.auditLog || []).length > (old.auditLog || []).length;
  const renamedProfile = (current.customers || []).find((c) => norm(c.name) === norm(d.customerName) && oldCustomers.has(c.id));
  const ownRename = renamedProfile && first(oldCustomers.get(renamedProfile.id).name) === first(old.customerName);
  if (manualEdit || ownRename) {
    say(`  (o'zingiz tahrirlagan, tegilmaydi) "${old.customerName}" → "${d.customerName}" ${money(d.remainingAmount, d.currency)}`);
    continue;
  }
  n1++;
  say(`- ${day(d.createdAt)} ${money(d.remainingAmount, d.currency)} qoldiq: "${d.customerName}" ${d.customerPhone || ''}  ⟵ asli "${old.customerName}" ${old.customerPhone || ''}`);
  fixes.push({ kind: 'debt', debt: d, name: old.customerName, phone: old.customerPhone, why: `asli "${old.customerName}" ${old.customerPhone || ''}` });
}
if (!n1) say('Topilmadi.');

// 2) Boshqa odamning telefoni bilan yozilgan nasiyalar (zaxiradan keyin yozilganlar).
say('\n=== 2. Boshqa odamning telefoni bilan yozilgan yangi nasiyalar ===');
let n2 = 0;
for (const d of debts) {
  if (oldDebts.has(d.id)) continue;
  const t = tail(d.customerPhone);
  const owners = ownersBefore.get(t);
  if (!t || !owners || owners.has(first(d.customerName))) continue;
  n2++;
  say(`- ${day(d.createdAt)} "${d.customerName}" ${money(d.remainingAmount, d.currency)} — telefon ${d.customerPhone} aslida: ${[...owners].join(', ')}`);
  fixes.push({ kind: 'debt', debt: d, name: d.customerName, phone: '+998', why: `telefon ${d.customerPhone} boshqa odamniki (${[...owners].join(', ')})` });
}
if (!n2) say('Topilmadi.');

// 3) Doimiy mijozlar reestri.
say('\n=== 3. Doimiy mijozlar ro\'yxatida ismi o\'zgarganlar (faqat ko\'rsatiladi; noto\'g\'risini "Doimiy mijozlar"da tahrirlang) ===');
let n3 = 0;
for (const c of current.customers || []) {
  const old = oldCustomers.get(c.id);
  if (!old || first(old.name) === first(c.name)) continue;
  n3++;
  say(`- "${c.name}" ${c.phone || ''} ⟵ asli "${old.name}" ${old.phone || ''}`);
}
if (!n3) say('Topilmadi.');

// 4) Aralashgan to'lovlar/qaytarishlar (avtomatik tuzatilmaydi).
say('\n=== 4. Bir nechta odamning nasiyasiga bo\'linib yozilgan to\'lovlar (qo\'lda tekshiring) ===');
const entries = [];
for (const d of debts) {
  const old = oldDebts.get(d.id);
  const fixedName = fixes.find((f) => f.kind === 'debt' && f.debt === d)?.name || d.customerName;
  const already = old ? (old.paymentHistory || []).length : 0;
  (d.paymentHistory || []).slice(already).forEach((p) => entries.push({ ...p, debt: d, owner: first(fixedName), ownerName: fixedName }));
}
entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
const groups = [];
for (const e of entries) {
  const g = groups[groups.length - 1];
  if (g && g[0].method === e.method && (g[0].employeeName || '') === (e.employeeName || '') && Math.abs(new Date(e.date) - new Date(g[g.length - 1].date)) <= 10_000) g.push(e);
  else groups.push([e]);
}
let n4 = 0;
for (const g of groups) {
  const owners = new Set(g.map((e) => e.owner));
  if (owners.size < 2) continue;
  n4++;
  const total = g.reduce((s, e) => s + e.amount, 0);
  say(`- ${day(g[0].date)} ${g[0].method}${g[0].employeeName ? ` (${g[0].employeeName})` : ''}: jami ${money(total, g[0].debt.currency)}`);
  g.forEach((e) => say(`    → "${e.ownerName}" nasiyasi (${day(e.debt.createdAt)}, id ${e.debt.id}): ${money(e.amount, e.debt.currency)}`));
}
if (!n4) say('Topilmadi.');

// 5) Hozir ham bir telefon bir nechta ismda (sana farqisiz, ma'lumot uchun).
say('\n=== 5. Bir telefon raqami bir nechta ismda (ma\'lumot uchun) ===');
const owners = new Map();
for (const d of debts) { if (d.cancelledAt) continue; const t = tail(d.customerPhone); if (t) (owners.get(t) || owners.set(t, new Map()).get(t)).set(first(d.customerName), d.customerName); }
let n5 = 0;
for (const [t, m] of owners) if (m.size > 1) { n5++; say(`- …${t.slice(-4)}: ${[...m.values()].join(' | ')}`); }
if (!n5) say('Topilmadi.');

say(`\nXulosa: ${n1} ta nasiya boshqa nomga o'tgan, ${n2} ta boshqa telefon bilan yozilgan (bular --apply bilan tuzatiladi); ${n3} ta mijoz nomi o'zgargan, ${n4} ta aralash to'lov (qo'lda).`);

if (!APPLY) {
  if (n4) say("Aralash to'lovni ko'chirish: --apply --tolovni-kochir <noto'g'ri tushgan nasiya id>");
  if (fixes.length) say('Tuzatish uchun: pm2 stop mobileparts-pos && node nasiya-tekshiruv.mjs --apply && pm2 start mobileparts-pos');
  process.exit(0);
}
if (!fixes.length && !moveIds.length) { say('Tuzatadigan narsa yo\'q.'); process.exit(0); }
if (await serverRunning()) {
  say('TO\'XTATILDI: server ishlab turibdi. Avval: pm2 stop mobileparts-pos');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const saved = path.join(APP_DIR, 'backups', `nasiya-tuzatishdan-oldin-${stamp}.json`);
fs.mkdirSync(path.dirname(saved), { recursive: true });
fs.copyFileSync(DB, saved);
const now = new Date().toISOString();
for (const f of fixes) {
  if (f.kind === 'debt') {
    const d = f.debt;
    d.auditLog = [...(d.auditLog || []), { date: now, by: 'Avtomatik tuzatish', action: 'tahrir', details: `"${d.customerName}" ${d.customerPhone || ''} → "${f.name}" ${f.phone || ''} (${f.why})` }];
    d.customerName = f.name;
    d.customerPhone = f.phone || '+998';
  }
}
const statusOf = (d) => (d.remainingAmount <= 0 ? 'yopildi' : d.paidAmount > 0 ? 'qisman_tolandi' : 'faol');
for (const id of moveIds) {
  const g = groups.find((grp) => grp.some((e) => e.debt.id === id) && new Set(grp.map((e) => e.owner)).size === 2);
  if (!g) { say(`⚠️ ${id}: ikki kishi orasida bo'lingan to'lov topilmadi, o'tkazib yuborildi.`); continue; }
  const wrong = g.filter((e) => e.debt.id === id);
  const from = wrong[0].debt;
  const payer = g.find((e) => e.owner !== wrong[0].owner);
  const amount = wrong.reduce((s, e) => s + e.amount, 0);
  const wrongRefs = new Set(wrong.map((e) => `${e.date}|${e.amount}|${e.method}`));
  from.paymentHistory = (from.paymentHistory || []).filter((p) => !wrongRefs.delete(`${p.date}|${p.amount}|${p.method}`));
  from.paidAmount = Math.max(0, from.paidAmount - amount);
  from.remainingAmount = Math.min(from.totalDebt, from.remainingAmount + amount);
  from.status = statusOf(from);
  from.auditLog = [...(from.auditLog || []), { date: now, by: 'Avtomatik tuzatish', action: 'tahrir', details: `Adashib yozilgan to'lov ${amount} olib tashlandi ("${payer.ownerName}" to'lovi)` }];
  const targets = debts
    .filter((d) => !d.cancelledAt && d.remainingAmount > 0 && (d.currency || 'UZS') === (from.currency || 'UZS') && norm(d.customerName) === norm(payer.ownerName))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  let left = amount;
  for (const d of targets) {
    if (left <= 0) break;
    const part = Math.min(d.remainingAmount, left);
    left -= part;
    d.paymentHistory = [...(d.paymentHistory || []), { date: wrong[0].date, amount: part, method: wrong[0].method, employeeId: wrong[0].employeeId, employeeName: wrong[0].employeeName }];
    d.paidAmount += part;
    d.remainingAmount -= part;
    d.status = statusOf(d);
    d.auditLog = [...(d.auditLog || []), { date: now, by: 'Avtomatik tuzatish', action: 'tahrir', details: `"${from.customerName}" nasiyasiga adashib tushgan to'lovdan ${part} ko'chirildi` }];
  }
  say(`↪ ${money(amount, from.currency)}: "${from.customerName}" nasiyasidan olib, "${payer.ownerName}" nasiyalariga yozildi${left > 0 ? ` (${money(left, from.currency)} ortib qoldi — u mijozning ochiq qarzi yetmadi)` : ''}.`);
}
current.lastUpdated = now; // Brauzerlardagi eski nusxalar qayta yuklanadi.
fs.writeFileSync(DB, JSON.stringify(current, null, 2));
say(`\n✅ ${fixes.length} ta nasiya yozuvi, ${moveIds.length} ta to'lov tuzatildi. Oldingi holat: ${saved}`);
say('Endi: pm2 start mobileparts-pos va brauzerda Ctrl+Shift+R');
