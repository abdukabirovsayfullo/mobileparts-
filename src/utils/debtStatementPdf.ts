import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sanitizeText } from './pdfGenerator';
import { DebtStatementParams, displayDay, formatDateTime, formatSom } from './debtStatementReceipt';

/** Mijozga eslatish uchun A4 nasiya hisobi. */
export function createDebtStatementPdf({ customer, store, from, to, totalDebt }: DebtStatementParams): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(24, 24, 27);
  doc.rect(14, 12, 182, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sanitizeText(store.name.toUpperCase()), 20, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(`Tel: ${sanitizeText(store.phone)} | Manzil: ${sanitizeText(store.address)}`, 20, 28);

  doc.setFillColor(245, 158, 11);
  doc.roundedRect(150, 16, 40, 15, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NASIYA HISOBI', 154, 25);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  const meta: [string, string][] = [
    ['Mijoz:', customer.name],
    ['Telefon:', customer.phone && customer.phone.trim() !== '+998' ? customer.phone : '-'],
    ['Davr:', `${displayDay(from)} - ${displayDay(to)}`],
    ['Hisob sanasi:', new Date().toLocaleDateString('ru-RU')]
  ];
  meta.forEach(([label, value], i) => {
    const y = 44 + i * 6;
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(value), 42, y);
  });

  autoTable(doc, {
    startY: 72,
    head: [['#', 'Sana va soat', 'Olingan tovarlar', 'Sotuv', "To'langan", 'Nasiya', 'Muddat']],
    body: customer.rows.map((r, i) => [
      String(i + 1),
      formatDateTime(r.debt.createdAt),
      sanitizeText(r.itemLines.join('\n')) || '-',
      formatSom(r.debt.totalDebt),
      formatSom(r.debt.paidAmount),
      formatSom(r.debt.remainingAmount),
      r.debt.dueDate || '-'
    ]),
    foot: [['', '', 'Davr bo\'yicha jami', formatSom(customer.saleTotal), formatSom(customer.paid), formatSom(customer.remaining), '']],
    margin: { left: 14, right: 14 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 28 },
      2: { cellWidth: 52 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22 }
    }
  });

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100) + 8;
  if (y > 255) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(14, y, 182, 16, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Umumiy qarzdorlik: ${formatSom(totalDebt)}`, 20, y + 10);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(sanitizeText(`Iltimos, nasiya to'lovini muddatida amalga oshiring. Murojaat uchun: ${store.phone}`), 14, y + 24);

  return doc;
}

export function debtStatementFileName(customerName: string, from: string, to: string): string {
  const safe = customerName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'mijoz';
  return `Nasiya_${safe}_${from}_${to}.pdf`;
}
