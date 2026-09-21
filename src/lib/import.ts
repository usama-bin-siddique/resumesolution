import {blank,type Resume,type Entry} from './resume';
export async function extractFile(file:File):Promise<string>{
 if(file.size>5*1024*1024)throw new Error('Please choose a file smaller than 5 MB.');
 const ext=file.name.split('.').pop()?.toLowerCase();let text='';
 if(ext==='txt')text=await file.text();
 else if(ext==='docx'){const mammoth=await import('mammoth');const data=new Uint8Array(await file.arrayBuffer());if(data[0]!==80||data[1]!==75)throw new Error('This is not a valid DOCX file. Please export it again from Word.');const result=await mammoth.extractRawText({arrayBuffer:data.buffer});text=result.value;}
 else if(ext==='pdf'){const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;const task=pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false});const doc=await task.promise;try{if(doc.numPages>15)throw new Error('Please choose a resume with 15 pages or fewer.');const pages=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const content=await page.getTextContent();let s='',lastY:number|null=null;for(const item of content.items){if(!('str'in item))continue;const y=item.transform[5];if(lastY!==null&&Math.abs(y-lastY)>3)s+='\n';s+=item.str+(item.hasEOL?'\n':' ');lastY=item.hasEOL?null:y;}pages.push(s);}text=pages.join('\n\n');}finally{await task.destroy();}}
 else throw new Error('Please upload a PDF, DOCX or TXT file. Older .doc files must be saved as .docx first.');
 if(text.trim().length<30)throw new Error('No readable text was found. Scanned CVs need OCR first. You can paste your information into the editor instead.');
 if(text.length>100000)throw new Error('This document contains too much text. Please upload a shorter CV.');return text.trim();
}
export function parseText(text:string,current?:Resume):Resume{
 const r={...blank(),country:current?.country||'US',profession:current?.profession||'General',template:current?.template||'classic',accent:current?.accent||'#18674d'};
 const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 r.email=text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]||'';
 r.phone=text.match(/(?:\+\d[\d ()-]{7,}\d|\(\d{3}\)\s*\d{3}[- ]\d{4})/)?.[0]||'';
 r.website=text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/|github\.com\/)[\w./-]+/)?.[0]||'';
 const first=lines.find(l=>l.length>2&&l.length<65&&!/[@\d]|curriculum vitae|^resume$|^cv$/i.test(l));r.name=first||'';
 const map:Record<string,string>={summary:'summary',profile:'summary','professional summary':'summary',objective:'summary','about me':'summary',experience:'experience','work experience':'experience','professional experience':'experience','employment history':'experience',education:'education','academic qualifications':'education',skills:'skills','technical skills':'skills','core skills':'skills',projects:'projects','selected projects':'projects',languages:'languages',certifications:'certifications','licenses and certifications':'certifications'};
 const buckets:Record<string,string[]>={};let active='';for(const line of lines){const heading=line.toLowerCase().replace(/[:\s]+$/,'');if(map[heading]){active=map[heading];buckets[active]??=[];}else if(active)buckets[active].push(line);}
 for(const key of ['summary','skills','languages','certifications']as const)r[key]=(buckets[key]||[]).join('\n');
 // Conservative mapping: retain every section line for review rather than inventing dates or employers.
 for(const key of ['experience','education','projects']as const){const ls=buckets[key]||[];if(ls.length)r[key]=[{id:crypto.randomUUID(),title:ls[0],organization:'',location:'',start:'',end:'',details:ls.slice(1).join('\n')}];}
 return r;
}
