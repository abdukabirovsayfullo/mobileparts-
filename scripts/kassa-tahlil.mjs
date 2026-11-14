#!/usr/bin/env node
// MobileParts POS — kunlik naqd kassa tahlili (faqat o'qiydi, hech narsani o'zgartirmaydi).
//
// Ishlatish (VPS'da):
//   node kassa-tahlil.mjs --sanaldi 1095000            # bugun, kassada sanalgan summa bilan
//   node kassa-tahlil.mjs --sana 2026-11-14 --sanaldi 1095000
// APP_DIR=/var/www/mobileparts-pos (standart)
//
// Har bir naqd so'm qayerdan kelgani/ketgani vaqt bo'yicha chiqariladi va
// odatda farq beradigan holatlar alohida belgilanadi.

import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = process.env.APP_DIR || '/var/www/mobileparts-pos';
const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const tz = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const time = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
const DATE = arg('--sana') || tz(new Date());
const COUNTED = arg('--sanaldi') !== undefined ? Number(String(arg('--sanaldi')).replace(/\D/g, '')) : undefined;
const som = (n) => `${Math.round(n).toLocaleString('ru-RU')} so'm`;
const isUZS = (x) => (x.currency || 'UZS') === 'UZS';
const say = (s = '') => console.log(s);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

const db = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'data', 'pos_database.json'), 'utf8'));
const movements = db.movements || [];
const debts = db.debts || [];
const today = (iso) => iso && tz(iso) === DATE;

say(`KASSA TAHLILI — ${DATE} (faqat so'm, naqd)`);
say('='.repeat(60));

// --- Ochilish qoldig'i: kechagi yopilgan smenalardan qolgan pul.
const shifts = db.cashShifts || [];
const prevShifts = shifts.filter((s) => s.businessDate < DATE && !s.reopenedAt);
const lastByEmployee = new Map();
for (const s of prevShifts.sort((a, b) => a.businessDate.localeCompare(b.businessDate))) lastByEmployee.set(s.employeeId, s);
const opening = [...lastByEmployee.values()].filter((s) => s.businessDate >= tz(new Date(new Date(`${DATE}T12:00:00+05:00`).getTime() - 7 * 86400000)));
const openingTotal = opening.reduce((t, s) => t + (s.leftForNextDay || 0), 0);
say(`\n0) Ochilish qoldig'i (kechagi smenadan qoldirilgan): ${som(openingTotal)}`);
opening.forEach((s) => say(`   ${s.employeeName}: ${som(s.leftForNextDay || 0)} (${s.businessDate})`));

// --- 1) Naqd savdolar (chek bo'yicha).
const byReceipt = (list) => {
  const m = new Map();
  for (const x of list) { const k = x.batchSaleId || x.receiptNumber || x.id; (m.get(k) || m.set(k, []).get(k)).push(x); }
  return [...m.values()].map((items) => ({
    items, at: items[0].timestamp, receipt: items[0].receiptNumber || '', who: items[0].counterparty || '', emp: items[0].employeeName || '—',
    total: items.reduce((t, x) => t + (x.totalRevenue || 0), 0), paid: items.reduce((t, x) => t + (x.paidAmount || 0), 0),
    label: items.map((x) => `${x.productName}${x.quantity > 1 ? ` ×${x.quantity}` : ''}`).join(', ')
  })).sort((a, b) => a.at.localeCompare(b.at));
};
const daySales = movements.filter((m) => m.type === 'chiqim' && isUZS(m) && today(m.timestamp));
const cashSales = byReceipt(daySales.filter((m) => m.paymentMethod === 'naqd'));
const cashSalesTotal = cashSales.reduce((t, s) => t + s.total, 0);
say(`\n1) Naqd savdolar: ${cashSales.length} ta chek, ${som(cashSalesTotal)}`);
cashSales.forEach((s) => say(`   ${time(s.at)} ${pad(s.receipt, 12)} ${pad(s.who, 18)} ${pad(s.emp, 10)} ${som(s.total).padStart(14)}  ${s.label}`));

