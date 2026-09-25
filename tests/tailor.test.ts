import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../scripts/local-db.mjs';
import worker from '../worker/index.ts';
import {example} from '../src/lib/resume.ts';
import {digest} from '../worker/auth.ts';
import {applySuggestions,validateSuggestions} from '../src/lib/tailor.ts';

const job='We need a product designer with experience in user research, prototyping, accessibility and collaboration with engineering teams. Please describe your relevant work and design systems experience.';
const fixture={changes:[{field:'summary',entryIndex:-1,after:'Product designer focused on accessible digital experiences, user research and clear visual design.',reason:'Highlights relevant strengths for the advertised role.',evidence:['Product designer creating thoughtful, accessible digital experiences.']}],gaps:['The CV does not state a management qualification.']};
function request(path:string,method='GET',body?:unknown,headers={}){return new Request(`https://globalcv.test${path}`,{method,headers:{Origin:'https://globalcv.test','Content-Type':'application/json','cf-connecting-ip':'192.0.2.1',...headers},...(body?{body:JSON.stringify(body)}:{})})}
const payload={resume:example,jobDescription:job,consent:true,reviewedSource:true};
test('suggestions require evidence and cannot change locked facts',()=>{
 const original=structuredClone(example),result=validateSuggestions(fixture,original);
 const edited=applySuggestions(original,result.suggestions,new Set(['summary:-1']));
 assert.equal(edited.summary,fixture.changes[0].after);assert.deepEqual(original,example);
 const {summary,...rest}=edited;const {summary:old,...expected}=original;assert.deepEqual(rest,expected);
 assert.deepEqual(applySuggestions(original,result.suggestions,new Set()),original);
 assert.equal(validateSuggestions({changes:[{...fixture.changes[0],field:'email'}],gaps:[]},original).suggestions.length,0);
 assert.equal(validateSuggestions({changes:[{...fixture.changes[0],field:'experience',entryIndex:99}],gaps:[]},original).suggestions.length,0);
 assert.equal(validateSuggestions({changes:[{...fixture.changes[0],after:'Managed 500 employees'}],gaps:[]},original).suggestions.length,0);
 assert.equal(validateSuggestions({changes:[{...fixture.changes[0],evidence:['invented evidence']}],gaps:[]},original).suggestions.length,0);
 assert.equal(validateSuggestions({changes:[{...fixture.changes[0],field:'skills',after:example.skills+', Kubernetes'}],gaps:[]},original).suggestions.length,0);
 assert.throws(()=>applySuggestions({...original,summary:'Changed source'},result.suggestions,new Set(['summary:-1'])));
});
test('tailoring API enforces consent, guest quota, privacy and provider failures',async t=>{
 const {DB,sql}=openDatabase(':memory:');const env={DB,GROQ_API_KEY:'test-only-key'};
 let calls=0;
 const mock=t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');const body=JSON.parse(options.body);assert.equal(body.model,'openai/gpt-oss-20b');const sent=JSON.parse(body.messages[1].content);assert.equal(sent.cv.name,undefined);assert.equal(sent.cv.email,undefined);assert.equal(sent.cv.phone,undefined);assert.equal(sent.cv.website,undefined);assert.equal(sent.jobDescription,job);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture)}}]})});
 await t.test('missing provider setup does not consume a request',async()=>{const res=await worker.fetch(request('/api/tailor','POST',payload),{DB});assert.equal(res.status,503);assert.equal((sql.prepare('SELECT COUNT(*) n FROM tailor_usage').get() as any).n,0);assert.equal(calls,0)});
 await t.test('invalid requests and cross-origin posts are rejected before AI',async()=>{assert.equal((await worker.fetch(request('/api/tailor','POST',{...payload,consent:false}),env)).status,400);assert.equal((await worker.fetch(request('/api/tailor','POST',{...payload,reviewedSource:false}),env)).status,400);assert.equal((await worker.fetch(request('/api/tailor','POST',{...payload,jobDescription:'short'}),env)).status,400);assert.equal((await worker.fetch(request('/api/tailor','POST',payload,{Origin:'https://other.test'}),env)).status,403);assert.equal(calls,0)});
 await t.test('only five concurrent requests reserve allowance',async()=>{const responses=await Promise.all(Array.from({length:7},()=>worker.fetch(request('/api/tailor','POST',payload),env)));assert.equal(responses.filter(r=>r.status===200).length,5);assert.equal(responses.filter(r=>r.status===429).length,2);assert.equal(calls,5);const usage=await (await worker.fetch(request('/api/tailor/usage'),env)).json() as any;assert.equal(usage.remaining,0);assert.equal(usage.scope,'network');assert.equal(new Date(usage.resetsAt).getUTCHours(),0);const row=sql.prepare('SELECT * FROM tailor_usage').get() as any;assert.equal(row.used,5);assert.ok(!JSON.stringify(row).includes('192.0.2.1'));assert.ok(!JSON.stringify(row).includes(example.name))});
 await t.test('authenticated allowance follows the account across networks',async()=>{const id='quota-user',token='a'.repeat(64);sql.prepare('INSERT INTO accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').run(id,'quota@example.test','Quota','unused','unused',new Date().toISOString());sql.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(await digest(token),id,Date.now()+60000,Date.now());const cookie=`__Host-globalcv_session=${token}`;for(let n=0;n<5;n++)assert.equal((await worker.fetch(request('/api/tailor','POST',payload,{cookie,'cf-connecting-ip':`192.0.2.${n+10}`}),env)).status,200);assert.equal((await worker.fetch(request('/api/tailor','POST',payload,{cookie,'cf-connecting-ip':'203.0.113.3'}),env)).status,429)});
 await t.test('capacity errors are explicit, counted and never silently retried',async()=>{const before=calls;mock.mock.mockImplementation(async()=>{calls++;return Response.json({error:'rate limit'},{status:429})});const res=await worker.fetch(request('/api/tailor','POST',payload,{'cf-connecting-ip':'203.0.113.4'}),env);assert.equal(res.status,503);assert.equal((await res.json() as any).usage.remaining,4);assert.equal(calls,before+1)});
 await t.test('truncated and malformed model responses never produce a tailored CV',async()=>{mock.mock.mockImplementation(async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}));assert.equal((await worker.fetch(request('/api/tailor','POST',payload,{'cf-connecting-ip':'203.0.113.5'}),env)).status,502);mock.mock.mockImplementation(async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'not json'}}]}));assert.equal((await worker.fetch(request('/api/tailor','POST',payload,{'cf-connecting-ip':'203.0.113.6'}),env)).status,502)});
 await t.test('original draft records are never changed by tailoring',async()=>{assert.equal((sql.prepare('SELECT COUNT(*) n FROM drafts').get() as any).n,0)});
 sql.close();
});

test('extra evidence and an invalid sibling do not discard valid suggestions',()=>{
 const skillEvidence=example.skills.split(', ').slice(0,7);
 const result=validateSuggestions({changes:[fixture.changes[0],{field:'skills',entryIndex:-1,after:skillEvidence.slice().reverse().join(', '),reason:'Prioritize relevant skills.',evidence:skillEvidence},{...fixture.changes[0],field:'email'}],gaps:[]},example);
 assert.equal(result.suggestions.length,2);
 assert.equal(result.suggestions[1].evidence.length,5);
 assert.equal(result.warnings.length,1);
 const unsupported=validateSuggestions({changes:[{...fixture.changes[0],evidence:[...skillEvidence,'not in the resume']}],gaps:[]},example);
 assert.equal(unsupported.suggestions.length,0);
});
