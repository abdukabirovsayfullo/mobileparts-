import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [databasePath, planPath] = process.argv.slice(2);
if (!databasePath || !planPath) {
  throw new Error('Usage: node scripts/apply-turnover-import.mjs <database.json> <plan.json>');
}

const database = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
database.products = Array.isArray(database.products) ? database.products : [];
database.movements = Array.isArray(database.movements) ? database.movements : [];

if (database.movements.some(item => item.turnoverImportId === plan.importId)) {
  console.log(JSON.stringify({ status: 'already-imported', importId: plan.importId }));
  process.exit(0);
}

const collapse = value => String(value || '').trim().replace(/\s+/g, ' ');
const normalize = value => collapse(value).toLocaleLowerCase();
const byName = new Map();
for (const product of database.products) {
  const key = normalize(product.name);
  const list = byName.get(key) || [];
  list.push(product);
  byName.set(key, list);
}

const chooseProduct = item => {
  const candidates = byName.get(normalize(item.name)) || [];
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.filter(product => collapse(product.name) === collapse(item.name));
  if (exact.length === 1) return exact[0];
  if (candidates.length > 0) {
    const expectedCost = item.outgoingQty > 0 ? item.outgoingCost / item.outgoingQty : item.incomingCost / Math.max(1, item.incomingQty);
    return candidates.slice().sort((a, b) => Math.abs((a.purchasePrice || 0) - expectedCost) - Math.abs((b.purchasePrice || 0) - expectedCost))[0];
  }
  return null;
};

const categoryOf = name => collapse(name).split(' ')[0]?.toUpperCase() || 'BOSHQA';
const stableId = (kind, item) => `${plan.importId}-${kind}-${item.sourceRow}`;
const periodText = `${plan.period.from} — ${plan.period.to}`;
const added = [];
let matchedProducts = 0;
let missingProducts = 0;

for (const item of plan.items) {
  const product = chooseProduct(item);
  if (product) matchedProducts += 1; else missingProducts += 1;
  const productId = product?.id || `legacy-${crypto.createHash('sha256').update(`${plan.importId}:${item.sourceRow}:${item.name}`).digest('hex').slice(0, 16)}`;
  const productName = product?.name || collapse(item.name);
  const category = product?.category || categoryOf(item.name);
  const common = {
    productId,
    productName,
    category,
    timestamp: plan.timestamp,
    counterparty: 'Oldingi tizim',
    turnoverImportId: plan.importId,
    turnoverPeriod: plan.period,
    employeeId: 'legacy-turnover',
    employeeName: 'Oldingi tizim',
  };
  if (item.incomingQty > 0) {
    const unitCost = item.incomingCost / item.incomingQty;
    added.push({
      ...common, id: stableId('kirim', item), type: 'kirim', quantity: item.incomingQty,
      unitCost, unitPrice: unitCost, totalCost: item.incomingCost, totalRevenue: item.incomingCost,
      profit: 0, batchSaleId: `${plan.importId}-kirim`,
      notes: `${periodText} ombor aylanmasi: kirim tannarx bo'yicha (${plan.sourceName}).`
    });
  }
  if (item.outgoingQty > 0) {
    const unitCost = item.outgoingCost / item.outgoingQty;
    added.push({
      ...common, id: stableId('chiqim', item), type: 'chiqim', quantity: item.outgoingQty,
      unitCost, unitPrice: unitCost, totalCost: item.outgoingCost, totalRevenue: item.outgoingCost,
      profit: 0, receiptNumber: `AYL-202609-${item.sourceRow}`, batchSaleId: `${plan.importId}-chiqim`,
      isHistoricalAggregate: true,
      notes: `${periodText} ombor aylanmasi: chiqim tannarx bo'yicha; sotuv narxi manbada yo'q (${plan.sourceName}).`
    });
  }
}

database.movements = [...added, ...database.movements];
database.lastUpdated = new Date().toISOString();
const temporaryPath = `${databasePath}.turnover.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
fs.renameSync(temporaryPath, databasePath);

console.log(JSON.stringify({
  status: 'imported', importId: plan.importId, addedMovements: added.length,
  incomingMovements: added.filter(item => item.type === 'kirim').length,
  outgoingMovements: added.filter(item => item.type === 'chiqim').length,
  matchedProducts, missingProducts,
  totals: plan.totals,
}));
