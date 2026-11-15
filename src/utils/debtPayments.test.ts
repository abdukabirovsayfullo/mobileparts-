import test from 'node:test';import assert from 'node:assert/strict';import {debtPaymentsForDay} from './debtPayments';
const d=(id:string,name:string,amount:number,date:string,method='naqd',currency='UZS')=>({id,customerName:name,customerPhone:'901234567',status:'yopildi',remainingAmount:0,createdAt:'2026-11-01T00:00:00Z',currency,paymentHistory:[{date,amount,method}]} as any);
test('payment date includes closed old debts, groups split payments and keeps other names/returns/currencies separate',()=>{
 const time='2026-11-14T20:00:00Z';
 const data=[d('1','ALI',3200,time),d('2','ALI',6500,time),d('3','VALI',9500,time),d('4','ALI',100,time,'vazvrat'),d('5','ALI',200,'2026-11-14T01:00:00Z'),d('6','ALI',10,time,'naqd','USD')];
 const result=debtPaymentsForDay(data,[],'2026-11-15');assert.equal(result.length,3);assert.equal(result.find(r=>r.name==='ALI'&&r.currency==='UZS')?.amount,9700);assert.equal(result.find(r=>r.name==='ALI'&&r.currency==='UZS')?.rows.length,2);assert.equal(result.find(r=>r.name==='VALI')?.amount,9500);
});
