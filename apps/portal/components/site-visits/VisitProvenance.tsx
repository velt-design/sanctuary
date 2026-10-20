'use client';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import { visitScheduleLabel,visitStamp } from '@/lib/siteVisits/calendarModel';
import styles from './visitEditor.module.css';
export default function VisitProvenance({visit:v}:{visit:CalendarVisit}){
 const source=v.source??v;
 return <details className={styles.provenance}><summary>{v.correction?`${v.origin==='history'?'Recorded':'Reviewed'} in Portal · ${visitStamp(v.correction.updatedAt)}`:'Outlook booking details'}</summary>
   {v.correction&&<><p>{v.correction.basis}</p>{v.correction.referenceUrl&&<a href={v.correction.referenceUrl} target="_blank" rel="noopener noreferrer">Supporting source ↗</a>}</>}
   {v.origin!=='history'&&<div className={styles.source}><strong>Original Outlook booking</strong><p>{source.subject}</p><p>{visitScheduleLabel({...source,timing:undefined})}</p><p>{source.staff.map(p=>p.name).join(', ')||'No recognised staff invitation'}</p><p>{source.address??'Address not captured'}</p><p>{source.cancelled?'Cancelled in Outlook':source.sourceKind==='provisional'?'Provisional in Outlook':'Calendar entry only'}</p></div>}
 </details>;
}
