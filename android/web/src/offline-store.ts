/** Device-only storage. No network, remote database or hosted account is used. */
export const STORAGE_KEY = 'rotago-android:records:v1';
type Row = Record<string, any>;
export type LocalDatabase = {sessions:Row[];goals:Row[];settings:Row;plans:Row[];planItems:Row[];planDaysOff:Row[]};
export function emptyDatabase():LocalDatabase{return {sessions:[],goals:[],settings:{id:1,automatic_reserves:0,maintenance_percent:10,investment_percent:10},plans:[],planItems:[],planDaysOff:[]}};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message)};
const validDate=(s:unknown)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00'))&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
const validTime=(s:unknown)=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const number=(v:unknown)=>{const n=Number(v||0);check(Number.isFinite(n)&&n>=0,'Informe valores válidos e positivos.');return n};
const cents=(v:unknown)=>Math.round(number(v)*100);
const name=(s:unknown)=>{check(typeof s==='string'&&s.trim().length>0&&s.length<=120,'Informe uma descrição de até 120 caracteres.');return String(s).trim()};
const id=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=100?s:crypto.randomUUID();
export function readDatabase():LocalDatabase{const saved=localStorage.getItem(STORAGE_KEY);if(!saved)return emptyDatabase();return validateDatabase(JSON.parse(saved))}
function saveDatabase(db:LocalDatabase){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}catch{throw new Error('Não foi possível salvar no celular. Libere espaço e exporte um backup.')}}
export function validateDatabase(x:any):LocalDatabase{
 check(x&&typeof x==='object','Backup inválido.');const db=emptyDatabase();
 for(const k of ['sessions','goals','plans','planItems','planDaysOff'] as const){check(Array.isArray(x[k])&&x[k].length<=50000,'Formato de dados inválido.');db[k]=JSON.parse(JSON.stringify(x[k]))}
 check(x.settings&&typeof x.settings==='object','Preferências inválidas.');db.settings={id:1,automatic_reserves:x.settings.automatic_reserves?1:0,maintenance_percent:number(x.settings.maintenance_percent),investment_percent:number(x.settings.investment_percent)};
 for(const r of db.sessions){check(typeof r.id==='string'&&validDate(r.work_date)&&validTime(r.start_time)&&validTime(r.end_time)&&['99','shopee','uber'].includes(r.platform),'Rota inválida no backup.');for(const k of ['earnings_cents','fuel_cents','maintenance_cents','investment_cents','fuel_price_cents','km_start','km_end','km_driven','km_per_liter'])number(r[k]);check(r.km_driven>0&&r.km_per_liter>0,'Consumo ou distância inválidos.');const expenses=JSON.parse(r.expenses_json||'[]');check(Array.isArray(expenses)&&expenses.length<=100,'Gastos inválidos.');for(const e of expenses){name(e.description);number(e.amountCents)}}
 for(const r of db.goals){check(validDate(r.work_date),'Data da meta inválida.');number(r.shopee_cents);number(r.ride_99_cents)}
 for(const r of db.plans){check(typeof r.id==='string'&&/^\d{4}-\d{2}$/.test(r.month)&&validDate(r.start_date),'Planejamento inválido.');for(const k of ['available_cents','daily_reserve_cents','km_per_liter','fuel_price_cents','km_per_workday'])number(r[k])}
 const planIds=new Set(db.plans.map(r=>r.id));for(const r of db.planItems){check(planIds.has(r.plan_id)&&validDate(r.due_date),'Conta inválida.');name(r.description);number(r.amount_cents);number(r.reserved_cents);check(r.reserved_cents<=r.amount_cents,'Reserva maior que a conta.')}for(const r of db.planDaysOff)check(planIds.has(r.plan_id)&&validDate(r.off_date),'Folga inválida.');
 return db;
}
export function exportBackup(){return JSON.stringify({app:'RotaGo Android',schemaVersion:1,exportedAt:new Date().toISOString(),database:readDatabase(),theme:localStorage.getItem('rotago-theme')||'dark'},null,2)}
export function restoreBackup(text:string){check(text.length<20*1024*1024,'O backup é muito grande.');const payload=JSON.parse(text);check(payload.app==='RotaGo Android'&&payload.schemaVersion===1,'Escolha um backup do aplicativo RotaGo Android.');const db=validateDatabase(payload.database);saveDatabase(db);if(['light','dark'].includes(payload.theme))localStorage.setItem('rotago-theme',payload.theme)}
export async function offlineRequest(url:string,init:RequestInit={}):Promise<Response>{
 try{
  const parsed=new URL(url,'https://appassets.androidplatform.net');check(parsed.origin==='https://appassets.androidplatform.net'&&parsed.pathname==='/api/rotas','O aplicativo funciona somente com dados locais.');const db=readDatabase(),method=init.method||'GET',now=new Date().toISOString();
  if(method==='GET')return response(db);
  if(method==='DELETE'){const planId=parsed.searchParams.get('planId'),routeId=parsed.searchParams.get('id');check(planId||routeId,'Registro não informado.');if(planId){db.plans=db.plans.filter(r=>r.id!==planId);db.planItems=db.planItems.filter(r=>r.plan_id!==planId);db.planDaysOff=db.planDaysOff.filter(r=>r.plan_id!==planId)}else db.sessions=db.sessions.filter(r=>r.id!==routeId);saveDatabase(db);return response({ok:true})}
  check(method==='POST','Operação inválida.');const payload=JSON.parse(String(init.body||'{}'));
  if(payload.type==='session'){
   const s=payload.session||{};check(validDate(s.date)&&validTime(s.startTime)&&validTime(s.endTime)&&s.startTime!==s.endTime&&['shopee','99','uber'].includes(s.platform),'Preencha data, plataforma e horários corretamente.');const start=s.kmMode==='odometer'?number(s.kmStart):0,km=s.kmMode==='odometer'?number(s.kmEnd)-start:number(s.kmDriven),eff=number(s.kmPerLiter),price=number(s.fuelPrice);check(km>0&&eff>0&&price>0,'Confira KM rodados, consumo e combustível.');check(Array.isArray(s.expenses||[])&&(s.expenses||[]).length<=100,'Gastos inválidos.');const expenses=(s.expenses||[]).map((e:Row)=>({id:id(e.id),description:name(e.description),amountCents:cents(e.amount)}));const routeId=id(s.id),previous=db.sessions.find(r=>r.id===routeId),r={id:routeId,work_date:s.date,platform:s.platform,start_time:s.startTime,end_time:s.endTime,km_start:start,km_end:start+km,liters:km/eff,km_driven:km,km_per_liter:eff,fuel_price_cents:cents(price),earnings_cents:cents(s.earnings),fuel_cents:Math.ceil(km/eff*price)*100,maintenance_cents:cents(s.maintenance),investment_cents:cents(s.investment),expenses_json:JSON.stringify(expenses),created_at:previous?.created_at||now,updated_at:now};db.sessions=db.sessions.filter(x=>x.id!==routeId);db.sessions.push(r);saveDatabase(db);return response({ok:true,id:routeId});
  }
  if(payload.type==='goal'){check(validDate(payload.date),'Data inválida.');db.goals=db.goals.filter(r=>r.work_date!==payload.date);db.goals.push({work_date:payload.date,shopee_cents:cents(payload.shopee),ride_99_cents:cents(payload.ride99),updated_at:now})}
  else if(payload.type==='settings'){const m=number(payload.maintenancePercent),i=number(payload.investmentPercent);check(m<=100&&i<=100,'Use percentuais entre 0 e 100.');db.settings={id:1,automatic_reserves:payload.automaticReserves?1:0,maintenance_percent:m,investment_percent:i,updated_at:now}}
  else if(payload.type==='plan'){
   const p=payload.plan||{};check(typeof p.month==='string'&&/^\d{4}-\d{2}$/.test(p.month)&&validDate(p.startDate)&&Array.isArray(p.items)&&p.items.length>0,'Informe o mês, início e contas do plano.');const existing=db.plans.find(r=>r.month===p.month),planId=existing?.id||id(p.id);const items=p.items.map((e:Row)=>{check(validDate(e.dueDate)&&e.dueDate>=p.startDate&&cents(e.amount)>0&&cents(e.reserved)<=cents(e.amount),'Confira valores e vencimentos das contas.');return {id:id(e.id),plan_id:planId,description:name(e.description),amount_cents:cents(e.amount),reserved_cents:cents(e.reserved),due_date:e.dueDate,created_at:now}});const off=[...new Set(p.daysOff||[])];check(off.every(validDate),'Confira as datas das folgas.');db.plans=db.plans.filter(r=>r.id!==planId);db.plans.push({id:planId,month:p.month,start_date:p.startDate,available_cents:cents(p.available),daily_reserve_cents:cents(p.dailyReserve),km_per_liter:number(p.kmPerLiter),fuel_price_cents:cents(p.fuelPrice),km_per_workday:number(p.kmPerWorkday),enabled:p.enabled===false?0:1,created_at:existing?.created_at||now,updated_at:now});db.planItems=db.planItems.filter(r=>r.plan_id!==planId).concat(items);db.planDaysOff=db.planDaysOff.filter(r=>r.plan_id!==planId).concat(off.map(off_date=>({id:crypto.randomUUID(),plan_id:planId,off_date})));
  }else throw new Error('Operação inválida.');
  saveDatabase(db);return response({ok:true});
 }catch(error){return response({error:error instanceof Error?error.message:'Não foi possível salvar.'},400)}
}
