import {validateResume} from '../src/lib/resume.ts';
type Statement={bind:(...args:unknown[])=>Statement,first:()=>Promise<any>,all:()=>Promise<any>,run:()=>Promise<any>};
type Env={DB?:{prepare:(sql:string)=>Statement},ASSETS?:{fetch:(request:Request)=>Promise<Response>}};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
function user(request:Request){const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');return id&&email?{id,email}:null;}
function db(env:Env){if(!env.DB)throw new Error('DB_UNAVAILABLE');return env.DB;}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/')){if(env.ASSETS)return env.ASSETS.fetch(request);return new Response('Not found',{status:404});}
 if(request.method==='OPTIONS')return new Response(null,{status:405});
 const identity=user(request);
 if(path==='/api/me'&&request.method==='GET')return json({user:identity});
 if(!identity)return json({error:'Sign in to save or open private drafts.'},401);
 if(!['GET','HEAD'].includes(request.method)){if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'This request could not be verified.'},403);}
 try{
  const database=db(env);
  if(path==='/api/drafts'&&request.method==='GET'){const result=await database.prepare('SELECT id,title,updated_at,revision FROM drafts WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100').bind(identity.id).all();return json({drafts:result.results});}
  const match=path.match(/^\/api\/drafts\/([a-zA-Z0-9-]{1,80})$/);
  if(match&&request.method==='GET'){const result=await database.prepare('SELECT id,data,revision FROM drafts WHERE id = ? AND owner_id = ?').bind(match[1],identity.id).first();return result?json({...result,data:JSON.parse(result.data)}):json({error:'Draft not found or not available to this account.'},404);}
  if(match&&request.method==='DELETE'){await database.prepare('DELETE FROM drafts WHERE id = ? AND owner_id = ?').bind(match[1],identity.id).run();return json({success:true});}
  if((path==='/api/drafts'&&request.method==='POST')||(match&&request.method==='PUT')){
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
   if(Number(request.headers.get('content-length')||0)>250000)return json({error:'Resume is too large.'},413);
   const reader=request.body?.getReader();if(!reader)return json({error:'Resume data is missing.'},400);let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>250000){await reader.cancel();return json({error:'Resume is too large.'},413)}chunks.push(value);}const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}let payload;try{payload=JSON.parse(new TextDecoder().decode(buffer))}catch{return json({error:'Invalid JSON.'},400)}
   if(!validateResume(payload.data))return json({error:'Resume data is incomplete or invalid.'},400);
   const data=JSON.stringify(payload.data),title=(payload.data.name.trim()||'Untitled resume').slice(0,120),now=new Date().toISOString();
   if(match){if(!Number.isInteger(payload.revision)||payload.revision<1)return json({error:'A valid draft revision is required.'},400);const result=await database.prepare('UPDATE drafts SET title = ?, data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?').bind(title,data,now,match[1],identity.id,payload.revision).run();if(!result.meta?.changes)return json({error:'This draft changed in another tab or was deleted. Copy your changes before reopening it from My drafts.'},409);return json({id:match[1],revision:payload.revision+1});}
   const count=await database.prepare('SELECT COUNT(*) AS total FROM drafts WHERE owner_id = ?').bind(identity.id).first();if(count.total>=100)return json({error:'You have reached 100 saved drafts. Delete an older draft to save another.'},429);
   const id=crypto.randomUUID();await database.prepare('INSERT INTO drafts (id,owner_id,title,data,revision,updated_at,created_at) VALUES (?,?,?,?,1,?,?)').bind(id,identity.id,title,data,now,now).run();return json({id,revision:1},201);
  }
  return json({error:'Route not found.'},404);
 }catch(error){console.error('Draft service failure',error instanceof Error?error.message:'Unknown');return json({error:'Draft storage is temporarily unavailable. Your work remains in this tab. Please retry.'},503);}
}};
