'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button,Badge } from '@/components/ui/foundation';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { visitTime,visitDay,visitDate } from '@/lib/siteVisits/calendarModel';
import VisitReview from './VisitReview';
import styles from './siteVisits.module.css';
export default function VisitAgendaRow({visit:v}:{visit:CalendarVisit}){
  const [review,setReview]=useState(false);
  const title=v.subject.replace(/^(?:site\s*visit|sv)\s*-?\s*/i,'').replace(/\s*-\s*$/,'').replace(/\b[A-Z]{3,}\b/g,s=>s[0]+s.slice(1).toLowerCase());
  return <article className={styles.visit} id={`visit-${v.id}`}>
    <div className={styles.time}>{visitTime(v.startsAt)}<small>to {visitTime(v.endsAt)}</small>{visitDay(v.startsAt)!==visitDay(v.endsAt)&&<small>{visitDate(v.endsAt)}</small>}</div>
    <div><h3 className={styles.visitTitle}>{v.contactName?`${v.contactName} · `:''}{title}</h3><p className={styles.address}>{v.address??'Address not captured'}</p>
      {v.phone&&<a className={styles.phone} href={`tel:${v.phone.replace(/[^+\d]/g,'')}`}>{v.phone}</a>}
      <div className={styles.badges}>{v.cancelled&&<Badge tone="warning">Cancelled in Outlook</Badge>}{v.removed&&<Badge tone="warning">No longer in this calendar range</Badge>}{v.kind==='provisional'&&<Badge tone="warning">Provisional</Badge>}{v.kind==='review'&&<Badge tone="warning">Check visit type</Badge>}{v.kind==='excluded'&&<Badge>Excluded from visits</Badge>}{v.duplicate&&<Badge tone="warning">Possible duplicate</Badge>}{!v.projectId&&<Badge>Unlinked project</Badge>}</div>
    </div>
    <div className={styles.person}><strong>{v.staff.length?v.staff.map(p=>p.name).join(', '):'Unassigned'}</strong><small>{v.staff.length?'Invited in Outlook':v.assignmentHint?`${v.assignmentHint} named in title. Needs checking.`:'No recognised staff invitation.'}</small></div>
    <div className={styles.rowLinks}>{v.projectId&&<Link href={`/staff/projects/proj_${v.projectId}`}>Open project</Link>}{v.sourceUrl&&<a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">Open in Outlook ↗</a>}<Button variant="quiet" size="small" disabled={review} onClick={()=>setReview(true)} aria-expanded={review}>Review / link</Button></div>
    <div className={styles.rowDetail}>{v.reviewReasons.length>0&&<details><summary>Details to check ({v.reviewReasons.length})</summary><ul>{v.reviewReasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Original title: {v.subject}</p></details>}
      {review&&<VisitReview visit={v} onDone={()=>setReview(false)} />}
    </div>
  </article>;
}
