#!/usr/bin/env node
// MobileParts POS — bir nechta mijozga yozilib qolgan telefon raqamlarini tozalash (VPS'da).
//
// Muammo: eski programmadan ko'chirishda bir telefon raqami ko'p mijozga yozilgan.
// Telefon bo'yicha birlashtiradigan versiya ularning qarzini bitta odamga qo'shib ko'rsatadi.
// Bu skript faqat telefon maydonini o'zgartiradi: summalar, to'lovlar, ismlar tegilmaydi.
//
// Ishlatish (VPS'da, root):
//   node telefon-tuzatish.mjs                 # faqat hisobot, hech narsa o'zgarmaydi
//   pm2 stop mobileparts-pos && node telefon-tuzatish.mjs --apply; pm2 start mobileparts-pos
// Qo'shimcha: APP_DIR=/var/www/mobileparts-pos, --db /yo'l/pos_database.json (sinov uchun)

import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = process.env.APP_DIR || '/var/www/mobileparts-pos';
const PORT = process.env.PORT || '3000';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DB = args.includes('--db') ? args[args.indexOf('--db') + 1] : path.join(APP_DIR, 'data', 'pos_database.json');

// Rahbar tasdiqlagan egalar (15.11.2026): raqam faqat shu odamda qoladi.
const RULES = [
  { tail: '945673377', owner: 'NURULLO AKA USTA', phone: '+998 945673377', fillOwnerBlank: true },
  { tail: '970981313', owner: 'JAHONGIR 1313', phone: '+998 970981313' },
  { tail: '943844414', owner: 'ISMOYIL 4414', phone: '+998 943844414' },
];
const BLANK = '+998';

const norm = (v) => String(v || '').toUpperCase().replace(/[ʻʼ'`‘’]/g, '').replace(/\s+/g, ' ').trim();
const tail = (phone) => { const d = String(phone || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
const say = (s = '') => console.log(s);

async function serverRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const debts = db.debts || [];
const movements = db.movements || [];
const customers = db.customers || [];
const debtNameByMovement = new Map();
for (const d of debts) if (d.movementId) debtNameByMovement.set(d.movementId, d.customerName);

const changes = [];
const unknown = [];
const set = (kind, obj, field, name, to) => {
  changes.push({ kind, id: obj.id, name, from: obj[field], to });
  if (APPLY) obj[field] = to;
};

for (const rule of RULES) {
  const owner = norm(rule.owner);
  for (const d of debts) {
    if (tail(d.customerPhone) === rule.tail && norm(d.customerName) !== owner) set('nasiya', d, 'customerPhone', d.customerName, BLANK);
  }
  for (const c of customers) {
    if (tail(c.phone) === rule.tail && norm(c.name) !== owner) set('mijoz', c, 'phone', c.name, BLANK);
  }
  for (const m of movements) {
    if (tail(m.customerPhone) !== rule.tail) continue;
    const name = m.counterparty || debtNameByMovement.get(m.id) || '';
    if (!name) { unknown.push(m); continue; }
    if (norm(name) !== owner) set('sotuv', m, 'customerPhone', name, BLANK);
  }
  if (rule.fillOwnerBlank) {
    const ownerMovements = new Set();
    for (const d of debts) {
      if (norm(d.customerName) === owner && !tail(d.customerPhone)) {
        set('nasiya', d, 'customerPhone', d.customerName, rule.phone);
        if (d.movementId) ownerMovements.add(d.movementId);
      }
    }
    for (const m of movements) {
      if (ownerMovements.has(m.id) && !tail(m.customerPhone)) set('sotuv', m, 'customerPhone', rule.owner, rule.phone);
    }
  }
}

say(`Baza: ${DB}`);
say(APPLY ? "Rejim: --apply (o'zgartiriladi)" : "Rejim: faqat hisobot (hech narsa o'zgarmaydi)");
say('');
for (const kind of ['nasiya', 'mijoz', 'sotuv']) {
  const rows = changes.filter((c) => c.kind === kind);
  say(`== ${kind} (${rows.length} ta) ==`);
  for (const r of rows) say(`  ${String(r.name).padEnd(22)} ${String(r.from).padEnd(16)} -> ${r.to}   ${r.id}`);
  say('');
}
if (unknown.length) {
  say(`Egasi aniqlanmagan sotuvlar (tegilmadi, ${unknown.length} ta):`);
  for (const m of unknown) say(`  ${m.customerPhone}  ${String(m.timestamp || '').slice(0, 16)}  ${m.productName || ''}  ${m.id}`);
  say('');
}

// Natija: telefon bo'yicha ochiq qarz (tekshirish uchun)
const open = new Map();
for (const d of debts) {
  if (!(d.remainingAmount > 0)) continue;
  const t = tail(APPLY ? d.customerPhone : (changes.find((c) => c.id === d.id)?.to ?? d.customerPhone));
  if (!RULES.some((r) => r.tail === t)) continue;
  const e = open.get(t) || { sum: 0, names: new Set() };
  e.sum += d.remainingAmount; e.names.add(norm(d.customerName));
  open.set(t, e);
}
say('Tuzatishdan keyin shu raqamlardagi ochiq qarz:');
for (const [t, e] of open) say(`  ${t}: ${Math.round(e.sum).toLocaleString('ru-RU')} so'm — ${[...e.names].join(', ')}`);
say('');

if (!APPLY) {
  say("Hech narsa o'zgarmadi. Yozish uchun: pm2 stop mobileparts-pos && node telefon-tuzatish.mjs --apply; pm2 start mobileparts-pos");
  process.exit(0);
}
if (!changes.length) { say("O'zgartiradigan narsa yo'q."); process.exit(0); }
if (!args.includes('--db') && await serverRunning()) {
  say("XATO: server ishlab turibdi. Avval: pm2 stop mobileparts-pos");
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const copy = DB.replace(/\.json$/, `.before-telefon-${stamp}.json`);
fs.copyFileSync(DB, copy);
db.lastUpdated = new Date().toISOString();
const tmp = `${DB}.tmp-${process.pid}`;
fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
fs.renameSync(tmp, DB);
say(`Yozildi: ${changes.length} ta o'zgarish. Oldingi holat nusxasi: ${copy}`);
say("Endi: pm2 start mobileparts-pos, so'ng CRMni hamma qurilmada yopib qayta oching.");
