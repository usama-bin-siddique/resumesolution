import {openDatabase} from './local-db.mjs';
import {loadEnv} from 'vite';
export function localAPI(){return {name:'globalcv-local-api',configureServer(server){
 const {DB,sql}=openDatabase();server.httpServer?.once('close',()=>sql.close());
 server.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/api/'))return next();try{
 const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(key.startsWith('oai-')||key.startsWith('cf-')||key==='host'||value===undefined)continue;headers.set(key,Array.isArray(value)?value.join(','):value)}headers.set('cf-connecting-ip','127.0.0.1');
 const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>250000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request is too large.'}));return}chunks.push(chunk)}
 const host=req.headers.host;if(!/^127\.0\.0\.1:\d+$/.test(host||'')){res.writeHead(403);res.end();return}
 const request=new Request(`http://${host}${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 const {default:worker}=await server.ssrLoadModule('/worker/index.ts');const response=await worker.fetch(request,{DB,GROQ_API_KEY:loadEnv('development',process.cwd(),'').GROQ_API_KEY||process.env.GROQ_API_KEY});res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error('Local API error:',e);res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Local account service unavailable.'}))}});
 }};}
