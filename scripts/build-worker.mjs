import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {existsSync} from 'node:fs';
import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
const require=createRequire(import.meta.url);
await build({entryPoints:[resolve('worker/index.ts')],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[{name:'node-resolver',setup(builder){
 builder.onResolve({filter:/.*/},args=>{let path=args.path;if(args.kind!=='entry-point'){if(path.startsWith('.')){path=resolve(dirname(args.importer),path);if(!extname(path)){path=['.ts','.js','.tsx'].map(ext=>path+ext).find(existsSync)||path;}}else path=require.resolve(path);}return {path,namespace:'local-source'}});
 builder.onLoad({filter:/.*/,namespace:'local-source'},async args=>({contents:await readFile(args.path,'utf8'),loader:args.path.endsWith('.ts')?'ts':'js'}));
}}]});
await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
const origin=process.env.PUBLIC_SITE_URL||JSON.parse(await readFile('site.config.json','utf8')).origin;
if(origin){const paths=['/','/tailor/','/templates/','/guides/','/countries/usa/','/countries/uk/','/countries/uae/','/countries/saudi-arabia/','/countries/pakistan/','/guides/ats-friendly-resume/','/guides/import-existing-cv/','/about/'];await writeFile('dist/client/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${new URL(p,origin).href}</loc></url>`).join('')}</urlset>`);await writeFile('dist/client/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /drafts/\nDisallow: /dashboard/\nDisallow: /login/\nDisallow: /signup/\nDisallow: /recover/\nSitemap: ${origin}/sitemap.xml\n`);}
console.log('Worker, static pages and database migrations are ready.');
