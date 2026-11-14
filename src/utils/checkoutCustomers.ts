import type { CustomerProfile, PaymentMethod } from '../types';

/** Server matches are authoritative; local rows remain useful while offline. */
export function matchingCheckoutCustomers(local: CustomerProfile[], remote: CustomerProfile[], query: string): CustomerProfile[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = new Map(local.map(c => [c.id, c]));
  remote.forEach(c => rows.set(c.id, c));
  return [...rows.values()].filter(c => {
    const text = `${c.name || ''} ${c.phone || ''} ${c.address || ''}`.toLowerCase();
    return tokens.every(token => text.includes(token));
  });
}

/** Switching to credit starts a new advance, not a previous cash payment. */
export function paidAfterMethodChange(previous: PaymentMethod, next: PaymentMethod, paid: number): number {
  return next === 'nasiya' && previous !== 'nasiya' ? 0 : paid;
}
