import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Product } from '../types';
import { buildPromoGroups, buildPromoUnits, isAccessoryCategory, paginatePromo, productBrand, promoBrands, promoCaption, promoGroupMode, promoKeys, screenType } from './promoCatalog';

const p = (o: Partial<Product>): Product => ({
  id: Math.random().toString(36).slice(2), name: 'X', category: 'EKRAN', brand: '', barcode: '', purchasePrice: 0,
  sellingPrice: 100000, stock: 1, minStockAlert: 0, ...o
});

test('promoCatalog: brend, filtr, saralash', () => {
  const products = [
    p({ name: 'Samsung A10 LCD', stock: 3 }),
    p({ name: 'Samsung A2 Core LCD', stock: 0 }),
    p({ name: 'Samsung A20 LCD', stock: 2 }),
    p({ name: 'Redmi 9A ekran', brand: 'Redmi', stock: 5 }),
    p({ name: 'Remax kabel', category: 'Aksessuarlar', stock: 9, wholesalePrice: 15000, sellingPrice: 20000 })
  ];
  assert.equal(productBrand({ brand: '', name: 'iPhone 11 ekran' }), 'IPHONE');
  assert.deepEqual(promoBrands(products, 'EKRAN').map((b) => [b.brand, b.count]), [['SAMSUNG', 2], ['REDMI', 1]]);
  const groups = buildPromoGroups(products, { category: 'EKRAN', inStockOnly: true });
  assert.deepEqual(groups.map((g) => g.brand), ['SAMSUNG', 'REDMI']);
  assert.deepEqual(groups[0].items.map((i) => i.name), ['Samsung A10 LCD', 'Samsung A20 LCD']); // raqamli saralash, 0 qoldiq yo'q
  assert.equal(buildPromoGroups(products, { category: 'EKRAN', brands: ['redmi'] }).length, 1);
  assert.equal(buildPromoGroups(products, { category: 'EKRAN', inStockOnly: false })[0].items.length, 3);
  const acc = buildPromoGroups(products, { category: 'Aksessuarlar' });
  assert.equal(acc[0].items[0].wholesale, 15000);
  assert.ok(isAccessoryCategory('Aksessuarlar'));
  assert.ok(isAccessoryCategory('Zaryadniklar'));
  assert.ok(!isAccessoryCategory('EKRAN'));
});

test('paginatePromo: sarlavha yolg\'iz qolmaydi, davomi belgilanadi', () => {
  const items = (n: number, brand: string) => ({ brand, items: Array.from({ length: n }, (_, i) => ({ id: brand + i, name: `${brand} ${i}`, stock: 1, retail: 1, currency: 'UZS' as const })) });
  const pages = paginatePromo([items(5, 'A'), items(4, 'B')], 6);
  assert.deepEqual(pages.map((pg) => pg.map((r) => (r.kind === 'group' ? `#${r.brand}${r.continued ? '+' : ''}` : r.item.name)).join(',')), [
    '#A,A 0,A 1,A 2,A 3,A 4',
    '#B,B 0,B 1,B 2,B 3'
  ]);
  const long = paginatePromo([items(12, 'S')], 6);
  assert.equal(long.length, 3);
  assert.equal((long[1][0] as any).continued, true);
  assert.equal(long.flat().filter((r) => r.kind === 'item').length, 12);
  const last = long.flat().filter((r) => r.kind === 'item').at(-1) as any;
  assert.equal(last.index, 12);
});

test('promoCaption: qisqa va aloqa ma\'lumotlari bilan', () => {
  const caption = promoCaption('EKRAN', ['SAMSUNG'], [{ brand: 'SAMSUNG', items: [{ id: '1', name: 'A10', stock: 3, retail: 1, currency: 'UZS' }] }],
    { title: 'MobileParts', phones: '+998952001333, +998911741333', address: 'Paxtaobod', link: 't.me/mobilepartsuz' }, new Date('2026-11-14T10:00:00Z'));
  assert.match(caption, /EKRAN — SAMSUNG/);
  assert.match(caption, /1 xil model \(3 dona\)/);
  assert.match(caption, /\+998952001333 \| \+998911741333/);
  assert.ok(caption.length <= 1000);
});

test('screenType va productBrand: haqiqiy nomlar', () => {
  const cases: [string, string | null][] = [
    ['SAMSUNG A05S LCD PRO', 'LCD PRO'], ['SAMSUNG A05 EKB', 'EKB'], ['REDMI NOTE 10S EKB WF', 'EKB'], ['REDMI NOTE 8 PRO LCD PRO WF', 'LCD PRO'],
    ['OPPO A74 MMJ', 'MMJ'], ['IPHONE 13 PRO MAX INSELL', 'INSELL'], ['IPHONE X GX OLED', 'OLED'], ['HONOR 8X LCD PRO ORIGINAL', 'ORIGINAL'],
    ['SAMSUNG A20', null], ['REDMI NOTE 8 PRO', null]
  ];
  for (const [name, type] of cases) assert.equal(screenType(name), type, name);
  assert.equal(productBrand({ brand: 'Universal', name: 'REDMI 9A LCD PRO' }), 'REDMI');
  assert.equal(productBrand({ brand: 'Universal', name: 'Keramika oyna' }), 'KERAMIKA');
  assert.equal(productBrand({ brand: 'Remax', name: 'Kabel RP-U35' }), 'REMAX');
  assert.equal(productBrand({ brand: '', name: 'POCO X3 LCD PRO' }), 'POCO');
});

test('buildPromoUnits: ekran turi bo\'yicha PDF, ichida brend bo\'limlari', () => {
  const products = [
    p({ name: 'SAMSUNG A05 EKB', stock: 2 }), p({ name: 'REDMI A1+ EKB', stock: 9 }), p({ name: 'SAMSUNG A06 LCD PRO', stock: 5 }),
    p({ name: 'REDMI 9A LCD PRO', stock: 7 }), p({ name: 'REDMI 10 LCD PRO', stock: 1 }), p({ name: 'SAMSUNG A20', stock: 1 }),
    p({ name: 'OPPO A74 MMJ', stock: 0 })
  ];
  assert.equal(promoGroupMode(products, 'EKRAN'), 'type');
  assert.deepEqual(promoKeys(products, 'EKRAN', 'type').map((k) => [k.key, k.count]), [['LCD PRO', 3], ['EKB', 2], ['BOSHQA', 1]]);
  const units = buildPromoUnits(products, { category: 'EKRAN', by: 'type' });
  assert.deepEqual(units.map((u) => u.key), ['LCD PRO', 'EKB', 'BOSHQA']);
  assert.deepEqual(units[0].sections.map((s) => [s.brand, s.items.map((i) => i.name)]), [['REDMI', ['REDMI 9A LCD PRO', 'REDMI 10 LCD PRO']], ['SAMSUNG', ['SAMSUNG A06 LCD PRO']]]);
  assert.deepEqual(buildPromoUnits(products, { category: 'EKRAN', by: 'type', keys: ['ekb'] }).map((u) => u.key), ['EKB']);
  assert.equal(promoGroupMode([p({ name: 'Remax kabel', category: 'Aksessuarlar' })], 'Aksessuarlar'), 'brand');
});
