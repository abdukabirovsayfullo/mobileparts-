import { createDebtStatementPdf, debtStatementFileName } from './debtStatementPdf';
import { DebtStatementParams, debtStatementReceiptHtml, printThermalHtml } from './debtStatementReceipt';
import { triggerPdfDownload } from './pdfGenerator';

export function downloadDebtStatementPdf(params: DebtStatementParams): void {
  const { customer, from, to } = params;
  if (!triggerPdfDownload(createDebtStatementPdf(params), debtStatementFileName(customer.name, from, to))) {
    alert('PDF saqlanmadi. Brauzerda yuklab olishga ruxsat berilganini tekshiring.');
  }
}

export async function printDebtStatement(params: DebtStatementParams): Promise<void> {
  try {
    await printThermalHtml(debtStatementReceiptHtml(params));
  } catch (error) {
    console.error('[Print] Nasiya hisobi:', error);
    alert("Printer oynasi ochilmadi. CRM-AvtoPrint yorlig'idan oching yoki PDF dan foydalaning.");
  }
}