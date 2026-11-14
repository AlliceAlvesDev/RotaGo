export type AccountName='bills'|'reserve'|'piggy';
export type AccountAdjustment={id:string;date:string;account:AccountName;amountCents:number;description:string;createdAt:string};
type Session={id:string;date:string;startTime:string;earningsCents:number;fuelCents:number;maintenanceCents:number;investmentCents:number;expenses?:{amountCents:number}[];allocationMode?:'all'|'target';billsTargetCents?:number;dailyReserveTargetCents?:number};
type Plan={id:string;month:string;startDate:string;availableCents:number;dailyReserveCents:number;enabled:boolean;items:{id:string;description:string;amountCents:number;reservedCents:number;dueDate:string}[]};
export type RouteAllocation={id:string;date:string;bills:number;reserve:number;piggy:number;dailyReserve:number};
/** Pure ledger. Recomputing it never adds deposits or debits twice. */
export function allocateRoutes(sessions:Session[],plans:Plan[],asOfDate:string):RouteAllocation[]{
 const days=new Map<string,{bills:number;reserve:number}>();const result:RouteAllocation[]=[];
 const ordered=sessions.filter(s=>s.date<=asOfDate).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)||a.id.localeCompare(b.id));
 for(const s of ordered){
  const day=days.get(s.date)||{bills:0,reserve:0};const plan=plans.find(p=>p.enabled&&p.month===s.date.slice(0,7)&&s.date>=p.startDate);
  const targetReserve=Math.max(0,s.dailyReserveTargetCents??plan?.dailyReserveCents??0);
  const explicitReserve=s.maintenanceCents+s.investmentCents;
  const net=s.earningsCents-s.fuelCents-explicitReserve-(s.expenses||[]).reduce((sum,e)=>sum+e.amountCents,0);
  const dailyReserve=Math.min(Math.max(0,net),Math.max(0,targetReserve-day.reserve));
  const available=net-dailyReserve;
  const bills=s.allocationMode==='target'&&available>0?Math.min(available,Math.max(0,(s.billsTargetCents??0)-day.bills)):available;
  const piggy=Math.max(0,available-bills);
  result.push({id:s.id,date:s.date,bills,reserve:explicitReserve+dailyReserve,piggy,dailyReserve});day.bills+=bills;day.reserve+=dailyReserve;days.set(s.date,day);
 }
 return result;
}
export function accountBalances(plans:Plan[],sessions:Session[],adjustments:AccountAdjustment[],asOfDate:string){
 const allocations=allocateRoutes(sessions,plans,asOfDate);
 const balances={bills:0,reserve:0,piggy:0};
 for(const p of plans.filter(p=>p.startDate<=asOfDate)){balances.bills+=p.availableCents+p.items.reduce((sum,i)=>sum+i.reservedCents,0)}
 for(const r of allocations){balances.bills+=r.bills;balances.reserve+=r.reserve;balances.piggy+=r.piggy}
 for(const a of adjustments.filter(a=>a.date<=asOfDate))balances[a.account]+=a.amountCents;
 const seen=new Set<string>();const due=plans.flatMap(p=>p.items).filter(i=>{if(i.dueDate>asOfDate||seen.has(i.id))return false;seen.add(i.id);return true});
 for(const i of due)balances.bills-=i.amountCents;
 return {balances,allocations,due,debits:due.reduce((sum,i)=>sum+i.amountCents,0)};
}
