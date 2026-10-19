'use client';
import Link from 'next/link';
import { Card,Button,LoadingSkeleton } from '@/components/ui/foundation';
import { useCalendarVisits } from './useCalendarVisits';
import { visibleVisits,visitTime } from '@/lib/siteVisits/calendarModel';
import CalendarFreshness from './CalendarFreshness';
import styles from './siteVisits.module.css';
export default function TodayVisits(){
  const query=useCalendarVisits();if(query.denied)return null;
  const visits=visibleVisits(query.data?.events??[],'today','','');
  return <Card title="Today’s site visits" padding="compact" action={<Link href="/staff/site-visits">View agenda</Link>}>
    {!query.data?query.isPending?<LoadingSkeleton rows={2} label="Loading site visits" />:<p>Site visits unavailable. <Button variant="quiet" onClick={()=>void query.refetch()}>Retry</Button></p>:<>
      {visits.length?<ul className={styles.todayList}>{visits.map(v=><li key={v.id}><strong>{visitTime(v.startsAt)}</strong><Link href={`/staff/site-visits?${v.projectId?`project=${v.projectId}&`:''}view=today#visit-${v.id}`}>{v.contactName??v.subject}</Link><span>{v.staff.map(p=>p.name).join(', ')||'Unassigned'}{v.kind==='provisional'?' · Provisional':''}</span></li>)}</ul>:<p>{query.data.lastSuccess?'No site visits in today’s calendar.':'Outlook has not been synced yet.'}</p>}
      <CalendarFreshness data={query.data} readFailed={query.isError} />
    </>}
  </Card>;
}
