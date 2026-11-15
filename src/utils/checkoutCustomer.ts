export function debtCustomerError(name: string, phone: string): string {
  const normalized = name.toLowerCase().replace(/[‘’ʻʼ'`\s-]/g, '');
  if (name.trim().length < 2 || ['dokonmijozi','chakanaxaridor','chakanamijoz','mijoz','oddiymijoz'].includes(normalized)) {
    return 'Nasiya uchun aniq mijozni tanlang yoki yangi mijozning ismini yozing. Do‘kon mijozi nomiga qarz yozilmaydi.';
  }
  const digits = phone.replace(/\D/g, '');
  if (!(digits.length === 9 || (digits.length === 12 && digits.startsWith('998')))) return 'Nasiya uchun mijozning to‘liq telefon raqamini kiriting.';
  return '';
}
