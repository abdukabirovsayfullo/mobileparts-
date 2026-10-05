import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debtStatementReceiptHtml, formatSom, DebtStatementParams } from './debtStatementReceipt';
import { createDebtStatementPdf, debtStatementFileName } from './debtStatementPdf';
import type { DebtRecord } from '../types';

const debt = (id: string, createdAt: string, remaining: number): DebtRecord => ({
  id, customerName: 'Akmal <aka>', customerPhone: '+998 90 048 31 13', totalDebt: 100000, paidAmount: 100000 - remaining,
  remainingAmount: remaining, dueDate: '2026-10-12', createdAt, status: 'faol'
});

const params: DebtStatementParams = {
  customer: {
    key: 'akmal <aka>', name: 'Akmal <aka>', phone: '+998 90 048 31 13', saleTotal: 200000, paid: 60000, remaining: 140000,
    rows: [
      { debt: debt('d1', '2026-10-02T09:15:00', 90000), itemLines: ['Kabel × 2', "Himoya oynasi × 1"] },
      { debt: debt('d2', '2026-10-04T18:40:00', 50000), itemLines: [] }
    ]
  },
  store: { name: "Mobile Parts", tagline: '', address: 'Paxtaobod', phone: '+998 90 111 22 33', accountantName: '' },
  from: '2026-10-01',
  to: '2026-10-05',
  totalDebt: 185023
};

test('thermal debt statement lists every debt with date, items and totals, and escapes names', () => {
  const html = debtStatementReceiptHtml(params);
  assert.ok(html.includes('Akmal &lt;aka&gt;'));
  assert.ok(!html.includes('Akmal <aka>'));
  assert.ok(html.includes('02.10.2026 09:15') && html.includes('04.10.2026 18:40'));
  assert.ok(html.includes('Kabel × 2') && html.includes('Himoya oynasi × 1'));
  assert.ok(html.includes('01.10.2026 - 05.10.2026'));
  const inHtml = (n: number) => formatSom(n).replace("'", '&#39;');
  assert.ok(html.includes(inHtml(140000)) && html.includes(inHtml(185023)));
  assert.equal(formatSom(1234567), "1 234 567 so'm");
});

test('debt statement PDF is generated for one customer and file names are safe', () => {
  const doc = createDebtStatementPdf(params);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.output('arraybuffer').byteLength > 2000);
  assert.equal(debtStatementFileName('Akmal aka', '2026-10-01', '2026-10-05'), 'Nasiya_Akmal_aka_2026-10-01_2026-10-05.pdf');
  assert.equal(debtStatementFileName('Акмал', '2026-10-01', '2026-10-05'), 'Nasiya_mijoz_2026-10-01_2026-10-05.pdf');
});
