'use client';
import Link from 'next/link';
import { useRef,useState } from 'react';
import { Button,Badge } from '@/components/ui/foundation';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { visitTime,visitDay,visitDate,visitDateRange,visitClockLabel } from '@/lib/siteVisits/calendarModel';
import { visitPurposeLabel,visitStatusLabel,visitStaffLabel } from '@/lib/siteVisits/reviewedVisit';
import VisitReview from './VisitReview';
import VisitProvenance from './VisitProvenance';
import styles from './siteVisits.module.css';
export default function VisitAgendaRow({visit:v,questionFirst=false}:{visit:CalendarVisit;questionFirst?:boolean}){
  const [review,setReview]=useState(false),trigger=useRef<HTMLButtonElement>(null);
  const title=v.subject.replace(/^(?:site\s*visit|sv)\s*-?\s*/i,'').replace(/\s*-\s*$/,'').replace(/\b[A-Z]{3,}\b/g,s=>s[0]+s.slice(1).toLowerCase());
  return <article className={styles.visit} id={`visit-${v.id}`}>
    <div className={styles.time}>{v.timing?<>{visitClockLabel(v)}{v.timing.date&&<small>{visitDateRange(v)}</small>}</>:v.isAllDay?<>All day<small>{visitDateRange(v)}</small></>:<>{v.startsAt?visitTime(v.startsAt):'Date unknown'}{v.endsAt&&<small>to {visitTime(v.endsAt)}</small>}{v.startsAt&&v.endsAt&&visitDay(v.startsAt)!==visitDay(v.endsAt)&&<small>{visitDate(v.endsAt)}</small>}</>}</div>
    <div><h3 className={styles.visitTitle}>{v.contactName?`${v.contactName} · `:''}{title}</h3>
      {questionFirst&&v.reviewReasons.length>0&&<div className={styles.reviewQuestions}><strong>Answer needed</strong><ul>{v.reviewReasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
      <p className={styles.address}>{v.address??'Address not captured'}</p>
      {v.phone&&<a className={styles.phone} href={`tel:${v.phone.replace(/[^+\d]/g,'')}`}>{v.phone}</a>}
      <div className={styles.badges}>{v.purpose&&<Badge>{visitPurposeLabel(v.purpose)}</Badge>}{v.status&&<Badge>{visitStatusLabel(v.status)}</Badge>}{v.correction?.sourceChanged&&<Badge tone="warning">Source changed · review needed</Badge>}{v.cancelled&&!v.status&&<Badge tone="warning">Cancelled in Outlook</Badge>}{v.removed&&<Badge tone="warning">No longer present in Outlook read</Badge>}{v.kind==='provisional'&&!v.status&&<Badge tone="warning">Provisional</Badge>}{v.kind==='review'&&<Badge tone="warning">Check visit type</Badge>}{v.kind==='excluded'&&<Badge>{v.withdrawn?'Withdrawn record':'Excluded from visits'}</Badge>}{v.duplicate&&<Badge tone="warning">Possible duplicate</Badge>}{!v.projectId&&<Badge>Unlinked project</Badge>}</div>
    </div>
    <div className={styles.person}><strong>{visitStaffLabel(v.staff)||'Unassigned'}</strong><small>{v.correction?.details.staff?'Reviewed in Portal':v.staff.length?'Invited in Outlook':v.assignmentHint?`${v.assignmentHint} named in title. Needs checking.`:'No recognised staff invitation.'}</small></div>
    <div className={styles.rowLinks}>{v.projectId&&<Link href={`/staff/projects/proj_${v.projectId}`}>Open project</Link>}{v.sourceUrl&&<a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">Open in Outlook ↗</a>}<Button ref={trigger} variant={questionFirst?'secondary':'quiet'} size="small" disabled={review} onClick={()=>setReview(true)} aria-expanded={review}>{questionFirst?'Resolve questions':'Correct details'}</Button></div>
    <div className={`${styles.rowDetail} ${review?styles.editing:''}`}>{!questionFirst&&v.reviewReasons.length>0&&<details open={v.correction?.sourceChanged||undefined}><summary>Details to check ({v.reviewReasons.length})</summary><ul>{v.reviewReasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Original title: {v.subject}</p></details>}
      {!review&&v.correction&&<VisitProvenance visit={v} />}
      {review&&<VisitReview visit={v} onDone={()=>{setReview(false);queueMicrotask(()=>trigger.current?.focus());}} />}
    </div>
  </article>;
}
