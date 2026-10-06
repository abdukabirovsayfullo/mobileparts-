import assert from 'node:assert/strict'; import test from 'node:test';
import { buildReport, previousRange } from './reportLogic';
import type { StockMovement } from '../src/types';
const sale = (day: string, revenue: number, cost: number): StockMovement => ({ id: day, type:'chiqim', productId:'p', productName:'Tovar', category:'Test', quantity:1, unitCost:cost, unitPrice:revenue, totalCost:cost, totalRevenue:revenue, profit:revenue-cost, timestamp:`${day}T10:00:00Z`, paymentMethod:'naqd', counterparty:'Mijoz', employeeId:'w', employeeName:'Ishchi' });
test('oraliq chegaralari kiradi va sof foyda chiqimdan keyin hisoblanadi', () => { const report=buildReport({products:[],movements:[sale('2026-09-10',100,60),sale('2026-09-11',200,100)],debts:[],cashShifts:[],expenses:[{id:'e',occurredAt:'2026-09-10T12:00:00Z',recipient:'Usta',amount:10,reason:'Yo‘l',category:'transport',createdById:'w',createdByName:'Ishchi'}]},'2026-09-10','2026-09-10'); assert.equal(report.sales.revenue,100); assert.equal(report.sales.netProfit,30); });
test('oldingi teng davr to‘g‘ri topiladi',()=>assert.deepEqual(previousRange('2026-09-10','2026-09-12'),{from:'2026-09-07',to:'2026-09-09'}));

test('eski oylik aylanma savdo tushumiga qo‘shilmaydi, ombor chiqimida ko‘rinadi', () => {
  const oldTurnover: StockMovement = {
    ...sale('2026-09-30', 70000, 70000), id: 'old-turnover', quantity: 7,
    isHistoricalAggregate: true, turnoverImportId: 'turnover-2026-09'
  };
  const report = buildReport({ products: [], movements: [oldTurnover], debts: [], cashShifts: [], expenses: [] }, '2026-09-01', '2026-09-30');
  assert.equal(report.sales.revenue, 0);
  assert.equal(report.sales.count, 0);
  assert.equal(report.inventory.historicalOutgoingQuantity, 7);
  assert.equal(report.inventory.historicalOutgoingCost, 70000);
});
