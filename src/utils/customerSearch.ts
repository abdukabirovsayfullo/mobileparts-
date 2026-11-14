import type { CustomerProfile, DebtRecord } from '../types';

/**
 * Sotuv oynasidagi "Kimga sotildi" qidiruvi uchun mijozlar ro'yxati.
 * Doimiy mijozlar, nasiyasi bor xaridorlar va serverdan topilganlar bitta
 * ro'yxatga birlashtiriladi, shunda "NURU" yozilsa "Nurullo aka usta" chiqadi.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h'
};

/** Kichik harf, kirill → lotin, apostroflar olib tashlanadi, bo'shliqlar bittaga. */
export const normalizeSearchText = (value: string | undefined | null): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .replace(/[ʻʼ'`‘’ʹ]/g, '')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const phoneKey = (phone: string | undefined | null): string => String(phone || '').replace(/\D/g, '').slice(-9);

export interface CustomerOption {
  key: string;
  name: string;
  phone: string;
  address: string;
  lastVisit?: string;
  /** Faol nasiyalar (mahalliy ma'lumotda bo'lsa). */
  activeDebts: DebtRecord[];
  debtUZS: number;
  debtUSD: number;
  source: 'customer' | 'debt' | 'remote';
}

/** Serverdagi /debts/lookup javobidagi qisqa nasiya yozuvi. */
export interface RemoteDebtHit {
  id: string;
  customerName: string;
  currency?: 'UZS' | 'USD';
  remainingAmount: number;
}

const optionKey = (name: string, phone: string): string => {
  const p = phoneKey(phone);
  return p.length >= 9 ? `p:${p}` : `n:${normalizeSearchText(name)}`;
};

const isPlaceholderName = (name: string): boolean => {
  const n = normalizeSearchText(name);
  return !n || n === 'dokon mijozi' || n === 'oddiy mijoz';
};

export const buildCustomerOptions = (
  customers: CustomerProfile[],
  debts: DebtRecord[],
  remoteCustomers: CustomerProfile[] = [],
  remoteDebts: RemoteDebtHit[] = []
): CustomerOption[] => {
  const byKey = new Map<string, CustomerOption>();
  const byName = new Map<string, CustomerOption>();

  const add = (c: { name: string; phone?: string; address?: string; lastVisit?: string }, source: CustomerOption['source']) => {
    if (isPlaceholderName(c.name)) return undefined;
    const phone = (c.phone || '').trim();
    const nameKey = normalizeSearchText(c.name);
    const existing = byKey.get(optionKey(c.name, phone)) || byName.get(nameKey);
    if (existing) {
      if (!phoneKey(existing.phone) && phoneKey(phone)) existing.phone = phone;
      if (!existing.address && c.address) existing.address = c.address;
      if ((c.lastVisit || '') > (existing.lastVisit || '')) existing.lastVisit = c.lastVisit;
      return existing;
    }
    const option: CustomerOption = {
      key: optionKey(c.name, phone), name: c.name.trim(), phone, address: c.address || '', lastVisit: c.lastVisit,
      activeDebts: [], debtUZS: 0, debtUSD: 0, source
    };
    byKey.set(option.key, option);
    byName.set(nameKey, option);
    return option;
  };

  customers.forEach((c) => add(c, 'customer'));
  remoteCustomers.forEach((c) => add(c, 'remote'));

  debts
    .filter((d) => d.status !== 'yopildi' && d.remainingAmount > 0)
    .forEach((d) => {
      const option = add({ name: d.customerName, phone: d.customerPhone, lastVisit: d.createdAt }, 'debt');
      if (!option) return;
      option.activeDebts.push(d);
      if (d.currency === 'USD') option.debtUSD += d.remainingAmount; else option.debtUZS += d.remainingAmount;
    });

  // Serverdan kelgan nasiyalar (kassirda mahalliy nasiya ro'yxati bo'lmaydi).
  const seenRemoteDebt = new Set<string>();
  remoteDebts.forEach((d) => {
    if (seenRemoteDebt.has(d.id) || d.remainingAmount <= 0) return;
    seenRemoteDebt.add(d.id);
    const option = add({ name: d.customerName }, 'debt');
    if (!option || option.activeDebts.some((x) => x.id === d.id)) return;
    if (d.currency === 'USD') option.debtUSD += d.remainingAmount; else option.debtUZS += d.remainingAmount;
  });

  return Array.from(byKey.values());
};

const hasDebt = (o: CustomerOption) => o.debtUZS > 0 || o.debtUSD > 0;

/**
 * Har bir so'z ism, telefon yoki manzilda bo'lishi kerak ("nur usta" → "Nurullo aka usta").
 * Ism boshidan mos kelganlar birinchi, keyin so'z boshidan, keyin nasiyasi borlar.
 */
export const searchCustomerOptions = (options: CustomerOption[], query: string, limit = 50): CustomerOption[] => {
  const q = normalizeSearchText(query);
  if (isPlaceholderName(query) || !q) {
    return options
      .slice()
      .sort((a, b) => Number(hasDebt(b)) - Number(hasDebt(a)) || (b.lastVisit || '').localeCompare(a.lastVisit || '') || a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  const tokens = q.split(' ');
  const qDigits = query.replace(/\D/g, '');

  const scored: Array<{ o: CustomerOption; score: number }> = [];
  for (const o of options) {
    const name = normalizeSearchText(o.name);
    const phoneDigits = o.phone.replace(/\D/g, '');
    const haystack = `${name} ${normalizeSearchText(o.address)} ${phoneDigits}`;
    const tokensMatch = tokens.every((t) => haystack.includes(t));
    const phoneMatch = qDigits.length >= 3 && phoneDigits.includes(qDigits);
    if (!tokensMatch && !phoneMatch) continue;

    let score = 0;
    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 60;
    else if (name.split(' ').some((w) => w.startsWith(tokens[0]))) score += 40;
    else if (name.includes(tokens[0])) score += 20;
    if (phoneMatch) score += 30;
    if (hasDebt(o)) score += 5;
    scored.push({ o, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || (b.o.lastVisit || '').localeCompare(a.o.lastVisit || '') || a.o.name.localeCompare(b.o.name))
    .slice(0, limit)
    .map((x) => x.o);
};
