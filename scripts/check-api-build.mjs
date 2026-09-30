import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve('.sites-runtime/api-compiled');
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat()}
const files=await walk(root);
for(const file of files){if(!file.endsWith('.js'))continue;const code=await readFile(file,'utf8');assert.doesNotMatch(code,/(?:from\s*|import\s*\()(['"])\.{1,2}\/[^'"]+\.ts\1/,file+' retains a TypeScript runtime import');}
let count=0;
for(const file of await walk(resolve(root,'api'))){if(!file.endsWith('.js'))continue;const {default:handler}=await import(pathToFileURL(file).href);assert.equal(typeof handler.fetch,'function');count++;}
const {createHandler}=await import(pathToFileURL(resolve(root,'server/vercel.js')).href);
const {openDatabase}=await import('./local-db.mjs');const {DB,sql}=openDatabase(':memory:');
try{const handler=createHandler(async()=>DB);const response=await handler(new Request('https://globalcv.test/api/me'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{user:null});}finally{sql.close()}
console.log(`All ${count} compiled API entries load as JavaScript; compiled API request passed.`);
