import {transform} from 'esbuild';
import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
const workerSource=(await readFile('worker/index.ts','utf8')).replace('../src/lib/resume.ts','./resume.js');
await writeFile('dist/server/index.js',(await transform(workerSource,{loader:'ts',format:'esm',target:'es2022',minify:true})).code);
await writeFile('dist/server/resume.js',(await transform(await readFile('src/lib/resume.ts','utf8'),{loader:'ts',format:'esm',target:'es2022',minify:true})).code);
await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
const origin=process.env.PUBLIC_SITE_URL||JSON.parse(await readFile('site.config.json','utf8')).origin;
if(origin){const paths=['/','/templates/','/guides/','/countries/usa/','/countries/uk/','/countries/uae/','/countries/saudi-arabia/','/countries/pakistan/','/guides/ats-friendly-resume/','/guides/import-existing-cv/','/about/'];await writeFile('dist/client/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${new URL(p,origin).href}</loc></url>`).join('')}</urlset>`);await writeFile('dist/client/robots.txt',`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /drafts/\nSitemap: ${origin}/sitemap.xml\n`);}
console.log('Worker, static pages and database migrations are ready.');
