import { firstNameToken } from './saleAccounting';
import { normalizeSearchText } from './customerSearch';

/**
 * Bir mijozmi? Asosiy qoida (saleAccounting bilan bir xil): ikkalasida ham telefon bo'lsa —
 * telefon va ismning birinchi so'zi mos kelishi kerak; aks holda to'liq ism.
 */
export function sameCustomer(nameA: string, phoneA: string | undefined, nameB: string, phoneB: string | undefined): boolean {
  if (!normalizeSearchText(nameA || '')) return false;
  const phone = (v?: string) => (v || '').replace(/\D/g, '').slice(-9);
  const a = phone(phoneA), b = phone(phoneB);
  if (a.length === 9 && b.length === 9) return a === b && firstNameToken(nameA) === firstNameToken(nameB);
  return normalizeSearchText(nameA) === normalizeSearchText(nameB);
}
