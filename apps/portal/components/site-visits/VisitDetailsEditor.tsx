'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/foundation';
import type { CalendarVisit,VisitKind } from '@/lib/siteVisits/contract';
import { correctionCommand,historyCommand } from '@/lib/siteVisits/correctionContract';
import VisitDetailFields from './VisitDetailFields';
import VisitProjectLink,{type VisitProjectChoice} from './VisitProjectLink';
import VisitProvenance from './VisitProvenance';
import { visitEditorDraft,visitEditorDetails } from './visitEditorModel';
import { useVisitSave } from './useVisitSave';
import VisitSaveRecovery from './VisitSaveRecovery';
import styles from './visitEditor.module.css';

export default function VisitDetailsEditor({visit,projectId,onDone}:{visit?:CalendarVisit;projectId?:string;onDone:()=>void}){
 const history=!visit||visit.origin==='history';
 const [draft,setDraft]=useState(()=>visitEditorDraft(visit));
 const [id]=useState(()=>visit?.id??crypto.randomUUID());
 const state=useVisitSave({visit,id,projectId,onDone});
 const {current,revision,pending,error,setError,recovery,changed,blocked}=state;
 const [selected,setSelected]=useState<VisitProjectChoice|null>(visit?.projectId?{id:visit.projectId,name:visit.projectName??'Current project',address:null}:null);
 const [mode,setMode]=useState<'manual'|'auto'>(visit?.linkMode??'manual'),[kind,setKind]=useState<VisitKind|''>(visit?.kindOverride==='provisional'?'':visit?.kindOverride??'');
 async function save(action='save'){
  if(pending||blocked)return;
  const details=action==='restore'&&!history?{}:action!=='save'&&current?.correction?current.correction.details:visitEditorDetails(draft,visit);
  const base={action,id,revision,details,questions:action!=='save'?history?current?.correction?.questions??[]:[]:draft.questions.split('\n').map(s=>s.trim()).filter(Boolean),basis:action==='restore'&&!history?'Restore the original Outlook details.':action!=='save'&&current?.correction?current.correction.basis:draft.basis,referenceUrl:draft.referenceUrl.trim()||null};
  const input=history?{...base,projectId:projectId?.replace(/^proj_/,'')}:{...base,projectId:selected?.id??null,linkMode:mode,kind:kind==='excluded'||kind==='review'?kind:draft.status==='booked'||draft.status==='attended'?'visit':draft.status==='provisional'?'provisional':kind||null};
  const parsed=(history?historyCommand:correctionCommand).safeParse(input);
  if(!parsed.success){setError(parsed.error.issues[0]?.message??'Check the visit details.');return;}
  await state.save(`/api/staff/v1/outlook-site-visits/${history?'history':'corrections'}`,parsed.data);
 }
 return <form className={styles.editor} aria-label={visit?`Correct ${visit.subject}`:'Record past visit'} onSubmit={e=>{e.preventDefault();void save();}}>
  <h3>{history?'Record a past visit':'Correct visit details'}</h3>
  <p className={styles.hint}>{history?'Record what is known. An unknown date is valid; no project stage or customer message will change.':'Saved details apply in the Portal. Ellen can keep using Outlook; the original booking stays available below.'}</p>
  {changed&&!recovery&&<p className={styles.notice} role="status">This visit changed while you were editing. Your draft is kept. Check the latest source below, then <button type="button" disabled={pending} onClick={state.acknowledge}>use the updated visit</button> before saving.</p>}
  {recovery&&<VisitSaveRecovery recovery={recovery} pending={pending} onReload={()=>void state.reload()} onAcknowledge={state.acknowledge} />}
  <fieldset className={styles.body} disabled={pending}>
   <VisitDetailFields visit={visit} draft={draft} onChange={setDraft} />
   {!history&&<><VisitProjectLink selected={selected} onSelect={setSelected} mode={mode} onMode={setMode} />
    <label>Include in site visits<select value={kind} onChange={e=>setKind(e.target.value as VisitKind|'')}><option value="">Use Outlook classification</option><option value="visit">Yes, a separate site visit</option><option value="review">Needs checking</option><option value="excluded">Not a site visit</option></select></label></>}
  </fieldset>
  {current&&<VisitProvenance visit={current} />}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <div className={styles.actions}><Button type="submit" disabled={blocked} loading={pending}>{history?'Save historical visit':'Save details'}</Button><Button variant="secondary" disabled={pending} onClick={onDone}>Cancel</Button>
   {current?.correction&&!history&&<Button variant="quiet" disabled={pending||blocked} onClick={()=>void save('restore')}>Restore Outlook details</Button>}
   {history&&current&&<Button variant="quiet" disabled={pending||blocked} onClick={()=>void save(current.withdrawn?'restore':'withdraw')}>{current.withdrawn?'Restore record':'Withdraw mistaken record'}</Button>}
  </div>
 </form>;
}
