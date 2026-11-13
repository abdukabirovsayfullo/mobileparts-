import { mergeDeviceState, type DeviceSnapshot } from '../../server/deviceMerge';

export const browserSnapshot = (state: any) => structuredClone(Object.fromEntries(
  ['products', 'movements', 'debts', 'supplierDebts', 'categories', 'storeInfo'].map(key => [key, state[key]])
));

export function mergeBrowserSnapshot(base: any, local: any, remote: any) {
  if (JSON.stringify(local) === JSON.stringify(remote)) return structuredClone(remote);
  const wrap = (pos: any) => ({ pos, auth: {}, repairs: { orders: [], nextOrderNumber: 1 } }) as unknown as DeviceSnapshot;
  const merged = mergeDeviceState(wrap(base), wrap(local), wrap(remote)).state.pos;
  const oldIds = new Set(base.movements.map((m: any) => m.id));
  const remoteIds = new Set(remote.movements.map((m: any) => m.id));
  for (const movement of local.movements) {
    if (oldIds.has(movement.id) || !remoteIds.has(movement.id) || movement.isHistoricalAggregate) continue;
    const original = base.products.find((p: any) => p.id === movement.productId);
    const product = merged.products.find(p => p.id === movement.productId);
    if (!original || !product) continue;
    const delta = movement.type === 'kirim' ? movement.quantity : movement.type === 'chiqim' ? -movement.quantity
      : movement.type === 'vazvrat' && !movement.notes?.includes('Yaroqsiz: omborga qaytarilmadi') ? movement.quantity : 0;
    product.stock -= delta;
  }
  for (const key of ['debts', 'supplierDebts'] as const) {
    for (const entry of merged[key]) {
      const b = base[key].find((x: any) => x.id === entry.id);
      const l = local[key].find((x: any) => x.id === entry.id);
      const r = remote[key].find((x: any) => x.id === entry.id);
      if (!b || !l || !r) continue;
      const counts = (history: any[]) => {
        const result = new Map<string, number>();
        for (const p of history || []) { const id = JSON.stringify(p); result.set(id, (result.get(id) || 0) + 1); }
        return result;
      };
      const bc = counts(b.paymentHistory), lc = counts(l.paymentHistory), rc = counts(r.paymentHistory);
      let shared = 0;
      for (const [id, count] of lc) {
        const overlap = Math.max(0, Math.min(count - (bc.get(id) || 0), (rc.get(id) || 0) - (bc.get(id) || 0)));
        shared += overlap * (Number(JSON.parse(id).amount) || 0);
      }
      if (shared) {
        entry.paidAmount = Math.max(0, entry.paidAmount - shared);
        entry.remainingAmount = Math.max(0, entry.totalDebt - entry.paidAmount);
        entry.status = entry.remainingAmount === 0 ? 'yopildi' : entry.paidAmount > 0 ? 'qisman_tolandi' : 'faol';
      }
    }
  }
  return merged;
}
