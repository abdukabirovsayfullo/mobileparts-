import type { Currency } from '../types';

export function formatMoney(amount: number | string | null | undefined, currency: Currency = 'UZS'): string {
  const num = amount === null || amount === undefined || amount === '' ? 0 : Number(amount);
  const value = isNaN(num) ? 0 : num;
  if (currency === 'USD') {
    const hasCents = Math.abs(value - Math.round(value)) > 0.0001;
    const text = value.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 }).replace(/,/g, ' ');
    return `$${text}`;
  }
  return value.toLocaleString('uz-UZ').replace(/,/g, ' ') + ' so\'m';
}
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(isoString);
  }
}

export function formatShortDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString('uz-UZ', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(isoString);
  }
}

export function generateReceiptNumber(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PB-${rand}`;
}

export function generateOrderNumber(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ON-${rand}`;
}

export function downloadCSV(filename: string, rows: string[][]): void {
  const processRow = (row: string[]) => {
    return row.map(val => {
      let finalVal = val === null || val === undefined ? '' : String(val);
      if (finalVal.search(/("|,|\n)/g) >= 0) {
        finalVal = `"${finalVal.replace(/"/g, '""')}"`;
      }
      return finalVal;
    }).join(',');
  };

  const csvContent = '\uFEFF' + rows.map(processRow).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
