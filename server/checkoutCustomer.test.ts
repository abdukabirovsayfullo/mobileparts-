import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {debtCustomerError} from '../src/utils/checkoutCustomer';
test('generic and incomplete customer identities cannot receive debt',()=>{
 for(const name of ['','Do\'kon mijozi','Do‘kon mijozi','Chakana xaridor','Oddiy mijoz']) assert.ok(debtCustomerError(name,'901234567'));
 assert.ok(debtCustomerError('ALI','+998'));
 assert.equal(debtCustomerError('ALI','+998 90 123 45 67'),'');
});
test('anonymous credit and partial cash are rejected before stock or history changes',async ctx=>{
 const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'checkout-guard-'));process.chdir(temp);
 ctx.after(async()=>{await new Promise(r=>setTimeout(r,400));process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 const {dataStore}=await import('./dataStore.ts?checkout='+Date.now());
 const receipt=dataStore.recordKirim({items:[{name:'KABEL',quantity:5,unitCost:2500,sellingPrice:10000}]});const id=receipt.movements[0].productId;
 const before=JSON.stringify(dataStore.getState());
 assert.throws(()=>dataStore.recordSale({items:[{productId:id,quantity:1}],paymentMethod:'nasiya',customerName:"Do'kon mijozi",customerPhone:'+998'}),/mijoz/);
 assert.equal(JSON.stringify(dataStore.getState()),before);
 assert.throws(()=>dataStore.recordSale({items:[{productId:id,quantity:1}],paymentMethod:'naqd',paidNow:3200}),/mijoz/);
 assert.equal(JSON.stringify(dataStore.getState()),before);
 const result=dataStore.recordSale({items:[{productId:id,quantity:1}],paymentMethod:'nasiya',customerName:'ALI',customerPhone:'901234567',paidNow:3500});
 assert.equal(result.debtRecord?.remainingAmount,6500);assert.equal(dataStore.getProductById(id)?.stock,4);
});

