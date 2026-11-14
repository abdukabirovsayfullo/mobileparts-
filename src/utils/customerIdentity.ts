export function sameCustomer(nameA: string, phoneA: string | undefined, nameB: string, phoneB: string | undefined): boolean {
  const name = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!name(nameA) || name(nameA) !== name(nameB)) return false;
  const phone = (v?: string) => (v || '').replace(/\D/g, '').slice(-9);
  const a = phone(phoneA), b = phone(phoneB);
  return a.length === 9 && b.length === 9 ? a === b : true;
}
