#!/usr/bin/env node
// Telefon kataloglaridagi (TELEFON, KNOPKALI) tovarlar, ularning harakatlari va ular bilan bog'liq
// nasiyalarni "USD" deb belgilaydi. Raqamlar o'zgarmaydi: ular allaqachon dollarda kiritilgan edi.
// Ishlatish:  node scripts/migrate-usd-phones.mjs data/pos_database.json           (faqat ko'rsatadi)
//             node scripts/migrate-usd-phones.mjs data/pos_database.json --apply   (yozadi)
// Qayta ishga tushirish xavfsiz: allaqachon belgilangan yozuvlarga tegilmaydi.
// Server to'xtatilgan holda ishga tushiring, aks holda server o'z xotirasidagi holatni qayta yozib yuboradi.
import fs from 'node:fs';

// src/utils/money.ts dagi USD_CATEGORIES bilan bir xil bo'lishi shart.
const USD_CATEGORIES = new Set(['TELEFON', 'KNOPKALI']);
const isPhoneCategory = (category) => USD_CATEGORIES.has(String(category || '').trim().toUpperCase());

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('Foydalanish: node scripts/migrate-usd-phones.mjs <pos_database.json> [--apply]');
  process.exit(1);
}
const apply = flag === '--apply';
const state = JSON.parse(fs.readFileSync(file, 'utf8'));

const usdProductIds = new Set();
let products = 0;
for (const product of state.products || []) {
  if (!isPhoneCategory(product.category)) continue;
  usdProductIds.add(product.id);
  if (product.currency === 'USD') continue;
  if (product.currency === 'UZS') { console.warn(`! Tovar so'm deb aniq belgilangan, o'zgartirilmadi: ${product.name}`); continue; }
  product.currency = 'USD';
  products += 1;
}

const usdMovementIds = new Set();
let movements = 0;
for (const movement of state.movements || []) {
  if (!usdProductIds.has(movement.productId) && !isPhoneCategory(movement.category)) continue;
  usdMovementIds.add(movement.id);
  if (movement.currency) continue;
  movement.currency = 'USD';
  movements += 1;
}

// Bir chekda telefon va so'mli tovar aralashgan eski savdolar: avtomatik ajratib bo'lmaydi.
const batches = new Map();
for (const movement of state.movements || []) {
  if (movement.type !== 'chiqim' || !movement.batchSaleId || movement.isHistoricalAggregate) continue;
  const set = batches.get(movement.batchSaleId) || new Set();
  set.add(usdMovementIds.has(movement.id) ? 'USD' : 'UZS');
  batches.set(movement.batchSaleId, set);
}
const mixedBatches = [...batches].filter(([, set]) => set.size > 1).map(([id]) => id);

let debts = 0;
const debtNotes = [];
const movementById = new Map((state.movements || []).map((m) => [m.id, m]));
for (const debt of state.debts || []) {
  if (debt.currency || !debt.movementId || !usdMovementIds.has(debt.movementId)) continue;
  const batchId = movementById.get(debt.movementId)?.batchSaleId;
  if (batchId && mixedBatches.includes(batchId)) {
    debtNotes.push(`! Aralash chekdagi nasiya o'zgartirilmadi (qo'lda tekshiring): ${debt.customerName} ${debt.totalDebt}`);
    continue;
  }
  debt.currency = 'USD';
  debts += 1;
  debtNotes.push(`  nasiya → USD: ${debt.customerName}, jami ${debt.totalDebt}, qoldiq ${debt.remainingAmount}`);
}

console.log(JSON.stringify({ rejim: apply ? 'apply' : 'dry-run', tovarlar: products, harakatlar: movements, nasiyalar: debts, aralashCheklar: mixedBatches.length }, null, 2));
for (const line of debtNotes) console.log(line);
for (const id of mixedBatches) console.log(`! Aralash chek (telefon + so'mli tovar): ${id}`);

if (apply && (products || movements || debts)) {
  // Brauzerlardagi eski nusxa serverni qayta yozib yubormasligi uchun versiya yangilanadi (ular 409 olib qayta yuklaydi).
  state.lastUpdated = new Date().toISOString();
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
  console.log('Yozildi:', file);
}
