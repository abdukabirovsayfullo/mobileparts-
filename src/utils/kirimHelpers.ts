import type { Product, StockMovement } from '../types';

export interface LastKirim {
  movement: StockMovement;
  /** Undan oldingi kirimdagi tan narx (narx o'zgarishini ko'rsatish uchun). */
  previousCost?: number;
}

/** Har bir tovarning eng oxirgi kirimi (qaytarishlarsiz) va undan oldingi tan narxi. */
export function lastKirimByProduct(movements: StockMovement[]): Map<string, LastKirim> {
  const byProduct = new Map<string, StockMovement[]>();
  for (const m of movements) {
    if (m.type !== 'kirim' || m.isReturn) continue;
    const list = byProduct.get(m.productId);
    if (list) list.push(m);
    else byProduct.set(m.productId, [m]);
  }
  const result = new Map<string, LastKirim>();
  for (const [productId, list] of byProduct) {
    const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    result.set(productId, { movement: sorted[0], previousCost: sorted[1]?.unitCost });
  }
  return result;
}

/** Oxirgi kirim qilingan tovarlar (takrorlanmasdan, eng yangisi birinchi). */
export function recentKirimProductIds(movements: StockMovement[], limit = 8): string[] {
  const sorted = movements
    .filter((m) => m.type === 'kirim' && !m.isReturn)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return Array.from(new Set(sorted.map((m) => m.productId))).slice(0, limit);
}

/** Qoldig'i tugagan yoki minimal chegaradan past tovarlar, eng kami birinchi. */
export function lowStockProducts(products: Product[]): Product[] {
  return products
    .filter((p) => p.stock <= (p.minStockAlert ?? 0))
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
}

/** Tan narxga nisbatan foyda (so'm va foiz). */
export function marginInfo(cost: number, retail: number): { profit: number; percent: number } {
  const profit = retail - cost;
  return { profit, percent: cost > 0 ? Math.round((profit / cost) * 1000) / 10 : 0 };
}

/** Oldingi narxga nisbatan o'zgarish foizi; oldingi narx yo'q bo'lsa undefined. */
export function costChangePercent(previous: number | undefined, current: number): number | undefined {
  if (!previous || previous <= 0 || !(current > 0)) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

interface MergeableItem {
  product: { id: string };
  quantity: number;
  unitCost: number;
  unitPrice: number;
  wholesalePrice?: number;
  usdCost?: number;
  usdRate?: number;
}

/** Bir xil tovar bir xil narxlarda qayta qo'shilsa, yangi qator ochmasdan miqdorini oshiradi. */
export function addDraftItem<T extends MergeableItem>(items: T[], item: T): T[] {
  const index = items.findIndex(
    (it) =>
      it.product.id === item.product.id &&
      it.unitCost === item.unitCost &&
      it.unitPrice === item.unitPrice &&
      it.wholesalePrice === item.wholesalePrice &&
      it.usdCost === item.usdCost &&
      it.usdRate === item.usdRate
  );
  if (index === -1) return [...items, item];
  return items.map((it, i) => (i === index ? { ...it, quantity: it.quantity + item.quantity } : it));
}