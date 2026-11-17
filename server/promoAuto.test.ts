import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoAutoDue } from './promoAuto';
import { DEFAULT_PROMO_SETTINGS } from './dataStore';
import { renderPromoImages, promoImagePages, PROMO_ROWS_PER_IMAGE } from './promoImage';
import { buildPromoUnits } from '../src/utils/promoCatalog';

const at = (iso: string) => new Date(iso);

test('promoAutoDue: har 3 kunda, belgilangan soatdan keyin', () => {
  const s = { ...DEFAULT_PROMO_SETTINGS, autoEnabled: true, intervalDays: 3, hour: 10 };
  assert.equal(promoAutoDue({ ...s, autoEnabled: false }, at('2026-11-17T08:00:00Z')), false);
  // Toshkent = UTC+5: 04:00Z = 09:00 — hali erta
  assert.equal(promoAutoDue(s, at('2026-11-17T04:00:00Z')), false);
  assert.equal(promoAutoDue(s, at('2026-11-17T05:10:00Z')), true); // hech yuborilmagan
  const last = { ...s, lastRunAt: '2026-11-17T05:10:00Z' };
  assert.equal(promoAutoDue(last, at('2026-11-19T06:00:00Z')), false); // 2 kun
  assert.equal(promoAutoDue(last, at('2026-11-20T05:00:00Z')), true); // 3-kun 10:00
  assert.equal(promoAutoDue(last, at('2026-11-20T04:30:00Z')), false); // 3-kun, lekin soat 09:30
});

test('promo rasmlari: PNG, sahifalarga bo\'linadi', async () => {
  const products: any[] = Array.from({ length: PROMO_ROWS_PER_IMAGE + 3 }, (_, i) => ({
    id: String(i), name: `SAMSUNG A${i + 10} LCD`, category: 'EKRAN', brand: '', barcode: '', purchasePrice: 0, sellingPrice: 100000 + i, stock: i + 1, minStockAlert: 0
  }));
  const [unit] = buildPromoUnits(products, { category: 'EKRAN', by: 'brand' });
  assert.equal(promoImagePages(unit).length, 2);
  const images = await renderPromoImages({ category: 'EKRAN', unit, showWholesale: false, contacts: { title: 'T', phones: '1', address: 'A', link: 'L' } });
  assert.equal(images.length, 2);
  assert.equal(images[0].subarray(1, 4).toString(), 'PNG');
});
