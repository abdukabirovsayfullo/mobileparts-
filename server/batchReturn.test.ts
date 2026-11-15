import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
test('full receipt search, multiple return lines/quantities, atomic limits, exact debt and retry protection',async ctx=>{
 const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'batch-return-'));process.chdir(temp);ctx.after(async()=>{await new Promise(r=>setTimeout(r,500));process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 const {dataStore}=await import('./dataStore.ts?batch='+Date.now());const user:any={id:'owner',name:'Rahbar',role:'owner'};
 const k=dataStore.recordKirim({items:[{name:'ALPHA',quantity:100,unitCost:1000,sellingPrice:3200},{name:'BETA',quantity:100,unitCost:2000,sellingPrice:6500}]});const [a,b]=k.movements.map(m=>m.productId);
 const sale=dataStore.recordSale({items:[{productId:a,quantity:3},{productId:b,quantity:2}],customerName:'ALI',customerPhone:'901234567'});
 const found=dataStore.searchReturnableSales('ALPHA',user).find(s=>s.receiptNumber===sale.receiptNumber)!;assert.equal(found.lines.length,2);
 const input:any={requestId:'test-request',lines:[{movementId:sale.movements[0].id,quantity:2},{movementId:sale.movements[1].id,quantity:2}],reason:'Mos kelmadi',refundMethod:'naqd',user};
 const returned=dataStore.recordReturn(input);assert.equal(returned.movements.length,2);assert.equal(returned.totalRefund,19400);
 const stock=dataStore.getProductById(a)!.stock;assert.equal(dataStore.recordReturn(input).receiptNumber,returned.receiptNumber);assert.equal(dataStore.getProductById(a)!.stock,stock);
 const before=JSON.stringify(dataStore.getState());assert.throws(()=>dataStore.recordReturn({...input,requestId:'too-many',lines:[{movementId:sale.movements[0].id,quantity:2}]}),/miqdor/);assert.equal(JSON.stringify(dataStore.getState()),before);
 const older=dataStore.recordSale({items:[{productId:a,quantity:1}],paymentMethod:'nasiya',customerName:'ALI',customerPhone:'901234567'});
 const newer=dataStore.recordSale({items:[{productId:a,quantity:2}],paymentMethod:'nasiya',customerName:'ALI',customerPhone:'901234567'});
 dataStore.recordReturn({lines:[{movementId:newer.movements[0].id,quantity:1}],reason:'Mos kelmadi',refundMethod:'nasiya',user});
 assert.equal(dataStore.getState().debts.find(d=>d.id===older.debtRecord!.id)!.remainingAmount,3200);assert.equal(dataStore.getState().debts.find(d=>d.id===newer.debtRecord!.id)!.remainingAmount,3200);
 const old2=dataStore.recordSale({items:[{productId:a,quantity:2}],paymentMethod:'nasiya',customerName:'ALI',customerPhone:'901234567'});
 const new2=dataStore.recordSale({items:[{productId:b,quantity:1}],paymentMethod:'nasiya',customerName:'ALI',customerPhone:'901234567'});
 dataStore.recordReturn({lines:[{movementId:old2.movements[0].id,quantity:1},{movementId:new2.movements[0].id,quantity:1}],reason:'Mos kelmadi',refundMethod:'nasiya',user});
 assert.equal(dataStore.getState().debts.find(d=>d.id===old2.debtRecord!.id)!.remainingAmount,3200);assert.equal(dataStore.getState().debts.find(d=>d.id===new2.debtRecord!.id)!.remainingAmount,0);
 const other=dataStore.recordSale({items:[{productId:b,quantity:1}],customerName:'VALI',customerPhone:'901234567'});
 const safe=JSON.stringify(dataStore.getState());assert.throws(()=>dataStore.recordReturn({lines:[{movementId:older.movements[0].id,quantity:1},{movementId:other.movements[0].id,quantity:1}],reason:'Mos kelmadi',refundMethod:'naqd',user}),/bitta mijoz/);assert.equal(JSON.stringify(dataStore.getState()),safe);

});
