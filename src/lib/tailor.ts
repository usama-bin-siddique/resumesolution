import {type Resume} from './resume.ts';

export const DAILY_LIMIT=5;
export const MAX_JOB_LENGTH=10000;
export type Suggestion={id:string;field:'headline'|'summary'|'skills'|'experience'|'projects';entryIndex:number;label:string;before:string;after:string;reason:string;evidence:string[]};
export type TailorResult={suggestions:Suggestion[];gaps:string[];warnings:string[]};
export type Usage={configured:boolean;remaining:number;limit:number;resetsAt:string;scope:'account'|'network'};

// Explicit allowlist: contact information, employment metadata, qualifications,
// dates, design choices and the original document never become model-editable.
export function applySuggestions(original:Resume,suggestions:Suggestion[],selected:Set<string>):Resume{
 const next=structuredClone(original);
 for(const s of suggestions){if(!selected.has(s.id))continue;
  if(s.field==='experience'||s.field==='projects'){
   if(next[s.field][s.entryIndex]?.details!==s.before)throw new Error('The source changed. Generate fresh suggestions.');
   next[s.field][s.entryIndex].details=s.after;
  }else{if(next[s.field]!==s.before)throw new Error('The source changed. Generate fresh suggestions.');next[s.field]=s.after;}
 }
 return next;
}

export function professionalContent(r:Resume){
 return {headline:r.headline,summary:r.summary,skills:r.skills,languages:r.languages,certifications:r.certifications,
  experience:r.experience.map(({title,organization,start,end,details},entryIndex)=>({entryIndex,title,organization,start,end,details})),
  education:r.education.map(({title,organization,start,end,details})=>({title,organization,start,end,details})),
  projects:r.projects.map(({title,organization,details},entryIndex)=>({entryIndex,title,organization,details}))};
}
export function sourceText(r:Resume){const c=professionalContent(r);return [c.headline,c.summary,c.skills,c.languages,c.certifications,...c.experience.flatMap(e=>[e.title,e.organization,e.start,e.end,e.details]),...c.education.flatMap(e=>[e.title,e.organization,e.start,e.end,e.details]),...c.projects.flatMap(e=>[e.title,e.organization,e.details])].join('\n');}
const numbers=(s:string):string[]=>s.match(/\d+(?:[.,]\d+)*(?:%|\+)?/g)||[];
const skillList=(s:string)=>s.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean).sort();
export function validateSuggestions(value:unknown,r:Resume):TailorResult{
 if(!value||typeof value!=='object')throw new Error('Invalid AI response.');
 const result=value as any;
 if(!Array.isArray(result.changes)||result.changes.length>128||!Array.isArray(result.gaps)||result.gaps.length>128||result.gaps.some((x:unknown)=>typeof x!=='string'||x.length>500))throw new Error('Invalid AI response.');
 const suggestions:Suggestion[]=[],warnings:string[]=[],seen=new Set<string>(),source=sourceText(r);
 const withheld='A suggestion was withheld because its format, supporting evidence or facts could not be verified.';
 if(result.changes.length>12)warnings.push('Only the first 12 proposed changes are shown.');
 for(const change of result.changes.slice(0,12)){
  const {field,entryIndex,after,reason,evidence}=change||{};
  if(!['headline','summary','skills','experience','projects'].includes(field)||!Number.isInteger(entryIndex)||typeof after!=='string'||!after.trim()||after.length>5000||typeof reason!=='string'||reason.length>700||!Array.isArray(evidence)||!evidence.length||evidence.length>32||evidence.some((x:unknown)=>typeof x!=='string'||!x.trim()||x.length>2000)){warnings.push(withheld);continue;}
  const isEntry=field==='experience'||field==='projects';
  if(isEntry?entryIndex<0||entryIndex>=r[field].length:entryIndex!==-1){warnings.push(withheld);continue;}
  const before=isEntry?r[field][entryIndex].details:r[field as 'headline'|'summary'|'skills'];
  const key=`${field}:${entryIndex}`;
  if(seen.has(key)){warnings.push(withheld);continue;}
  if(before===after)continue;
  // Reject ungrounded evidence and new numerical claims. Human review is still
  // essential: these guards cannot prove the semantic truth of every sentence.
  const evidenceSource=isEntry?before:source;
  const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
  if(evidence.some((x:string)=>!normalize(evidenceSource).includes(normalize(x)))||numbers(after).some(n=>!numbers(isEntry?before:source).includes(n))||field==='skills'&&JSON.stringify(skillList(before))!==JSON.stringify(skillList(after))){warnings.push(withheld);continue;}
  seen.add(key);
  suggestions.push({id:key,field,entryIndex,before,after,reason,evidence:evidence.slice(0,5),label:isEntry?`${field==='experience'?'Experience':'Project'}: ${r[field][entryIndex].title||entryIndex+1}`:field[0].toUpperCase()+field.slice(1)});
 }
 return {suggestions,gaps:result.gaps.slice(0,8),warnings:[...new Set(warnings)]};
}
