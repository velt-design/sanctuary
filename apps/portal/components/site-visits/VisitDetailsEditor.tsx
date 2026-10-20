'use client';
import { useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { Button } from '@/components/ui/foundation';
import type { CalendarVisit,VisitKind } from '@/lib/siteVisits/contract';
import { correctionCommand,historyCommand } from '@/lib/siteVisits/correctionContract';
import { calendarVisitKey } from './useCalendarVisits';
import VisitDetailFields from './VisitDetailFields';
import VisitProjectLink,{type VisitProjectChoice} from './VisitProjectLink';
import VisitProvenance from './VisitProvenance';
import { visitEditorDraft,visitEditorDetails } from './visitEditorModel';
import styles from './visitEditor.module.css';

export default function VisitDetailsEditor({visit,projectId,onDone}:{visit?:CalendarVisit;projectId?:string;onDone:()=>void}){
 const history=!visit||visit.origin==='history',client=useQueryClient(),lock=useRef(false);
 const [draft,setDraft]=useState(()=>visitEditorDraft(visit)),[revision,setRevision]=useState(visit?.revision??0);
 const [id]=useState(()=>visit?.id??crypto.randomUUID());
 const [selected,setSelected]=useState<VisitProjectChoice|null>(visit?.projectId?{id:visit.projectId,name:visit.projectName??'Current project',address:null}:null);
 const [mode,setMode]=useState<'manual'|'auto'>(visit?.linkMode??'manual'),[kind,setKind]=useState<VisitKind|''>(visit?.kindOverride==='provisional'?'':visit?.kindOverride??'');
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 const changed=Boolean(visit&&visit.revision!==revision);
 async function save(action='save'){
  if(lock.current||changed)return;
  const details=action==='restore'&&!history?{}:action!=='save'&&visit?.correction?visit.correction.details:visitEditorDetails(draft,visit);
  const base={action,id,revision,details,questions:action!=='save'?history?visit?.correction?.questions??[]:[]:draft.questions.split('\n').map(s=>s.trim()).filter(Boolean),basis:action==='restore'&&!history?'Restore the original Outlook details.':action!=='save'&&visit?.correction?visit.correction.basis:draft.basis,referenceUrl:draft.referenceUrl.trim()||null};
  const input=history?{...base,projectId:projectId?.replace(/^proj_/,'')}:{...base,projectId:selected?.id??null,linkMode:mode,kind:kind==='excluded'||kind==='review'?kind:draft.status==='booked'||draft.status==='attended'?'visit':draft.status==='provisional'?'provisional':kind||null};
  const parsed=(history?historyCommand:correctionCommand).safeParse(input);
  if(!parsed.success){setError(parsed.error.issues[0]?.message??'Check the visit details.');return;}
  lock.current=true;setPending(true);setError('');
  try{await apiJson(`/api/staff/v1/outlook-site-visits/${history?'history':'corrections'}`,{method:'POST',body:JSON.stringify(parsed.data)});
   await client.invalidateQueries({queryKey:calendarVisitKey});onDone();
  }catch(e){setError(e instanceof Error?e.message:'The visit could not be saved. Your changes are kept here.');}
  finally{lock.current=false;setPending(false);}
 }
 return <form className={styles.editor} aria-label={visit?`Correct ${visit.subject}`:'Record past visit'} onSubmit={e=>{e.preventDefault();void save();}}>
  <h3>{history?'Record a past visit':'Correct visit details'}</h3>
  <p className={styles.hint}>{history?'Record what is known. An unknown date is valid; no project stage or customer message will change.':'Saved details apply in the Portal. Ellen can keep using Outlook; the original booking stays available below.'}</p>
  {changed&&<p className={styles.notice} role="status">This visit changed while you were editing. Your draft is kept. Check the latest source below, then <button type="button" disabled={pending} onClick={()=>{setRevision(visit!.revision);setError('');}}>use the updated visit</button> before saving.</p>}
  <fieldset className={styles.body} disabled={pending}>
   <VisitDetailFields visit={visit} draft={draft} onChange={setDraft} />
   {!history&&<><VisitProjectLink selected={selected} onSelect={setSelected} mode={mode} onMode={setMode} />
    <label>Include in site visits<select value={kind} onChange={e=>setKind(e.target.value as VisitKind|'')}><option value="">Use Outlook classification</option><option value="visit">Yes, a separate site visit</option><option value="review">Needs checking</option><option value="excluded">Not a site visit</option></select></label></>}
  </fieldset>
  {visit&&<VisitProvenance visit={visit} />}
  {error&&<p className={styles.error} role="alert">{error} <button type="button" disabled={pending} onClick={()=>void client.invalidateQueries({queryKey:calendarVisitKey})}>Reload latest visit</button></p>}
  <div className={styles.actions}><Button type="submit" disabled={changed} loading={pending}>{history?'Save historical visit':'Save details'}</Button><Button variant="secondary" disabled={pending} onClick={onDone}>Cancel</Button>
   {visit?.correction&&!history&&<Button variant="quiet" disabled={pending||changed} onClick={()=>void save('restore')}>Restore Outlook details</Button>}
   {history&&visit&&<Button variant="quiet" disabled={pending||changed} onClick={()=>void save(visit.withdrawn?'restore':'withdraw')}>{visit.withdrawn?'Restore record':'Withdraw mistaken record'}</Button>}
  </div>
 </form>;
}
