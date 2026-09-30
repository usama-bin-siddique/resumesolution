import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {readFileSync} from 'node:fs';
import {adaptDatabase,migrateDatabase} from '../server/turso.ts';
import {migrations} from '../server/migrations.ts';
import {createHandler,platformRequest} from '../server/vercel.ts';
import {example} from '../src/lib/resume.ts';

function req(path:string,method='GET',body?:unknown,cookie=''){
 return new Request('https://globalcv.test'+path,{method,headers:{origin:'https://globalcv.test','content-type':'application/json','x-real-ip':'192.0.2.30',cookie},...(body?{body:JSON.stringify(body)}:{})});
}
test('Turso migrations match the immutable SQL files',()=>{
 const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
 assert.deepEqual(migrations.map(m=>m.name),journal.entries.map((e:any)=>e.tag));
 for(const migration of migrations)assert.equal(migration.sql,readFileSync(`drizzle/${migration.name}.sql`,'utf8'));
});
test('migrations repeat safely; batches roll back; RETURNING works',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
 await migrateDatabase(client);await migrateDatabase(client);
 assert.equal((await client.execute('SELECT * FROM _globalcv_migrations')).rows.length,3);
 const db=adaptDatabase(client);
 await assert.rejects(db.batch([db.prepare('INSERT INTO tailor_usage(subject,day,used) VALUES (?,?,?)').bind('rollback','today',1),db.prepare('INSERT INTO absent_table VALUES (1)')]));
 assert.equal(await db.prepare('SELECT * FROM tailor_usage WHERE subject=?').bind('rollback').first(),null);
 const insert=db.prepare('INSERT INTO tailor_usage(subject,day,used) VALUES (?,?,1) ON CONFLICT(subject,day) DO UPDATE SET used=used+1 WHERE used<5 RETURNING used');
 const results=[];
 for(let i=0;i<7;i++)results.push(await insert.bind('quota','today').first());
 assert.equal(results.filter(Boolean).length,5);
 assert.equal((await db.prepare('SELECT used FROM tailor_usage WHERE subject=?').bind('quota').first()).used,5);
 }finally{client.close()}
});
test('Vercel uses platform IP and discards spoofed Cloudflare IP',()=>{
 const request=new Request('https://globalcv.test/api/me',{headers:{'cf-connecting-ip':'1.1.1.1','x-real-ip':'192.0.2.4','oai-user-id':'spoof'}});
 const mapped=platformRequest(request);
 assert.equal(mapped.headers.get('cf-connecting-ip'),'192.0.2.4');assert.equal(mapped.headers.get('oai-user-id'),null);
 assert.equal(platformRequest(new Request('https://globalcv.test/api/me',{headers:{'cf-connecting-ip':'1.1.1.1'}})).headers.get('cf-connecting-ip'),null);
});
test('Vercel handler registers, saves and reads private drafts through Turso',async()=>{
 const client=createClient({url:'file::memory:'});
 try{
 await migrateDatabase(client);const db=adaptDatabase(client);const handler=createHandler(async()=>db);
 assert.deepEqual(await (await handler(req('/api/me'))).json(),{user:null});
 const reg=await handler(req('/api/auth/register','POST',{name:'Test User',email:'test@example.com',password:'a-long-private-passphrase'}));
 assert.equal(reg.status,201);const cookie=reg.headers.get('set-cookie')!.split(';')[0];assert.match(cookie,/^__Host-globalcv_session=/);
 const saved=await handler(req('/api/drafts','POST',{data:example},cookie));assert.equal(saved.status,201);const {id}=await saved.json();
 const draft=await handler(req('/api/drafts/'+id,'GET',undefined,cookie));assert.deepEqual((await draft.json()).data,example);
 assert.equal((await handler(req('/api/drafts/'+id))).status,401);
 const login=await handler(req('/api/auth/login','POST',{email:'test@example.com',password:'a-long-private-passphrase'}));assert.equal(login.status,200);
 const usage=await handler(req('/api/tailor/usage','GET',undefined,cookie));assert.equal(usage.status,200);assert.equal((await usage.json()).scope,'account');
 const cross=new Request('https://globalcv.test/api/drafts',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'});assert.equal((await handler(cross)).status,403);
 }finally{client.close()}
});
test('missing database returns JSON without leaking secrets',async()=>{
 const handler=createHandler(async()=>{throw new Error('secret-connection-string')});
 const response=await handler(req('/api/me'));assert.equal(response.status,503);assert.match(response.headers.get('content-type')!,/json/);assert.doesNotMatch(await response.text(),/secret-connection-string/);
});
