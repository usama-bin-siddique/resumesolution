import {templateDesign} from '../lib/template-designs';
import {example,hasContent,type Resume} from '../lib/resume';
export default function ResumePreview({resume,mini=false}: {resume:Resume,mini?:boolean}){
 const r=hasContent(resume)?resume:{...example,template:resume.template,accent:resume.accent,country:resume.country};
 const design=templateDesign(r.template,r.accent);
 const css=(value:any={})=>Object.fromEntries(Object.entries(value).map(([key,v])=>[key,typeof v==='number'&&key!=='fontWeight'&&key!=='lineHeight'?`${v/10}em`:v]));
 const headerStyle=design.header?{borderWidth:0,borderStyle:'solid' as const,...css(design.header),...(design.header?.alignItems?{textAlign:'center' as const}:{})}:undefined;
 const titles:Record<string,string>={summary:'Profile',experience:'Experience',education:'Education',skills:'Skills',projects:'Projects',languages:'Languages',certifications:'Certifications'};
 return <article className={`resume-paper template-${r.template} ${mini?'mini-paper':''}`} style={{'--resume-accent':r.accent,'--resume-font':`${r.fontSize}px`,...css(design.page),...(design.font?{fontFamily:design.font==='mono'?'Courier New, monospace':'Georgia, serif'}:{})} as React.CSSProperties} aria-label={mini?undefined:'Live resume preview'}>
  <header className="resume-heading" style={headerStyle}><h2 style={css(design.name)}>{r.name||'Your name'}</h2><p className="resume-role" style={css(design.role)}>{r.headline}</p><div className="resume-contact" style={{...css(design.contact),...(design.header?.alignItems?{justifyContent:'center'}:{})}}>{[r.email,r.phone,r.location,r.website].filter(Boolean).map((x,i)=><span key={i}>{x}</span>)}</div></header>
  {r.order.map(key=>{const val=(r as any)[key];if(!val||(Array.isArray(val)?!val.some(x=>x.title||x.organization||x.details):!val.trim()))return null;return <section className="resume-section" key={key} style={css(design.section)}><h3 style={design.heading?{borderWidth:0,borderStyle:'solid',...css(design.heading)}:undefined}>{titles[key]}</h3>{Array.isArray(val)?val.map((e:any)=><div className="resume-entry" key={e.id}><div className="resume-entry-title"><strong>{e.title}</strong><span>{[e.start,e.end].filter(Boolean).join(' – ')}</span></div><div className="resume-organization">{[e.organization,e.location].filter(Boolean).join(' · ')}</div>{e.details&&<ul>{e.details.split('\n').filter(Boolean).map((l:string,i:number)=><li key={i}>{l.replace(/^[•\-]\s*/, '')}</li>)}</ul>}</div>):<p className="preserve-lines">{val}</p>}</section>})}
 </article>
}
