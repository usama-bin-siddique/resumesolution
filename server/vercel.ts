import {ipAddress} from '@vercel/functions';
import {isIP} from 'node:net';
import worker from '../worker/index.ts';
import {json,type Database} from '../worker/shared.ts';
import {getDatabase} from './turso.ts';

// Incoming Cloudflare headers are user-controlled on Vercel. Replace them with
// Vercel's platform-provided client IP before applying authentication/AI limits.
export function platformRequest(request:Request){
 const headers=new Headers(request.headers);
 for(const key of [...headers.keys()])if(key.startsWith('cf-')||key.startsWith('oai-'))headers.delete(key);
 const ip=ipAddress(request);
 if(ip&&isIP(ip))headers.set('cf-connecting-ip',ip);
 return new Request(request,{headers});
}
export function createHandler(database:()=>Promise<Database> = getDatabase){
 return async function fetch(request:Request){
  try{
   const path=new URL(request.url).pathname;
   if(!path.startsWith('/api/'))return json({error:'Route not found.'},404);
   if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'This request could not be verified.'},403);
   const DB=await database();
   return await worker.fetch(platformRequest(request),{DB,GROQ_API_KEY:process.env.GROQ_API_KEY});
  }catch(error){
   // Never log database URLs, tokens, passwords or CV content.
   console.error('GlobalCV API initialization failed',error instanceof Error&&error.message==='DATABASE_NOT_CONFIGURED'?'DATABASE_NOT_CONFIGURED':'DATABASE_UNAVAILABLE');
   return json({error:'The service is temporarily unavailable. Your current CV is unchanged. Please try again later.'},503);
  }
 };
}
export default {fetch:createHandler()};
