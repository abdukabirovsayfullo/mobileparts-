import type { Currency, Product } from '../types';
import { currencyOf } from './money';

export interface PromoItem {
  id: string;
  name: string;
  stock: number;
  retail: number;
  wholesale?: number;
  currency: Currency;
}

export interface PromoGroup {
  brand: string;
  items: PromoItem[];
}

export type PromoRow =
  | { kind: 'group'; brand: string; count: number; continued: boolean }
  | { kind: 'item'; index: number; item: PromoItem };

export interface PromoFilter {
  category: string;
  /** Bo'sh bo'lsa — barcha brendlar. */
  brands?: string[];
  inStockOnly?: boolean;
  query?: string;
}

const ACCESSORY_RE = /aksessuar|aksesuar|zaryad|quvvat|adapter|blok|kabel|cable|usb|quloqchin|naushnik|airpods|chexol|chehol|oyna|steklo|glass|powerbank|ushlagich|holder|aux|kolonka|speaker|soat|watch|fleshka|xotira/i;

/** Aksessuar kategoriyalarida optom narx ham ko'rsatiladi (foydalanuvchi o'zgartira oladi). */
export const isAccessoryCategory = (category: string) => ACCESSORY_RE.test(category || '');

const KNOWN_BRANDS = ['SAMSUNG', 'REDMI', 'XIAOMI', 'POCO', 'IPHONE', 'APPLE', 'HONOR', 'HUAWEI', 'OPPO', 'VIVO', 'REALME', 'INFINIX', 'TECNO', 'ITEL', 'NOKIA', 'MOTOROLA', 'ONEPLUS', 'GOOGLE', 'PIXEL', 'ZTE', 'MEIZU', 'LENOVO', 'SONY', 'LG', 'ASUS', 'ARTEL', 'BLACKVIEW', 'UMIDIGI'];

