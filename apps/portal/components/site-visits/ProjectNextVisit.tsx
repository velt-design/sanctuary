'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { Card,Button,LoadingSkeleton } from '@/components/ui/foundation';
import { useCalendarVisits } from './useCalendarVisits';
import { visitScheduleLabel,visitHasNotEnded,isScheduledVisit,compareVisitSchedule,requiresVisitReview } from '@/lib/siteVisits/calendarModel';
import CalendarFreshness from './CalendarFreshness';
import ProjectVisitHistory from './ProjectVisitHistory';
import { visitStaffLabel } from '@/lib/siteVisits/reviewedVisit';
import styles from './siteVisits.module.css';
export default function ProjectNextVisit({projectId,host,onAccessEnding}:{projectId:string;host:string;onAccessEnding?:(status:number)=>void}){
  const query=useCalendarVisits(projectId,host);
  useEffect(()=>{if(query.denied)onAccessEnding?.(403);},[query.denied,onAccessEnding]);
  if(query.denied)return null;
  const visit=query.data?.events.filter(v=>(isScheduledVisit(v)||v.kind==='provisional')&&!v.cancelled&&!v.removed&&!v.duplicate&&visitHasNotEnded(v)).sort(compareVisitSchedule)[0];
  const questions=query.data?.events.filter(requiresVisitReview).length??0;
  if(query.data&&!visit&&!questions&&!query.isError){
    const attention=!query.data.enabled||query.data.error||!query.data.lastSuccess||Date.now()-Date.parse(query.data.lastSuccess)>30*60000;
    return <div className={styles.compactVisits}><details><summary>Site visits · none upcoming</summary>
      <p><Link href={`/staff/site-visits?project=${encodeURIComponent(projectId)}&view=history`}>View visits</Link></p>
      {!attention&&<CalendarFreshness data={query.data} />}
      <ProjectVisitHistory projectId={projectId} events={query.data.events} />
    </details>{attention&&<CalendarFreshness data={query.data} />}</div>;
  }
  return <Card title="Site visits" padding="compact" className={styles.projectCard} action={<Link href={`/staff/site-visits?project=${encodeURIComponent(projectId)}&view=upcoming`}>View visits</Link>}>
    {!query.data?query.isPending?<LoadingSkeleton rows={1} label="Loading next site visit" />:<p>Site visits could not be loaded. <Button variant="quiet" size="small" onClick={()=>void query.refetch()}>Retry</Button></p>:<>
      {visit?<div className={styles.nextVisit}><strong>{visitScheduleLabel(visit)}</strong><span>{visitStaffLabel(visit.staff)||'Staff not assigned'}{visit.kind==='provisional'?' · Provisional':''}</span>{visit.address&&<span>{visit.address}</span>}</div>:<p>{query.data.lastSuccess?'No upcoming Outlook visit is linked to this project.':'Outlook visits have not been synced yet.'}</p>}
      <CalendarFreshness data={query.data} readFailed={query.isError} />
      {questions>0&&<p><Link href={`/staff/site-visits?project=${encodeURIComponent(projectId)}&view=review`}>{questions} {questions===1?'visit needs':'visits need'} an answer</Link></p>}
      <ProjectVisitHistory projectId={projectId} events={query.data.events} />
    </>}
  </Card>;
}
