'use client';
import { useRef,useState } from 'react';
import { Button,Badge } from '@/components/ui/foundation';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { visibleVisits,visitScheduleLabel,requiresVisitReview } from '@/lib/siteVisits/calendarModel';
import { visitPurposeLabel,visitStatusLabel } from '@/lib/siteVisits/reviewedVisit';
import VisitDetailsEditor from './VisitDetailsEditor';
import VisitProvenance from './VisitProvenance';
import styles from './visitEditor.module.css';

function PastVisit({visit:v}:{visit:CalendarVisit}){
 const [editing,setEditing]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 return <li className={styles.historyItem} id={`history-${v.id}`}><header><strong>{visitPurposeLabel(v.purpose)}</strong><Button ref={trigger} variant="quiet" size="small" disabled={editing} onClick={()=>setEditing(true)}>Correct details</Button></header>
  <p>{visitScheduleLabel(v)}</p><p><strong>{v.staff.map(p=>p.name).join(', ')||'Staff not recorded'}</strong></p>{v.address&&<p>{v.address}</p>}
  <Badge tone={v.correction?.sourceChanged?'warning':'neutral'}>{v.withdrawn?'Withdrawn record':v.correction?.sourceChanged?'Source changed':visitStatusLabel(v.status)??(v.cancelled?'Cancelled booking':'Calendar booking · attendance not recorded')}</Badge>
  {v.removed&&<p>No longer present in the latest Outlook read. This does not establish cancellation or attendance.</p>}
  {requiresVisitReview(v)&&v.reviewReasons.length>0&&<ul className={styles.questions}>{v.reviewReasons.map(q=><li key={q}>{q}</li>)}</ul>}
  <VisitProvenance visit={v} />
  {editing&&<VisitDetailsEditor visit={v} projectId={v.projectId??undefined} onDone={()=>{setEditing(false);queueMicrotask(()=>trigger.current?.focus());}} />}
 </li>;
}
export default function ProjectVisitHistory({projectId,events}:{projectId:string;events:CalendarVisit[]}){
 const [adding,setAdding]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const history=visibleVisits(events,'history','','').reverse();
 return <div className={styles.history}>
  <details><summary>Visit history ({history.length})</summary>{history.length?<ol className={styles.historyList}>{history.map(v=><PastVisit key={v.id} visit={v} />)}</ol>:<p>No past visits recorded for this project.</p>}</details>
  <Button ref={trigger} className={styles.recordAction} variant="quiet" size="small" disabled={adding} onClick={()=>setAdding(true)}>Record past visit</Button>
  {adding&&<VisitDetailsEditor projectId={projectId} onDone={()=>{setAdding(false);queueMicrotask(()=>trigger.current?.focus());}} />}
 </div>;
}
