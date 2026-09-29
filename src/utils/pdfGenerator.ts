import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StoreSettings, OrderItem, Product, DebtRecord, SupplierDebtRecord, StockMovement, SaleReceiptData } from '../types';
import { formatMoney } from './formatters';

// Clean text for jsPDF standard font (replace curly quotes with straight quotes)
function sanitizeText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u2018\u2019\u02BB\u02BC`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .trim();
}

/**
 * Downloads a jsPDF instance cleanly across all modern browsers and iframe sandboxes.
 */
export function triggerPdfDownload(doc: jsPDF, fileName: string): boolean {
  const cleanName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  try {
    // 1. Primary: Use jsPDF built-in save
    doc.save(cleanName);
    return true;
  } catch (err1) {
    console.warn('doc.save failed, trying Blob URL link download:', err1);
    try {
      // 2. Fallback: Blob URL download
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 5000);
      return true;
    } catch (err2) {
      console.error('Blob URL download failed:', err2);
      // 3. Fallback: Open in new tab
      try {
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return true;
      } catch (err3) {
        console.error('All download methods failed:', err3);
        return false;
      }
    }
  }
}

/**
 * Opens the generated PDF in a new tab for direct viewing and printing.
 */
export function openPdfInNewTab(doc: jsPDF): void {
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch (e) {
    console.error('Cannot open in new tab:', e);
  }
}

/**
 * Robust HTML print function that prints cleanly.
 */
export function printHtmlElement(elementId: string = 'printable-pdf-document'): void {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  // Check if we can print directly via window.print()
  try {
    window.print();
  } catch (err) {
    console.warn('Direct window.print() failed, attempting iframe print fallback:', err);
    try {
      const existingFrame = document.getElementById('print-isolated-iframe');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'print-isolated-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Chop etish</title>
              <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: system-ui, sans-serif; color: #000; background: #fff; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 11px; }
                th { background-color: #1e293b !important; color: #ffffff !important; }
              </style>
            </head>
            <body>
              ${sourceEl.innerHTML}
            </body>
          </html>
        `);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 60000);
        }, 300);
      }
    } catch (e2) {
      console.error('All print methods failed:', e2);
    }
  }
}

// ============================================================================
// 1. ZAKAZ VARAQASI (BUYURTMA) - STRICTLY NO PRICES FOR SUPPLIER
// ============================================================================
export interface GenerateOrderPdfParams {
  storeInfo: StoreSettings;
  supplierTarget: string;
  orderItems: OrderItem[];
  dateStr?: string;
}

