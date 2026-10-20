'use client';
import { useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { Button } from '@/components/ui/foundation';
import type { CalendarVisit,VisitKind } from '@/lib/siteVisits/contract';
import { calendarVisitKey } from './useCalendarVisits';
import styles from './siteVisits.module.css';
type ProjectChoice={id:string;name:string;address:string|null};
export default function VisitReview({visit,onDone}:{visit:CalendarVisit;onDone:()=>void}){
  const client=useQueryClient();const lock=useRef(false);
  const [query,setQuery]=useState(''),[selected,setSelected]=useState<ProjectChoice|null>(visit.projectId?{id:visit.projectId,name:visit.projectName??'Current linked project',address:null}:null),[mode,setMode]=useState<'manual'|'auto'>(visit.linkMode);
  const [revision,setRevision]=useState(visit.revision);
  const [kind,setKind]=useState<VisitKind|''>(visit.kindOverride??''),[pending,setPending]=useState(false),[error,setError]=useState('');
  const normalized=query.trim();
  const projects=useQuery({queryKey:['outlook-visit-project-search',normalized],enabled:normalized.length>=2,
    queryFn:({signal})=>apiJson<{projects:ProjectChoice[];truncated:boolean}>(`/api/staff/v1/outlook-site-visits/projects?q=${encodeURIComponent(normalized)}`,{signal,cache:'no-store'}),retry:false,staleTime:30000});
  async function save(){if(lock.current)return;lock.current=true;setPending(true);setError('');try{
    await apiJson('/api/staff/v1/outlook-site-visits/review',{method:'POST',body:JSON.stringify({id:visit.id,revision,projectId:selected?.id??null,linkMode:mode,kind:kind||null})});
    await client.invalidateQueries({queryKey:calendarVisitKey});onDone();
  }catch(e){setError(e instanceof Error?e.message:'Review could not be saved.');}finally{lock.current=false;setPending(false);}}
  return <form className={styles.reviewForm} onSubmit={e=>{e.preventDefault();void save();}} aria-label={`Review ${visit.subject}`}>
    <p>Dates and attending staff stay in Outlook. These choices only organise the Portal.</p>
    {visit.revision!==revision&&<p className={styles.notice} role="status">This visit changed while you were reviewing it. Your choices are kept here. Check the updated booking above, then <button type="button" disabled={pending} onClick={()=>{setRevision(visit.revision);setError('');}}>use the updated visit</button> before saving.</p>}
    <fieldset disabled={pending}>
      <label>Visit type<select value={kind} onChange={e=>setKind(e.target.value as VisitKind|'')}>
        <option value="">Use Outlook classification</option><option value="visit">Site visit (separate booking)</option><option value="provisional">Provisional site visit</option><option value="excluded">Not a site visit</option><option value="review">Needs checking</option>
      </select></label>
      <label>Project link<select value={mode} onChange={e=>setMode(e.target.value as 'manual'|'auto')}><option value="auto">Match exact email and street address</option><option value="manual">Choose project or leave unlinked</option></select></label>
      {mode==='manual'&&<div className={styles.projectPicker}>
        <label>Find project<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="Project, email or address" /></label>
        <label>Selected project<select value={selected?.id??''} onChange={e=>setSelected(projects.data?.projects.find(p=>p.id===e.target.value)??(selected?.id===e.target.value?selected:null))}>
          <option value="">No linked project</option>
          {selected&&<option value={selected.id}>{selected.name}{selected.address?` · ${selected.address}`:''}</option>}
          {(projects.data?.projects??[]).slice(0,20).filter(p=>p.id!==selected?.id).map(p=><option key={p.id} value={p.id}>{p.name}{p.address?` · ${p.address}`:''}</option>)}
        </select></label>
        {normalized.length>=2&&(projects.isPending?<p role="status">Finding projects…</p>:projects.isError?<p role="alert">Projects could not be searched. <button type="button" onClick={()=>void projects.refetch()}>Retry search</button></p>:projects.data?.truncated?<p>Narrow your search to see the right project.</p>:projects.data?.projects.length===0?<p>No matching project. The visit can stay unlinked.</p>:null)}
      </div>}
    </fieldset>
    {error&&<p role="alert" className={styles.error}>{error} <button type="button" onClick={()=>void client.invalidateQueries({queryKey:calendarVisitKey})}>Reload visit</button></p>}
    <div className={styles.actions}><Button type="submit" disabled={visit.revision!==revision} loading={pending}>Save review</Button><Button variant="secondary" disabled={pending} onClick={onDone}>Cancel</Button></div>
  </form>;
}