/** Brend: nomdagi ma'lum brend, bo'lmasa mahsulot brendi (Universal/Boshqa emas), bo'lmasa nomning birinchi so'zi. */
export function productBrand(product: Pick<Product, 'brand' | 'name'>): string {
  const words = String(product.name || '').toUpperCase().split(/[^\p{L}\p{N}+]+/u).filter(Boolean);
  const known = words.find((w) => KNOWN_BRANDS.includes(w));
  if (known) return known === 'APPLE' ? 'IPHONE' : known;
  const brand = String(product.brand || '').trim();
  if (brand && !/^(boshqa|other|universal|noma'lum|-)$/i.test(brand)) return brand.toUpperCase();
  return words[0] || 'BOSHQA';
}

/** Ekran turi nomdan: LCD PRO, EKB, MMJ, INSELL, OLED, ORIGINAL, LCD. Topilmasa null. */
export function screenType(name: string): string | null {
  const n = ` ${String(name || '').toUpperCase().replace(/[^\p{L}\p{N}+]+/gu, ' ')} `;
  if (/ (INSELL|INCELL) /.test(n)) return 'INSELL';
  if (/ (AMOLED|OLED) /.test(n)) return 'OLED';
  if (/ (ORIGINAL|ORIG) /.test(n)) return 'ORIGINAL';
  if (/ EKB /.test(n)) return 'EKB';
  if (/ MMJ /.test(n)) return 'MMJ';
  if (/ LCD PRO /.test(n)) return 'LCD PRO';
  if (/ (LCD|TFT) /.test(n)) return 'LCD';
  return null;
}

export const OTHER_TYPE = 'BOSHQA';
const TYPE_ORDER = ['LCD PRO', 'EKB', 'MMJ', 'INSELL', 'OLED', 'ORIGINAL', 'LCD', OTHER_TYPE];

export type PromoGroupBy = 'type' | 'brand';

/** Kategoriyada ekran turlari ko'p uchrasa — tur bo'yicha, aks holda brend bo'yicha bo'linadi. */
export function promoGroupMode(products: Product[], category: string): PromoGroupBy {
  const list = products.filter((p) => p.category === category && p.stock > 0);
  if (!list.length) return 'brand';
  const typed = list.filter((p) => screenType(p.name)).length;
  return typed / list.length >= 0.5 ? 'type' : 'brand';
}

const unitKey = (p: Product, by: PromoGroupBy) => (by === 'type' ? screenType(p.name) || OTHER_TYPE : productBrand(p));

const collator = new Intl.Collator('uz', { numeric: true, sensitivity: 'base' });

export function promoKeys(products: Product[], category: string, by: PromoGroupBy, inStockOnly = true): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  products
    .filter((p) => p.category === category && (!inStockOnly || p.stock > 0))
    .forEach((p) => { const k = unitKey(p, by); counts.set(k, (counts.get(k) || 0) + 1); });
  const rank = (k: string) => (by === 'type' ? (TYPE_ORDER.indexOf(k) + 1 || 99) : 0);
  return Array.from(counts, ([key, count]) => ({ key, count }))
    .sort((a, b) => rank(a.key) - rank(b.key) || b.count - a.count || collator.compare(a.key, b.key));
}

/** Eski nom (brend bo'yicha ro'yxat) — moslik uchun. */
export const promoBrands = (products: Product[], category: string, inStockOnly = true) =>
  promoKeys(products, category, 'brand', inStockOnly).map(({ key, count }) => ({ brand: key, count }));

export interface PromoUnit {
  /** Bitta PDF: tur (EKB...) yoki brend. */
  key: string;
  sections: PromoGroup[];
}

const toItem = (p: Product): PromoItem => ({
  id: p.id,
  name: p.name.trim(),
  stock: Math.max(0, Math.floor(p.stock)),
  retail: p.sellingPrice,
  wholesale: p.wholesalePrice && p.wholesalePrice > 0 ? p.wholesalePrice : undefined,
  currency: currencyOf(p)
});

/** Har bir PDF (tur yoki brend) uchun brend bo'limlari. */
export function buildPromoUnits(products: Product[], filter: { category: string; by: PromoGroupBy; keys?: string[]; inStockOnly?: boolean }): PromoUnit[] {
  const wanted = new Set((filter.keys || []).map((k) => k.toUpperCase()));
  const units = new Map<string, Map<string, PromoItem[]>>();
  for (const p of products) {
    if (p.category !== filter.category) continue;
    if (filter.inStockOnly !== false && !(p.stock > 0)) continue;
    const key = unitKey(p, filter.by);
    if (wanted.size && !wanted.has(key)) continue;
    const brand = productBrand(p);
    const sections = units.get(key) || new Map<string, PromoItem[]>();
    sections.set(brand, [...(sections.get(brand) || []), toItem(p)]);
    units.set(key, sections);
  }
  const rank = (k: string) => (filter.by === 'type' ? (TYPE_ORDER.indexOf(k) + 1 || 99) : 0);
  return Array.from(units, ([key, sections]) => ({
    key,
    sections: Array.from(sections, ([brand, items]) => ({ brand, items: items.sort((a, b) => collator.compare(a.name, b.name)) }))
      .sort((a, b) => b.items.length - a.items.length || collator.compare(a.brand, b.brand))
  })).sort((a, b) => rank(a.key) - rank(b.key) || collator.compare(a.key, b.key));
}

export function buildPromoGroups(products: Product[], filter: PromoFilter): PromoGroup[] {
  const wanted = new Set((filter.brands || []).map((b) => b.toUpperCase()));
  const q = String(filter.query || '').trim().toLowerCase();
  const groups = new Map<string, PromoItem[]>();
  for (const p of products) {
    if (p.category !== filter.category) continue;
    if (filter.inStockOnly !== false && !(p.stock > 0)) continue;
    const brand = productBrand(p);
    if (wanted.size && !wanted.has(brand)) continue;
    if (q && !p.name.toLowerCase().includes(q)) continue;
    const list = groups.get(brand) || [];
    list.push({
      id: p.id,
      name: p.name.trim(),
      stock: Math.max(0, Math.floor(p.stock)),
      retail: p.sellingPrice,
      wholesale: p.wholesalePrice && p.wholesalePrice > 0 ? p.wholesalePrice : undefined,
      currency: currencyOf(p)
    });
    groups.set(brand, list);
  }
  return Array.from(groups, ([brand, items]) => ({ brand, items: items.sort((a, b) => collator.compare(a.name, b.name)) }))
    .sort((a, b) => b.items.length - a.items.length || collator.compare(a.brand, b.brand));
}

/** Guruhlarni sahifalarga bo'ladi: brend sarlavhasi ham bitta qator hisoblanadi; sahifa oxirida yolg'iz sarlavha qolmaydi. */
export function paginatePromo(groups: PromoGroup[], rowsPerPage: number, firstPageRows = rowsPerPage): PromoRow[][] {
  const pages: PromoRow[][] = [];
  let page: PromoRow[] = [];
  let limit = firstPageRows;
  let index = 0;
  const flush = () => { if (page.length) pages.push(page); page = []; limit = rowsPerPage; };
  for (const group of groups) {
    let continued = false;
    let i = 0;
    while (i < group.items.length) {
      if (limit - page.length < 2) flush();
      page.push({ kind: 'group', brand: group.brand, count: group.items.length, continued });
      while (i < group.items.length && page.length < limit) {
        page.push({ kind: 'item', index: ++index, item: group.items[i++] });
      }
      if (i < group.items.length) { flush(); continued = true; }
    }
  }
  flush();
  return pages;
}

export const promoTotals = (groups: PromoGroup[]) => ({
  models: groups.reduce((s, g) => s + g.items.length, 0),
  pieces: groups.reduce((s, g) => s + g.items.reduce((t, i) => t + i.stock, 0), 0)
});

export interface PromoContacts {
  title: string;
  phones: string;
  address: string;
  link: string;
}

/** Kanal posti uchun matn (Telegram caption: 1024 belgigacha). */
export function promoCaption(category: string, brands: string[], groups: PromoGroup[], contacts: PromoContacts, date = new Date(), unitLabel?: string): string {
  const { models, pieces } = promoTotals(groups);
  const day = date.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });
  const brandText = brands.length ? brands.join(', ') : groups.slice(0, 6).map((g) => g.brand).join(', ') + (groups.length > 6 ? ' va boshqalar' : '');
  const lines = [
    unitLabel ? `🔥 ${category.toUpperCase()} — ${unitLabel}` : `🔥 ${category.toUpperCase()} — ${brandText}`,
    unitLabel ? `📱 ${brandText}` : '',
    '',
    `✅ Omborda bor: ${models} xil model (${pieces} dona)`,
    `📅 Narxlar ${day} holatiga`,
    `📄 To'liq narxlar ro'yxati — PDF faylda 👇`,
    '',
    contacts.phones ? `📞 ${contacts.phones.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).join(' | ')}` : '',
    contacts.address ? `📍 ${contacts.address}` : '',
    contacts.link ? `👉 ${contacts.link}` : ''
  ].filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''));
  return lines.join('\n').slice(0, 1000);
}