export function createOrderPdf(params: GenerateOrderPdfParams): jsPDF {
  const { storeInfo, supplierTarget, orderItems, dateStr } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const selected = orderItems.filter((i) => i.selected);
  const totalUnits = selected.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const displayDate = dateStr || new Date().toLocaleDateString('uz-UZ');

  // --- HEADER BANNER ---
  doc.setFillColor(24, 24, 27); // Dark Stone
  doc.rect(14, 12, 182, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sanitizeText(storeInfo.name.toUpperCase()), 20, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(`Tel: ${sanitizeText(storeInfo.phone)} | Manzil: ${sanitizeText(storeInfo.address)}`, 20, 28);

  // Document Badge on right
  doc.setFillColor(245, 158, 11); // Amber
  doc.roundedRect(144, 16, 46, 15, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BUYURTMA VARAQASI', 146, 22);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('(ZAKAZ TA\'MINOTCHI)', 146, 27);

  // --- ORDER METADATA ---
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);

  doc.setFont('helvetica', 'bold');
  doc.text("Ta'minotchi / Diler:", 14, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(sanitizeText(supplierTarget || "Barcha ta'minotchilar"), 52, 43);

  doc.setFont('helvetica', 'bold');
  doc.text('Sana:', 140, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(sanitizeText(displayDate), 152, 43);

  // Summary Pill Box (Strictly no prices - only count and units)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 47, 182, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Jami tovar turlari: ${selected.length} xil`, 20, 56);

  doc.setTextColor(180, 83, 9); // Amber dark
  doc.text(`Umumiy buyurtma: ${totalUnits} dona`, 110, 56);

  // Notice for supplier
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "* Iltimos, partiyani qutiga joylashda [ ] ustuniga qalam bilan belgilab chiqing va yetkazib berish vaqtini tasdiqlang.",
    14,
    66
  );

  // --- TABLE: STRICTLY NO PRICES ---
  const tableRows = selected.map((item, index) => {
    return [
      String(index + 1),
      '[   ]', // Checkbox for pen marking
      sanitizeText(item.model || item.name),
      sanitizeText(item.category || 'Boshqa'),
      `${item.quantity} ${sanitizeText(item.unit || 'dona')}`,
      sanitizeText(item.notes || (item.currentStock === 0 ? 'Tugagan (0 qolgan)' : ''))
    ];
  });

  autoTable(doc, {
    startY: 69,
    head: [['#', 'Qabul', 'Tovar Nomi & Modeli', 'Toifasi', 'Zakaz Soni', 'Izoh / Holati']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      2: { cellWidth: 70, fontStyle: 'bold' },
      3: { cellWidth: 30 },
      4: { halign: 'center', cellWidth: 26, fontStyle: 'bold', textColor: [180, 83, 9] },
      5: { cellWidth: 30 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    foot: [
      [
        '',
        '',
        `JAMI: ${selected.length} xil aksessuar`,
        '',
        `${totalUnits} dona`,
        ''
      ]
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    margin: { left: 14, right: 14, bottom: 28 }
  });

  // --- FOOTER & SIGNATURE (At end of document) ---
  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  const pageHeight = doc.internal.pageSize.getHeight();
  let sigY = finalY + 12;

  // If signature would overflow page, add new page
  if (sigY + 25 > pageHeight) {
    doc.addPage();
    sigY = 20;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(14, sigY, 196, sigY);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.setFont('helvetica', 'bold');
  doc.text(`Buyurtmachi: ${sanitizeText(storeInfo.name)}`, 14, sigY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mas'ul: ${sanitizeText(storeInfo.accountantName || "Do'kon mudiri")}`, 14, sigY + 13);
  doc.text("Imzo: ___________________", 14, sigY + 19);

  doc.setFont('helvetica', 'bold');
  doc.text("Ta'minotchi (Diler):", 120, sigY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Qabul qildi: ___________________`, 120, sigY + 13);
  doc.text("Imzo va sana: ___________________", 120, sigY + 19);

  // Add Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sahifa ${i} / ${totalPages}  |  Paxtaobod Beeline POS tizimi orqali shakllantirildi`,
      14,
      pageHeight - 8
    );
  }

  return doc;
}

// ============================================================================
// 2. SAVDO HISOBOTI (DAILY SALES PDF)
// ============================================================================
export interface GenerateSalesPdfParams {
  storeInfo: StoreSettings;
  startDate: string;
  endDate: string;
  transactions: StockMovement[];
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  debtRevenue: number;
  totalProfit?: number;
  includeProfit?: boolean;
}

export function createSalesPdf(params: GenerateSalesPdfParams): jsPDF {
  const {
    storeInfo,
    startDate,
    endDate,
    transactions,
    totalRevenue,
    cashRevenue,
    cardRevenue,
    debtRevenue,
    totalProfit = 0,
    includeProfit = false
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const dateTag = startDate === endDate ? startDate : `${startDate} — ${endDate}`;

  // Header
  doc.setFillColor(24, 24, 27);
  doc.rect(14, 12, 182, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sanitizeText(storeInfo.name.toUpperCase()), 20, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Tel: ${sanitizeText(storeInfo.phone)} | Davr: ${sanitizeText(dateTag)}`, 20, 28);

  doc.setFillColor(16, 185, 129); // Emerald
  doc.roundedRect(138, 16, 52, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('SAVDO HISOBOTI (KASSA)', 140, 22);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('RASMIY MOLIYAVIY CHEK', 140, 27);

  // Financial Summary Cards
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 43, 182, 18, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Jami Tushum:", 18, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(totalRevenue), 18, 56);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Naqd:", 75, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatMoney(cashRevenue), 75, 56);

  doc.setFont('helvetica', 'normal');
  doc.text("Plastik / Click:", 115, 49);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMoney(cardRevenue), 115, 56);

  doc.setFont('helvetica', 'normal');
  doc.text("Nasiyaga:", 155, 49);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(formatMoney(debtRevenue), 155, 56);

  // Profit row if enabled
  if (includeProfit) {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, 63, 182, 8, 1, 1, 'FD');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.text(`Sof Foyda (Marja): ${formatMoney(totalProfit)}`, 20, 68.5);
  }

  // Transactions Table
  const tableRows = transactions.map((t, idx) => {
    const paymentLabel = t.paymentMethod === 'naqd' ? 'Naqd' : t.paymentMethod === 'click_payme' ? 'Click' : t.paymentMethod === 'uzum' ? 'Uzum' : 'Nasiya';

    return [
      String(idx + 1),
      sanitizeText(t.timestamp ? new Date(t.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''),
      sanitizeText(`${t.productName} (${t.quantity} dona)`),
      paymentLabel,
      formatMoney(t.totalRevenue),
      sanitizeText(t.counterparty || 'Mijoz')
    ];
  });

  autoTable(doc, {
    startY: includeProfit ? 74 : 65,
    head: [['#', 'Vaqt', 'Sotilgan Tovarlar', "To'lov", 'Summa', 'Mijoz']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 14 },
      2: { cellWidth: 85 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      5: { cellWidth: 29 }
    },
    margin: { left: 14, right: 14, bottom: 25 }
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sahifa ${i} / ${totalPages}  |  Paxtaobod Beeline POS Savdo Hisoboti`,
      14,
      pageHeight - 8
    );
  }

  return doc;
}

// ============================================================================
// 3. OMBOR INVENTARIZATSIYASI (STOCK INVENTORY PDF)
// ============================================================================
export interface GenerateStockPdfParams {
  storeInfo: StoreSettings;
  products: Product[];
  categoryFilter?: string;
  dateStr?: string;
}

export function createStockInventoryPdf(params: GenerateStockPdfParams): jsPDF {
  const { storeInfo, products, categoryFilter, dateStr } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const displayDate = dateStr || new Date().toLocaleDateString('uz-UZ');
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalPurchaseValue = products.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0);

  // Header
  doc.setFillColor(24, 24, 27);
  doc.rect(14, 12, 182, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sanitizeText(storeInfo.name.toUpperCase()), 20, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Ombor & Qoldiqlar | Sana: ${sanitizeText(displayDate)}`, 20, 28);

  doc.setFillColor(245, 158, 11);
  doc.roundedRect(138, 16, 52, 15, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('OMBOR QOLDIQLARI', 142, 22);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('INVENTARIZATSIYA', 142, 27);

  // Summary
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 43, 182, 16, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Tovar turlari:", 18, 49);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${products.length} xil`, 18, 55);

  doc.setFont('helvetica', 'normal');
  doc.text("Jami qoldiq:", 65, 49);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalUnits} dona`, 65, 55);

  doc.setFont('helvetica', 'normal');
  doc.text("Tan narxi qiymati:", 115, 49);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMoney(totalPurchaseValue), 115, 55);

  doc.setFont('helvetica', 'normal');
  doc.text("Sotish qiymati:", 155, 49);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(formatMoney(totalRetailValue), 155, 55);

  const tableRows = products.map((p, idx) => {
    return [
      String(idx + 1),
      sanitizeText(p.name),
      sanitizeText(p.category || 'Boshqa'),
      String(p.stock),
      formatMoney(p.purchasePrice),
      formatMoney(p.sellingPrice),
      formatMoney(p.stock * p.purchasePrice)
    ];
  });

  autoTable(doc, {
    startY: 63,
    head: [['#', 'Tovar Nomi & Modeli', 'Toifasi', 'Qoldiq', 'Tan Narxi', 'Sotish', 'Jami Tan Qiy.']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 70, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14, bottom: 25 }
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sahifa ${i} / ${totalPages}  |  Paxtaobod Beeline POS Ombor Hisoboti`,
      14,
      pageHeight - 8
    );
  }

  return doc;
}

// ============================================================================
// 4. QARZDORLIKLAR (DEBTS PDF)
// ============================================================================
export interface GenerateDebtsPdfParams {
  storeInfo: StoreSettings;
  debts: DebtRecord[] | SupplierDebtRecord[];
  type: 'customer' | 'supplier';
  totalDebtSum: number;
  dateStr?: string;
}

export function createDebtsPdf(params: GenerateDebtsPdfParams): jsPDF {
  const { storeInfo, debts, type, totalDebtSum, dateStr } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const isSupplier = type === 'supplier';
  const title = isSupplier ? "TA'MINOTCHI QARZLARI" : "MIJOZLAR NASIYASI";
  const displayDate = dateStr || new Date().toLocaleDateString('uz-UZ');

  doc.setFillColor(24, 24, 27);
  doc.rect(14, 12, 182, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sanitizeText(storeInfo.name.toUpperCase()), 20, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Qarzlar kitobi | Sana: ${sanitizeText(displayDate)}`, 20, 28);

  doc.setFillColor(isSupplier ? 225 : 245, isSupplier ? 29 : 158, isSupplier ? 72 : 11);
  doc.roundedRect(138, 16, 52, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(title, 140, 22);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('NASIYA DAFTARI', 140, 27);

  // Summary box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 43, 182, 16, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(isSupplier ? "Bizning Ta'minotchilardan Jami Qarzimiz:" : "Mijozlarning Bizdan Jami Qarzi:", 20, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(isSupplier ? 190 : 180, isSupplier ? 18 : 83, isSupplier ? 60 : 9);
  doc.text(formatMoney(totalDebtSum), 20, 56);

  const tableRows = debts.map((d: any, idx) => {
    const name = isSupplier ? d.supplierName : d.customerName;
    const phone = d.phone || '—';
    const detail = isSupplier ? d.productSummary : d.itemsSummary || 'Aksessuarlar';
    const total = formatMoney(d.totalDebt || 0);
    const paid = formatMoney(d.paidAmount || 0);
    const remaining = formatMoney(d.remainingAmount || 0);
    const due = d.dueDate || 'Kelishilmoqda';

    return [
      String(idx + 1),
      sanitizeText(name),
      sanitizeText(phone),
      sanitizeText(detail.slice(0, 30)),
      total,
      paid,
      remaining,
      sanitizeText(due)
    ];
  });

  autoTable(doc, {
    startY: 63,
    head: [['#', isSupplier ? "Ta'minotchi" : 'Mijoz', 'Telefon', 'Izoh / Partiya', 'Jami Qarz', "To'langan", 'Qoldiq Qarz', 'Muddat']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [15, 23, 42]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 35 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 24, fontStyle: 'bold', textColor: [190, 18, 60] },
      7: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: 14, right: 14, bottom: 25 }
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sahifa ${i} / ${totalPages}  |  Paxtaobod Beeline POS Nasiya Daftari`,
      14,
      pageHeight - 8
    );
  }

  return doc;
}

// ============================================================================
// 4. SOTUV CHEKI VA TOVAR BUYURTMA RO'YXATI (RECEIPT & ORDER LIST PDF)
// ============================================================================
export interface GenerateReceiptPdfParams {
  receipt: SaleReceiptData;
  storeInfo: StoreSettings;
  showPrices: boolean; // When false: STRICTLY only product names, quantities, and categories
}

export function generateReceiptPdf(params: GenerateReceiptPdfParams): jsPDF {
  const { receipt, storeInfo, showPrices } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  // Accent Line
  doc.setFillColor(showPrices ? 245 : 16, showPrices ? 158 : 185, showPrices ? 11 : 129); // amber or emerald
  doc.rect(0, 36, 210, 2, 'F');

  // Store Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(sanitizeText(storeInfo.name), 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(sanitizeText(`${storeInfo.address}  |  Tel: ${storeInfo.phone}`), 14, 21);
  doc.text(`Kassir: ${sanitizeText(receipt.cashierName || storeInfo.accountantName)}`, 14, 27);

  // Right Title Box
  const isReturn = receipt.isReturn;
  let title = 'TOVAR NAKLADNOYI';
  let badgeSubtitle = "TO'LIQ HISOB-KITOB";
  if (!showPrices) {
    title = "BUYURTMA RO'YXATI";
    badgeSubtitle = "NARXLARSIZ REJIM (ORDER LIST)";
  } else if (isReturn) {
    title = 'VAZVRAT DALOLATNOMASI';
    badgeSubtitle = 'QAYTARILGAN TOVARLAR';
  }

  doc.setFillColor(showPrices ? 217 : 5, showPrices ? 119 : 150, showPrices ? 6 : 105);
  doc.roundedRect(125, 10, 71, 19, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, 128, 17);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`№ ${sanitizeText(receipt.receiptNumber)}  |  ${sanitizeText(receipt.date ? receipt.date.slice(0, 10) : '')}`, 128, 22);
  doc.text(badgeSubtitle, 128, 26);

  // Client Details Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 43, 182, 20, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Qabul Qiluvchi (Mijoz / Buyurtmachi):", 18, 49);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeText(receipt.customerName || "Do'kon mijozi"), 18, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const phoneText = receipt.customerPhone ? `Tel: ${receipt.customerPhone}` : '';
  const addrText = receipt.customerAddress ? `Manzil: ${receipt.customerAddress}` : '';
  doc.text(sanitizeText([phoneText, addrText].filter(Boolean).join('  |  ')), 18, 60);

  // Table Setup
  // If showPrices is true: columns = ['#', 'Tovar Nomi va Modeli', 'Toifasi', 'Miqdori', 'Narxi', 'Jami Summa']
  // If showPrices is false: columns = ['#', 'Tovar Nomi va Modeli', 'Toifasi', 'Miqdori (Dona)', 'Tekshiruv [ V ]']
  const totalQuantity = receipt.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalItemsCount = receipt.items.length;

  let tableHead: string[][];
  let tableRows: string[][];
  let columnStyles: Record<number, any>;

  if (showPrices) {
    tableHead = [['#', 'Tovar Nomi va Modeli', 'Toifasi', 'Miqdori', 'Narxi', 'Jami Summa']];
    tableRows = receipt.items.map((it, idx) => [
      String(idx + 1),
      sanitizeText(it.name),
      sanitizeText(it.category || 'Aksessuar'),
      `${it.quantity} dona`,
      formatMoney(it.unitPrice),
      formatMoney(it.total)
    ]);
    columnStyles = {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 70, fontStyle: 'bold' },
      2: { cellWidth: 35 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 25, fontStyle: 'bold' }
    };
  } else {
    // STRICTLY NO PRICES: only product names, quantities, and categories
    tableHead = [['#', 'Tovar Nomi va Modeli', 'Toifasi (Kategoriya)', 'Miqdori (Dona)', 'Tekshiruv [ V ]']];
    tableRows = receipt.items.map((it, idx) => [
      String(idx + 1),
      sanitizeText(it.name),
      sanitizeText(it.category || 'Aksessuar'),
      `${it.quantity} dona`,
      '[   ]'
    ]);
    columnStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 85, fontStyle: 'bold' },
      2: { cellWidth: 45 },
      3: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 18 }
    };
  }

  autoTable(doc, {
    startY: 68,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: showPrices ? [30, 41, 59] : [15, 118, 110], // slate-800 or teal-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [15, 23, 42]
    },
    columnStyles,
    margin: { left: 14, right: 14, bottom: 25 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Summary / Footer block
  if (showPrices) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(120, finalY, 76, 22, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Jami tovarlar: ${totalItemsCount} xil (${totalQuantity} dona)`, 124, finalY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Jami: ${formatMoney(receipt.total)}`, 124, finalY + 13);
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`To'lov turi: ${sanitizeText(receipt.paymentMethod).toUpperCase()}`, 124, finalY + 18);
  } else {
    // Price-free summary: ONLY product counts & quantities
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.roundedRect(14, finalY, 182, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.text(`Buyurtma Xulosasi: Jami ${totalItemsCount} xil tovar  |  Umumiy miqdor: ${totalQuantity} dona`, 18, finalY + 9);
  }

  // Signatures
  const signY = finalY + (showPrices ? 30 : 22);
  if (signY < 265) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("Topshirdi (Sotuvchi): _____________________ (imzo)", 18, signY);
    doc.text("Qabul qildi: _____________________ (imzo)", 120, signY);
  }

  // Page numbering
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sahifa ${i} / ${totalPages}  |  ${sanitizeText(storeInfo.name)} — ${showPrices ? 'Kassa Hujjati' : 'Buyurtma Ro\'yxati (Narxlarsiz)'}`,
      14,
      pageHeight - 8
    );
  }

  return doc;
}
