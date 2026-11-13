import type { PosDatabaseState } from './dataStore';
import type { authReplica } from './auth';
import type { repairReplica } from './repairStore';

export type DeviceSnapshot = {
  pos: PosDatabaseState;
  auth: ReturnType<typeof authReplica.read>;
  repairs: ReturnType<typeof repairReplica.read>;
};

type Entry = Record<string, unknown>;
export type MergeConflict = { path: string; local?: unknown; vps?: unknown };

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is Entry => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const cents = (value: number) => Math.round(value * 100) / 100;

export function mergeDeviceState(base: DeviceSnapshot | undefined, local: DeviceSnapshot, vps: DeviceSnapshot) {
  const conflicts: MergeConflict[] = [];
  const report = (path: string, l: unknown, r: unknown) => conflicts.push({ path, local: l, vps: r });
  function stockChanges(from: DeviceSnapshot, against: DeviceSnapshot) {
    const existing = new Set(against.pos.movements.map(m => m.id));
    const changes = new Map<string, number>();
    for (const movement of from.pos.movements) {
      if (existing.has(movement.id) || movement.isHistoricalAggregate) continue;
      const change = movement.type === 'kirim' ? movement.quantity
        : movement.type === 'chiqim' ? -movement.quantity
        : movement.type === 'vazvrat' && !movement.notes?.includes('Yaroqsiz: omborga qaytarilmadi')
          ? movement.quantity : 0;
      changes.set(movement.productId, (changes.get(movement.productId) ?? 0) + change);
    }
    return changes;
  }
  const localStockChanges = stockChanges(local, base ?? vps);
  const vpsStockChanges = base ? stockChanges(vps, base) : new Map<string, number>();

  function mergeList(b: unknown[], l: unknown[], r: unknown[], path: string): unknown[] {
    // Entries without IDs (categories and older payments) get occurrence keys.
    // Independent payments with identical values must still count twice.
    const payments = path.endsWith('.paymentHistory');
    const index = (items: unknown[], side: string) => {
      const counts = new Map<string, number>();
      return new Map(items.map((item, i) => {
        if (object(item) && typeof item.id === 'string') return ['id:' + item.id, item];
        if (payments && i >= b.length && base) return [side + ':' + i, item];
        const key = JSON.stringify(item);
        const count = counts.get(key) ?? 0;
        counts.set(key, count + 1);
        return ['value:' + key + ':' + count, item];
      }));
    };
    const bi = index(b, 'base'), li = index(l, 'local'), ri = index(r, 'vps');
    return [...new Set([...ri.keys(), ...li.keys(), ...bi.keys()])].flatMap(key => {
      const result = merge(bi.get(key), li.get(key), ri.get(key), path + '.' + key);
      return result === undefined ? [] : [result];
    });
  }

  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (path.endsWith('.lastUpdated') || path.endsWith('.updatedAt')) {
      if (typeof l === 'string' && typeof r === 'string') return l > r ? l : r;
    }
    if (path.endsWith('.deviceLastMerge')) return r;
    if (path === 'repairs.nextOrderNumber') return Math.max(number(l), number(r));

    if (object(l) && object(r)) {
      const prior = object(b) ? b : undefined;
      const merged: Entry = {};
      const product = /^pos\.products\.id:[^.]+$/.test(path);
      const debt = /^pos\.(debts|supplierDebts)\.id:[^.]+$/.test(path) && (prior || !base) &&
        typeof l.paidAmount === 'number' && typeof r.paidAmount === 'number';
      const derivedDebtFields = ['paidAmount', 'remainingAmount', 'status'];
      for (const key of new Set([...Object.keys(r), ...Object.keys(l), ...Object.keys(prior ?? {})])) {
        if ((product && key === 'stock' && (prior || !base)) || (debt && derivedDebtFields.includes(key))) continue;
        const value = merge(prior?.[key], l[key], r[key], path ? path + '.' + key : key);
        if (value !== undefined) merged[key] = value;
      }
      if (product && typeof l.stock === 'number' && typeof r.stock === 'number') {
        if (typeof prior?.stock === 'number') {
          const localDelta = localStockChanges.get(String(l.id)) ?? 0;
          const vpsDelta = vpsStockChanges.get(String(l.id)) ?? 0;
          const localManual = l.stock - prior.stock - localDelta;
          const vpsManual = r.stock - prior.stock - vpsDelta;
          if (localManual && vpsManual) {
            merged.stock = r.stock + localDelta;
            if (localManual !== vpsManual) report(path + '.stock', l.stock, r.stock);
          } else {
            merged.stock = l.stock + r.stock - prior.stock;
          }
        }
        else if (!base) {
          merged.stock = r.stock + (localStockChanges.get(String(l.id)) ?? 0);
          if (l.stock !== r.stock) report(path + '.stock', l.stock, r.stock);
        }
        if (number(merged.stock) < 0) report(path + '.stock (negative after merge)', l.stock, r.stock);
      }
      if (debt) {
        const paymentTotal = (entry: Entry) => Array.isArray(entry.paymentHistory)
          ? entry.paymentHistory.reduce((sum, payment) => sum + (object(payment) ? number(payment.amount) : 0), 0)
          : 0;
        const carry = Math.max(0, number(l.paidAmount) - paymentTotal(l), number(r.paidAmount) - paymentTotal(r));
        merged.paidAmount = cents(prior
          ? number(l.paidAmount) + number(r.paidAmount) - number(prior.paidAmount)
          : carry + paymentTotal(merged));
        merged.remainingAmount = Math.max(0, cents(number(merged.totalDebt) - number(merged.paidAmount)));
        merged.status = merged.remainingAmount === 0 ? 'yopildi' : number(merged.paidAmount) > 0 ? 'qisman_tolandi' : 'faol';
        if (number(merged.paidAmount) > number(merged.totalDebt)) report(path + '.overpayment', l.paidAmount, r.paidAmount);
      }
      return merged;
    }
    if (Array.isArray(l) && Array.isArray(r)) return mergeList(Array.isArray(b) ? b : [], l, r, path);
    if (equal(l, r)) return r;
    if (equal(l, b)) return r;
    if (equal(r, b)) return l;
    report(path, l, r);
    // Keep an edited entry if the other copy deleted it. For conflicting scalar
    // edits the current VPS value stays active and both values go into the audit.
    return r === undefined ? l : r;
  }

  const state = structuredClone(merge(base, local, vps, '')) as DeviceSnapshot;
  // Repair tickets created during an outage can have the same human-facing
  // number. Retain both ticket IDs and allocate a new number to the local copy.
  const used = new Set<number>();
  for (const order of state.repairs.orders) {
    if (used.has(order.orderNumber)) {
      const previous = order.orderNumber;
      order.orderNumber = state.repairs.nextOrderNumber++;
      report('repairs.orders.' + order.id + '.orderNumber', previous, order.orderNumber);
    }
    used.add(order.orderNumber);
    state.repairs.nextOrderNumber = Math.max(state.repairs.nextOrderNumber, order.orderNumber + 1);
  }
  return { state, conflicts };
}
