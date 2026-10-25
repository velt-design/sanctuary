'use client';
import PortalIndexLink from '@/components/navigation/PortalIndexLink';
import type {VisitSnapshot} from '@/lib/siteVisits/contract';
import {visitClockLabel} from '@/lib/siteVisits/calendarModel';
import {visitStaffLabel} from '@/lib/siteVisits/reviewedVisit';
import CalendarFreshness from './CalendarFreshness';
import styles from './siteVisits.module.css';
export default function TodayVisitsDetails({data,visits,readFailed}:{data:VisitSnapshot;visits:VisitSnapshot['events'];readFailed:boolean}){return <>
      {visits.length?<ul className={styles.todayList}>{visits.map(v=><li key={v.id}><strong>{visitClockLabel(v)}</strong><PortalIndexLink href={`/staff/site-visits?${v.projectId?`project=${v.projectId}&`:''}view=today#visit-${v.id}`}>{v.contactName??v.subject}</PortalIndexLink><span>{visitStaffLabel(v.staff)||'Unassigned'}{v.kind==='provisional'?' · Provisional':''}{v.status==='attended'?' · Attendance recorded':''}</span></li>)}</ul>:<p>{data.lastSuccess?'No site visits in today’s calendar.':'Outlook has not been synced yet.'}</p>}
      <CalendarFreshness data={data} readFailed={readFailed} />

</>;}
