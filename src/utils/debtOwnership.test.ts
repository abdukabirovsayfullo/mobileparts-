import test from 'node:test';
import assert from 'node:assert/strict';
import { protectDebtOwnership } from './debtOwnership';
import type { DebtRecord, StockMovement } from '../types';
const original = {id:'d',customerName:'ALI',customerPhone:'901234567',movementId:'sale',currency:'UZS',remainingAmount:1000,paidAmount:0} as DebtRecord;
test('sync keeps debt owner and source sale while accepting payment changes',()=>{
 const [result]=protectDebtOwnership([{...original,customerName:'VALI',customerPhone:'999999999',movementId:'other',currency:'USD',paidAmount:500,remainingAmount:500}],[original],[]);
 assert.equal(result.customerName,'ALI');assert.equal(result.customerPhone,original.customerPhone);assert.equal(result.movementId,'sale');assert.equal(result.currency,'UZS');assert.equal(result.paidAmount,500);
});
test('new sale-linked debt takes its owner from the original sale',()=>{
 const sale={id:'sale',type:'chiqim',counterparty:'ASL MIJOZ',customerPhone:'907777777'} as StockMovement;
 const [result]=protectDebtOwnership([original],[],[sale]);assert.equal(result.customerName,'ASL MIJOZ');assert.equal(result.customerPhone,'907777777');
});
