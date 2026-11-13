import { DebtStatementParams, debtStatementReceiptHtml, printThermalHtml } from './debtStatementReceipt';

/** jsPDF faqat PDF tugmasi bosilganda yuklanadi (ilova tezroq ochilishi uchun). */
export async function downloadDebtStatementPdf(params: DebtStatementParams): Promise<void> {
  const { customer, from, to } = params;
  try {
    const [{ createDebtStatementPdf, debtStatementFileName }, { triggerPdfDownload }] = await Promise.all([
      import('./debtStatementPdf'),
      import('./pdfGenerator')
    ]);
    if (!triggerPdfDownload(createDebtStatementPdf(params), debtStatementFileName(customer.name, from, to))) {
      alert('PDF saqlanmadi. Brauzerda yuklab olishga ruxsat berilganini tekshiring.');
    }
  } catch (error) {
    console.error('[PDF] Nasiya hisobi:', error);
    alert('PDF tayyorlanmadi. Internet aloqasini tekshirib, qayta urinib ko\'ring.');
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