// --- 2) Nasiya sotuvda shu zahoti naqd berilgan qism.
const partial = byReceipt(daySales.filter((m) => m.paymentMethod === 'nasiya')).filter((s) => s.paid > 0);
const partialTotal = partial.reduce((t, s) => t + s.paid, 0);
say(`\n2) Nasiya sotuvda darhol berilgan qism: ${som(partialTotal)}  ⚠️ "Kassa yopish" (smena) buni hisoblamaydi`);
partial.forEach((s) => say(`   ${time(s.at)} ${pad(s.receipt, 12)} ${pad(s.who, 18)} chek ${som(s.total)}, berdi ${som(s.paid)}`));

// --- 3) Naqd nasiya to'lovlari (sotuv paytidagi qism 2-bandda, takrorlanmaydi).
const saleTimes = new Set(partial.map((s) => s.at));
const debtCash = [];
const fakeCash = [];
for (const d of debts.filter(isUZS)) {
  for (const p of d.paymentHistory || []) {
    if (p.method !== 'naqd' || !today(p.date)) continue;
    // Sotuv paytidagi qism 2-bandda bor; qo'lda yozilgan nasiyadagi boshlang'ich to'lov esa shu yerda sanaladi.
    const fromSale = d.movementId && !String(d.movementId).startsWith('manual-');
    const atSale = fromSale && (d.createdAt === p.date || saleTimes.has(p.date));
    if (atSale) continue;
    const isReturn = /Vazvrat hisobiga/i.test(d.notes || '') && movements.some((m) => m.type === 'vazvrat' && Math.abs(new Date(m.timestamp) - new Date(p.date)) < 5000);
    (isReturn ? fakeCash : debtCash).push({ at: p.date, who: d.customerName, emp: p.employeeName || '—', amount: p.amount });
  }
}
debtCash.sort((a, b) => a.at.localeCompare(b.at));
const debtCashTotal = debtCash.reduce((t, p) => t + p.amount, 0);
say(`\n3) Naqd nasiya to'lovlari: ${debtCash.length} ta, ${som(debtCashTotal)}`);
debtCash.forEach((p) => say(`   ${time(p.at)} ${pad(p.who, 24)} ${pad(p.emp, 10)} ${som(p.amount).padStart(14)}`));
if (fakeCash.length) {
  say(`   ⚠️ Naqd emas, qaytarishda qarzdan ayirilgan (eski xato, naqd deb yozilgan): ${som(fakeCash.reduce((t, p) => t + p.amount, 0))}`);
  fakeCash.forEach((p) => say(`      ${time(p.at)} ${p.who} ${som(p.amount)}`));
}

// --- 4) Naqd qaytarishlar.
const refunds = byReceipt(movements.filter((m) => m.type === 'vazvrat' && isUZS(m) && m.paymentMethod === 'naqd' && today(m.timestamp)));
const refundTotal = refunds.reduce((t, s) => t + s.total, 0);
say(`\n4) Naqd qaytarilgan (mijozga berilgan): ${refunds.length} ta, ${som(refundTotal)}`);
refunds.forEach((s) => say(`   ${time(s.at)} ${pad(s.who, 18)} ${pad(s.emp, 10)} ${som(s.total).padStart(14)}  ${s.label}`));

// --- 5) Kassadan chiqim.
const expenses = (db.expenses || []).filter((e) => !e.cancelledAt && today(e.occurredAt));
const expenseTotal = expenses.reduce((t, e) => t + e.amount, 0);
say(`\n5) Kassadan chiqim: ${expenses.length} ta, ${som(expenseTotal)}`);
expenses.forEach((e) => say(`   ${time(e.occurredAt)} ${pad(e.recipient, 18)} ${pad(e.createdByName, 10)} ${som(e.amount).padStart(14)}  ${e.reason}`));

