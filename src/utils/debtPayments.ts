import type { DebtRecord, StockMovement } from '../types';
import { currencyOf, roundMoney } from './money';
import { tashkentDate } from '../../server/expenseLogic';

export function debtPaymentsForDay(debts: DebtRecord[], movements: StockMovement[], date: string) {
  const rows = debts.flatMap(debt => (debt.paymentHistory || []).flatMap((p,index) => {
    if (p.method === 'vazvrat' || tashkentDate(p.date) !== date) return [];
    const sale = movements.find(m => m.id === debt.movementId);
    return [{id:`${debt.id}:${index}`,debtId:debt.id,name:debt.customerName,phone:debt.customerPhone,date:p.date,amount:p.amount,method:p.method,currency:currencyOf(debt),employee:p.employeeName||'',advance:p.date===debt.createdAt,receipt:sale?.receiptNumber||'',remaining:debt.remainingAmount}];
  }));
  const groups = new Map<string,{key:string;name:string;phone:string;date:string;method:string;currency:ReturnType<typeof currencyOf>;advance:boolean;amount:number;employee:string;rows:typeof rows}>();
  for (const r of rows) {
    const key=JSON.stringify([r.name.trim().toLowerCase().replace(/\s+/g,' '),r.phone.replace(/\D/g,''),r.date,r.method,r.currency,r.advance]);
    const g=groups.get(key)||{key,name:r.name,phone:r.phone,date:r.date,method:r.method,currency:r.currency,advance:r.advance,amount:0,employee:r.employee,rows:[]};
    g.amount=roundMoney(g.amount+r.amount,g.currency);g.rows.push(r);groups.set(key,g);
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
