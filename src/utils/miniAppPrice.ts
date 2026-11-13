import type { Product } from '../types';

const ACCESSORY_CATEGORIES = new Set([
  'AKSESUAR', 'AKSESUARLAR', 'AKSESSUAR', 'AKSESSUARLAR',
  'KABEL', 'KABELLAR', 'ZARYADNIK', 'ZARYADNIKLAR', 'ZARYADKA', 'ZARYADCHIKLAR',
  'AVTO AKSESSUARLAR', 'AVTO AKSESUARLAR', 'POWERBANK', 'POWERBANKLAR',
  'HIMOYA OYNALARI', 'STEKLO', 'NAUSHNIK', 'NAUSHNIKLAR', 'CHEXOL', 'CHEXOLLAR'
]);

export function isAccessoryCategory(category: string): boolean {
  return ACCESSORY_CATEGORIES.has(category.trim().replace(/\s+/g, ' ').toUpperCase());
}

/** Use the saved wholesale price, with the regular price for older unpriced items. */
export function miniAppPrice(product: Pick<Product, 'wholesalePrice' | 'sellingPrice'>): number {
  const wholesale = Number(product.wholesalePrice);
  return Number.isFinite(wholesale) && wholesale > 0 ? wholesale : Number(product.sellingPrice);
}
