'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import styles from './visitEditor.module.css';
export type VisitProjectChoice={id:string;name:string;address:string|null};
export default function VisitProjectLink({selected,onSelect,mode,onMode}:{selected:VisitProjectChoice|null;onSelect:(p:VisitProjectChoice|null)=>void;mode:'manual'|'auto';onMode:(m:'manual'|'auto')=>void}){
 const [query,setQuery]=useState('');const normalized=query.trim();
 const projects=useQuery({queryKey:['outlook-visit-project-search',normalized],enabled:normalized.length>=2,queryFn:({signal})=>apiJson<{projects:VisitProjectChoice[];truncated:boolean}>(`/api/staff/v1/outlook-site-visits/projects?q=${encodeURIComponent(normalized)}`,{signal,cache:'no-store'}),retry:false,staleTime:30000});
 return <details className={styles.project}><summary>Project link: {selected?.name??'Not linked'}</summary>
   <label>Link method<select value={mode} onChange={e=>onMode(e.target.value as 'manual'|'auto')}><option value="auto">Match exact email and street address</option><option value="manual">Choose project or leave unlinked</option></select></label>
   {mode==='manual'&&<><label>Find project<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="Project, email or address" /></label>
    <label>Selected project<select value={selected?.id??''} onChange={e=>onSelect(projects.data?.projects.find(p=>p.id===e.target.value)??(selected?.id===e.target.value?selected:null))}><option value="">No linked project</option>{selected&&<option value={selected.id}>{selected.name}</option>}{projects.data?.projects.filter(p=>p.id!==selected?.id).slice(0,20).map(p=><option value={p.id} key={p.id}>{p.name}{p.address?` · ${p.address}`:''}</option>)}</select></label>
    {normalized.length>=2&&(projects.isPending?<p role="status">Finding projects…</p>:projects.isError?<p role="alert">Projects could not be searched. <button type="button" onClick={()=>void projects.refetch()}>Retry search</button></p>:projects.data?.truncated?<p>Narrow your search to see the right project.</p>:projects.data?.projects.length===0?<p>No matching project.</p>:null)}</>}
 </details>;
}
