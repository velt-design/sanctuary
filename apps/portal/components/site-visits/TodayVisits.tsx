'use client';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import { Card,Button } from '@/components/ui/foundation';
import { useCalendarVisits } from './useCalendarVisits';
import { visibleVisits,visitClockLabel } from '@/lib/siteVisits/calendarModel';
import CalendarFreshness from './CalendarFreshness';
import { visitStaffLabel } from '@/lib/siteVisits/reviewedVisit';
import styles from './siteVisits.module.css';
export default function TodayVisits({loader}:{loader?:()=>Promise<VisitSnapshot>}={}){
  const query=useCalendarVisits(undefined,undefined,undefined,undefined,loader);if(query.denied)return null;
  const visits=visibleVisits(query.data?.events??[],'today','','').filter(v=>!v.correction?.sourceChanged);
  return <Card title="Today’s site visits" padding="compact" action={<PortalIndexLink href="/staff/site-visits">View agenda</PortalIndexLink>}>
    {!query.data?query.isPending?<p role="status">Reading today’s site visits…</p>:<p>Site visits unavailable. <Button variant="quiet" onClick={()=>void query.refetch()}>Retry</Button></p>:<>
      {visits.length?<ul className={styles.todayList}>{visits.map(v=><li key={v.id}><strong>{visitClockLabel(v)}</strong><PortalIndexLink href={`/staff/site-visits?${v.projectId?`project=${v.projectId}&`:''}view=today#visit-${v.id}`}>{v.contactName??v.subject}</PortalIndexLink><span>{visitStaffLabel(v.staff)||'Unassigned'}{v.kind==='provisional'?' · Provisional':''}{v.status==='attended'?' · Attendance recorded':''}</span></li>)}</ul>:<p>{query.data.lastSuccess?'No site visits in today’s calendar.':'Outlook has not been synced yet.'}</p>}
      <CalendarFreshness data={query.data} readFailed={query.isError} />
    </>}
  </Card>;
}
