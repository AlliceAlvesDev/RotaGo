import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),sql=new DatabaseSync(':memory:');
for(const f of (await readdir(root+'/drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await readFile(root+'/drizzle/'+f,'utf8'));
function prepare(query){let args=[];return {bind(...a){args=a;return this},async run(){sql.prepare(query).run(...args);return {success:true}},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)}}}
globalThis.__rotagoTestDb={prepare,async batch(statements){let results=[];for(const s of statements){try{results.push(await s.all())}catch{results.push(await s.run())}}return results}};
const vite=await createServer({appType:'custom',configFile:false,root,resolve:{alias:{'@':root}},plugins:[{name:'test-db',enforce:'pre',load(id){if(id.endsWith('/lib/rotas-db.ts'))return 'export function getRotasDb(){return globalThis.__rotagoTestDb}';}}],server:{middlewareMode:true}});
after(async()=>{await vite.close();sql.close();delete globalThis.__rotagoTestDb});
const api=await vite.ssrLoadModule('/app/api/rotas/route.ts');
const send=body=>api.POST(new Request('https://rotago.test/api/rotas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
test('saves, reads, edits and deletes route costs in the new database',async()=>{let session={id:'test',date:'2026-11-09',platform:'uber',startTime:'08:00',endTime:'12:00',kmMode:'odometer',kmStart:'1000',kmEnd:'1100',kmPerLiter:'10',fuelPrice:'6',earnings:'300',maintenance:20,investment:10,expenses:[{id:'food',description:'Alimentação',amount:25}]};let response=await send({type:'session',session});assert.equal(response.status,200);let data=await (await api.GET()).json();assert.equal(data.sessions[0].km_driven,100);assert.equal(data.sessions[0].km_start,1000);assert.equal(data.sessions[0].fuel_cents,6000);assert.equal(JSON.parse(data.sessions[0].expenses_json)[0].amountCents,2500);session.expenses[0].amount=30;assert.equal((await send({type:'session',session})).status,200);data=await (await api.GET()).json();assert.equal(data.sessions.length,1);assert.equal(JSON.parse(data.sessions[0].expenses_json)[0].amountCents,3000);assert.equal((await api.DELETE(new Request('https://rotago.test/api/rotas?id=test'))).status,200);assert.equal((await (await api.GET()).json()).sessions.length,0)});
test('rejects negative extra costs and reversed odometer values',async()=>{const session={date:'2026-11-09',platform:'99',startTime:'08:00',endTime:'12:00',kmDriven:100,kmPerLiter:10,fuelPrice:6,expenses:[{description:'Gasto',amount:-5}]};assert.equal((await send({type:'session',session})).status,400);assert.equal((await send({type:'session',session:{...session,expenses:[],kmMode:'odometer',kmStart:100,kmEnd:90}})).status,400)});
