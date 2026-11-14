import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StoreSettings } from '../types';
import { sanitizeText } from './pdfGenerator';
import { displayDay, formatSom } from './debtStatementReceipt';

/** Toshkent vaqti (ekrandagi bilan bir xil), qurilma soat mintaqasidan qat'i nazar. */
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
import type { CustomerStatement } from './customerStatement';

const METHOD: Record<string, string> = { naqd: 'Naqd', click_payme: 'Click / Payme', uzum: 'Uzum', vazvrat: 'Tovar qaytarildi' };

/** Mijozga yuborish uchun A4 "Mijoz hisobi": kun bo'yicha xaridlar, to'lovlar, hozirgi umumiy qarz. */
export function createCustomerStatementPdf(s: CustomerStatement, store: StoreSettings): jsPDF {
  const som = (v: number) => formatSom(v, s.currency);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;

  // Sarlavha
  doc.setFillColor(24, 24, 27);
  doc.rect(14, 12, 182, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sanitizeText(store.name.toUpperCase()), 20, 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  const contact = doc.splitTextToSize(sanitizeText(`Tel: ${store.phone || '-'} | Manzil: ${store.address || '-'}`), 126) as string[];
  doc.text(contact.slice(0, 2), 20, 27);
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(152, 16, 38, 15, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MIJOZ HISOBI', 156.5, 25);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  const period = s.from || s.to ? `${s.from ? displayDay(s.from) : 'boshidan'} - ${s.to ? displayDay(s.to) : 'bugungacha'}` : 'Butun tarix';
  const meta: [string, string][] = [
    ['Mijoz:', s.name],
    ['Telefon:', s.phone && s.phone.replace(/\D/g, '').length > 3 ? s.phone : '-'],
    ['Davr:', period],
    ['Hisob sanasi:', formatDateTime(new Date().toISOString())]
  ];
  meta.forEach(([label, value], i) => {
    const y = 44 + i * 6;
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(value), 42, y);
  });

  // Xaridlar (kun bo'yicha)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Olingan tovarlar', 14, 74);
  const body: any[] = [];
  let n = 0;
  for (const day of s.days) {
    body.push([{ content: `${displayDay(day.day)}  —  ${som(day.total)}`, colSpan: 5, styles: { fillColor: [254, 243, 199], fontStyle: 'bold', textColor: [120, 53, 15] } }]);
    for (const p of day.purchases) {
      if (!p.items.length) {
        body.push([String(++n), { content: sanitizeText(p.note || "Qo'lda yozilgan nasiya"), colSpan: 3, styles: { fontStyle: 'italic' } }, som(p.amount)]);
        continue;
      }
      for (const it of p.items) {
        const name = sanitizeText(it.name) + (it.returnedQty ? `\n(${it.returnedQty} ta qaytarilgan)` : '');
        body.push([String(++n), name, `${it.quantity} ta`, som(it.unitPrice), som(it.total)]);
      }
    }
  }
  if (!body.length) body.push([{ content: 'Bu davrda xarid yo\'q', colSpan: 5, styles: { halign: 'center', textColor: [120, 113, 108] } }]);
  autoTable(doc, {
    startY: 77,
    head: [['#', 'Tovar', 'Soni', 'Narxi', 'Jami']],
    body,
    foot: [[{ content: 'Davrdagi xaridlar jami', colSpan: 4 }, som(s.period.purchases)]],
    margin: { left: 14, right: 14 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, valign: 'top' },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' },
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 95 }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } }
  });

  // To'lovlar va qaytarishlar
  let y = lastY() + 9;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("To'lovlar", 14, y);
  const pays = [...s.payments, ...s.returns].sort((a, b) => a.date.localeCompare(b.date));
  autoTable(doc, {
    startY: y + 3,
    head: [['Sana va soat', "To'lov turi", 'Qabul qildi', 'Summa']],
    body: pays.length
      ? pays.map((p) => [formatDateTime(p.date), METHOD[p.method] || p.method, sanitizeText(p.employeeName || '-'), `-${som(p.amount)}`])
      : [[{ content: "Bu davrda to'lov yo'q", colSpan: 4, styles: { halign: 'center', textColor: [120, 113, 108] } }]],
    foot: pays.length ? [[{ content: "Davrdagi to'lovlar jami", colSpan: 3 }, `-${som(s.period.payments + s.period.returns)}`]] : undefined,
    margin: { left: 14, right: 14 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    footStyles: { fillColor: [236, 253, 245], textColor: [6, 78, 59], fontStyle: 'bold', halign: 'right' },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 2: { cellWidth: 62 }, 3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } }
  });

  // Yakuniy qarz
  y = lastY() + 8;
  if (y > 262) { doc.addPage(); y = 20; }
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(14, y, 182, 16, 2, 2, 'FD');
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('HOZIRGI UMUMIY QARZ:', 20, y + 10.2);
  doc.text(som(s.currentDebt), 190, y + 10.2, { align: 'right' });

  doc.setTextColor(120, 113, 108);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(sanitizeText("To'lovlar mijozning umumiy qarzidan ayriladi. Savollar bo'lsa, biz bilan bog'laning."), 14, Math.min(y + 24, 290));
  return doc;
}

export const customerStatementFileName = (name: string, from: string, to: string) => {
  const safe = name.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'mijoz';
  return `Hisob_${safe}${from || to ? `_${from || 'boshi'}_${to || 'bugun'}` : ''}.pdf`;
};