// --- Ma'lumot uchun: naqd bo'lmagan to'lovlar (adashib tanlangan bo'lishi mumkin).
const other = (method) => byReceipt(daySales.filter((m) => m.paymentMethod === method)).reduce((t, s) => t + s.total, 0);
say(`\nMa'lumot: Click/Payme ${som(other('click_payme'))}, Uzum ${som(other('uzum'))}, nasiya (qarzga) ${som(byReceipt(daySales.filter((m) => m.paymentMethod === 'nasiya')).reduce((t, s) => t + s.total - s.paid, 0))}`);

// --- Takroriy cheklar (ikki marta bosilgan bo'lishi mumkin).
const dupes = [];
const allDay = byReceipt(daySales);
for (let i = 1; i < allDay.length; i++) {
  const a = allDay[i - 1], b = allDay[i];
  if (a.label === b.label && a.who === b.who && a.total === b.total && Math.abs(new Date(b.at) - new Date(a.at)) < 180000) dupes.push([a, b]);
}
if (dupes.length) {
  say(`\n⚠️ Ikki marta yozilgan bo'lishi mumkin bo'lgan cheklar:`);
  dupes.forEach(([a, b]) => say(`   ${time(a.at)} va ${time(b.at)} ${a.who} ${som(a.total)} — ${a.label}`));
}

// --- Natija.
const expected = openingTotal + cashSalesTotal + partialTotal + debtCashTotal - refundTotal - expenseTotal;
say('\n' + '='.repeat(60));
say(`Kutilgan naqd = ochilish ${som(openingTotal)} + savdo ${som(cashSalesTotal)} + nasiyadagi darhol to'lov ${som(partialTotal)}`);
say(`               + nasiya to'lovi ${som(debtCashTotal)} − qaytarish ${som(refundTotal)} − chiqim ${som(expenseTotal)}`);
say(`               = ${som(expected)}`);
if (COUNTED !== undefined) {
  const diff = COUNTED - expected;
  say(`Kassada sanalgan: ${som(COUNTED)}`);
  say(`FARQ: ${diff === 0 ? "yo'q ✅" : `${diff > 0 ? 'ortiqcha +' : 'kam −'}${som(Math.abs(diff))}`}`);
  if (diff !== 0) {
    const hits = [];
    const all = [
      ...cashSales.map((s) => ({ t: 'naqd savdo', s: s.total, d: `${time(s.at)} ${s.who}` })),
      ...partial.map((s) => ({ t: "nasiyadagi darhol to'lov", s: s.paid, d: `${time(s.at)} ${s.who}` })),
      ...debtCash.map((p) => ({ t: "nasiya to'lovi", s: p.amount, d: `${time(p.at)} ${p.who}` })),
      ...refunds.map((s) => ({ t: 'qaytarish', s: s.total, d: `${time(s.at)} ${s.who}` })),
      ...expenses.map((e) => ({ t: 'chiqim', s: e.amount, d: `${time(e.occurredAt)} ${e.recipient}` })),
      ...fakeCash.map((p) => ({ t: "qaytarishda naqd deb yozilgan", s: p.amount, d: `${time(p.at)} ${p.who}` }))
    ];
    for (const x of all) if (Math.abs(x.s) === Math.abs(diff) || Math.abs(x.s * 2) === Math.abs(diff)) hits.push(x);
    if (hits.length) {
      say('Farqqa aynan teng (yoki ikki barobari) yozuvlar — avval shularni tekshiring:');
      hits.forEach((x) => say(`   ${x.t}: ${x.d} ${som(x.s)}`));
    }
  }
}
const closed = shifts.filter((s) => s.businessDate === DATE && !s.reopenedAt);
closed.forEach((s) => say(`Yopilgan smena: ${s.employeeName} — kutilgan ${som(s.expectedCash)}, sanalgan ${som(s.countedCash)}, farq ${som(s.difference ?? s.countedCash - s.expectedCash)}`));
