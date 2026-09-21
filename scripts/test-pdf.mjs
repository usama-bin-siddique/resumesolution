import {transform} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToBuffer} from '@react-pdf/renderer';
await mkdir('.sites-runtime/pdf-test',{recursive:true});
await mkdir('../../work/pdf-test',{recursive:true});
const dir=resolve('.sites-runtime/pdf-test');
const resume=(await transform(await readFile('src/lib/resume.ts','utf8'),{loader:'ts',format:'esm'})).code;
await writeFile(resolve(dir,'resume.mjs'),resume);
let source=(await readFile('src/lib/pdf.tsx','utf8')).replace("from './resume'","from './resume.mjs'").replace("'/fonts/NotoSans-Regular.ttf'",JSON.stringify(resolve('public/fonts/NotoSans-Regular.ttf'))).replace("'/fonts/NotoSans-Bold.ttf'",JSON.stringify(resolve('public/fonts/NotoSans-Bold.ttf')));
await writeFile(resolve(dir,'pdf.mjs'),(await transform(source,{loader:'tsx',format:'esm',jsx:'automatic'})).code);
const {ResumePDF}=await import(pathToFileURL(resolve(dir,'pdf.mjs')).href);
const {example,templates}=await import(pathToFileURL(resolve(dir,'resume.mjs')).href);
for(const template of templates){const b=await renderToBuffer(React.createElement(ResumePDF,{r:{...example,template:template.id}}));await writeFile(resolve('../../work/pdf-test',`${template.id}.pdf`),b)}
const long={...example,experience:Array.from({length:18},(_,i)=>({...example.experience[0],id:`long-${i}`,title:`Position ${i+1}`}))};
await writeFile(resolve('../../work/pdf-test/long.pdf'),await renderToBuffer(React.createElement(ResumePDF,{r:long})));
console.log('Rendered six templates and a long multi-page resume.');
