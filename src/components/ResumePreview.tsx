import {example,hasContent,type Resume} from '../lib/resume';
export default function ResumePreview({resume,mini=false}: {resume:Resume,mini?:boolean}){
 const r=hasContent(resume)?resume:{...example,template:resume.template,accent:resume.accent,country:resume.country};
 const titles:Record<string,string>={summary:'Profile',experience:'Experience',education:'Education',skills:'Skills',projects:'Projects',languages:'Languages',certifications:'Certifications'};
 return <article className={`resume-paper template-${r.template} ${mini?'mini-paper':''}`} style={{'--resume-accent':r.accent,'--resume-font':`${r.fontSize}px`} as React.CSSProperties} aria-label={mini?undefined:'Live resume preview'}>
  <header className="resume-heading"><h2>{r.name||'Your name'}</h2><p className="resume-role">{r.headline}</p><div className="resume-contact">{[r.email,r.phone,r.location,r.website].filter(Boolean).map((x,i)=><span key={i}>{x}</span>)}</div></header>
  {r.order.map(key=>{const val=(r as any)[key];if(!val||(Array.isArray(val)?!val.some(x=>x.title||x.organization||x.details):!val.trim()))return null;return <section className="resume-section" key={key}><h3>{titles[key]}</h3>{Array.isArray(val)?val.map((e:any)=><div className="resume-entry" key={e.id}><div className="resume-entry-title"><strong>{e.title}</strong><span>{[e.start,e.end].filter(Boolean).join(' – ')}</span></div><div className="resume-organization">{[e.organization,e.location].filter(Boolean).join(' · ')}</div>{e.details&&<ul>{e.details.split('\n').filter(Boolean).map((l:string,i:number)=><li key={i}>{l.replace(/^[•\-]\s*/, '')}</li>)}</ul>}</div>):<p className="preserve-lines">{val}</p>}</section>})}
 </article>
}
