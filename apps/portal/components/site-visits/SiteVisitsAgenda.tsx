'use client';
import Link from 'next/link';
import ReadStatus from '@/components/page-state/ReadStatus';
import { useSearchParams } from 'next/navigation';
import { useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { PageLayout,Button,DataStatePanel } from '@/components/ui/foundation';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { visibleVisits,isScheduledVisit,requiresVisitReview,visitGroupDay,visitDateOnly,visitDate,visitStamp } from '@/lib/siteVisits/calendarModel';
import { personKey,personLabel,resolveVisitPersonKey } from '@/lib/siteVisits/reviewedVisit';
import { calendarVisitKey,useCalendarVisits } from './useCalendarVisits';
import VisitAgendaRow from './VisitAgendaRow';
import CalendarFreshness from './CalendarFreshness';
import { allVisitsHref,selectSiteVisitView as select } from './siteVisitNavigation';
import { shouldHandleRouteTransitionClick } from '@/components/page-state/PortalRouteTransition';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import type { CalendarVisitsInitialRead } from '@/lib/siteVisits/savedVisitsContract';
import styles from './siteVisits.module.css';
const views=[['today','Today'],['week','This week'],['upcoming','Upcoming'],['review','Needs review'],['history','History'],['changes','Changes']] as const;
export default function SiteVisitsAgenda({initialRead}:{initialRead?:CalendarVisitsInitialRead}){
  const {user}=usePortalSession();
  const params=useSearchParams(),requestedView=params.get('view');
  const view=views.some(([key])=>key===requestedView)?requestedView!:'today',requestedPerson=params.get('person')??'',search=params.get('q')??'',projectId=params.get('project')||undefined;
  const visitId=params.get('visit')||undefined;
  const query=useCalendarVisits(projectId,undefined,visitId,initialRead?{read:initialRead,ownerId:user?.id??null}:undefined),client=useQueryClient(),lock=useRef(false),searchRef=useRef<HTMLInputElement>(null);
  const [refreshing,setRefreshing]=useState(false),[message,setMessage]=useState('');
  const data=query.data;
  const reviewCount=data?.events.filter(requiresVisitReview).length;
  const person=resolveVisitPersonKey(data?.events??[],requestedPerson);
  const events=visitId?(data?.events??[]).filter(v=>v.id===visitId):visibleVisits(data?.events??[],view,person,search);
  const scheduledCount=events.filter(isScheduledVisit).length;
  const groups=new Map<string,typeof events>();for(const visit of events){const day=visitGroupDay(visit,view);groups.set(day,[...(groups.get(day)??[]),visit]);}
  async function refresh(){if(lock.current)return;lock.current=true;setRefreshing(true);setMessage('');try{
    const result=await apiJson<{updated:boolean;reason?:string}>('/api/staff/v1/outlook-site-visits/refresh',{method:'POST'});
    setMessage(result.updated?'Outlook calendar updated.':result.reason==='recent'?'A refresh was attempted within the last five minutes. Please try again shortly.':'A calendar update is already running.');
    await client.invalidateQueries({queryKey:calendarVisitKey});
  }catch(e){setMessage(e instanceof Error?e.message:'Outlook could not be refreshed.');}finally{lock.current=false;setRefreshing(false);}}
  const staff=[...new Map((data?.events??[]).flatMap(v=>v.staff).map(p=>[personKey(p),p])).values()].sort((a,b)=>personLabel(a).localeCompare(personLabel(b)));
  return <PageLayout width="full" density="compact" className={styles.page}>
    <StaffPageHeader title="Site visits" right={<Button variant="secondary" loading={refreshing} disabled={!data?.enabled||query.denied} onClick={()=>void refresh()}>Refresh Outlook</Button>} />
    <div className={styles.content}><p className={styles.intro}>Who’s visiting, where, and when. Ellen keeps bookings in Outlook.</p>
      <div className={styles.controls}><div className={styles.views} role="group" aria-label="Show visits">{views.map(([key,label])=><button key={key} type="button" aria-label={key==='review'&&reviewCount!==undefined?`${label}, ${reviewCount} ${reviewCount===1?'entry':'entries'}`:undefined} aria-pressed={view===key} onClick={()=>select({view:key})}>{label}{key==='review'?<span className={styles.reviewCount} aria-hidden="true" data-pending={reviewCount===undefined||undefined}>{reviewCount===undefined?'\u00a0':reviewCount>999?'999+':reviewCount}</span>:null}</button>)}</div>
        <div className={styles.filters}><label className={styles.attendingFilter}>Attending<select value={person} onChange={e=>select({person:e.target.value})}><option value="">Everyone</option>{staff.map(p=><option key={personKey(p)} value={personKey(p)}>{personLabel(p)}</option>)}<option value="unassigned">Unassigned</option></select></label>
          <label>Find a visit<div className={styles.searchBox}><input ref={searchRef} value={search} type="search" onChange={e=>select({q:e.target.value})} onKeyDown={e=>{if(e.key==='Escape')select({q:''});}} placeholder="Customer, place or address" /><button type="button" disabled={!search} aria-label="Clear search" onClick={()=>{select({q:''});searchRef.current?.focus();}}>Clear</button></div></label></div></div>
      <div className={styles.calendarContext} aria-label="Calendar source and scope">
        {visitId&&<p className={styles.projectScope}>Exact visit selected from the report. Use Correct details to record attendance, purpose or date. <Button variant="quiet" onClick={()=>select({visit:'',view:'history'})}>Show visit history</Button></p>}
        {projectId&&<p className={styles.projectScope}>Visits linked to this project. <Link href={allVisitsHref(params)} onClick={event=>{if(!shouldHandleRouteTransitionClick(event))return;event.preventDefault();select({project:''},'push');}}>Show all visits</Link></p>}
        <div className={styles.calendarStatus}>{data?<CalendarFreshness compact data={data} readFailed={query.isError} message={message} action={query.isError?<Button variant="quiet" onClick={()=>void query.refetch()}>Retry loading saved visits</Button>:undefined}/>:<ReadStatus title={query.isPending?'Reading saved calendar visits':'Calendar visit evidence unavailable'} tone={query.isPending?'neutral':'error'} onRetry={query.isPending||query.denied?undefined:()=>void query.refetch()}/>}</div>
      </div>
        <div className={styles.summary}><h2>{view==='today'?visitDate(new Date().toISOString()):view==='review'?'Needs review':view==='history'?'Visit history':view==='changes'?'Calendar changes':view==='week'?'This week':'Upcoming visits'}</h2><p role="status">{!data?query.isPending?'Reading visits…':'Visit evidence unavailable':view==='review'||view==='changes'||view==='history'?`${events.length} ${events.length===1?'entry':'entries'}`:`${scheduledCount} scheduled ${scheduledCount===1?'visit':'visits'}${events.some(v=>v.kind==='provisional')?` · ${events.filter(v=>v.kind==='provisional').length} provisional`:''}`}</p><small>All times New Zealand</small></div>
      {query.denied?<DataStatePanel state="unavailable" title="Site visit access unavailable" description="Your Portal session no longer has access." />:!data?query.isPending?<p role="status">Reading the saved visit agenda…</p>:<DataStatePanel state="error" title="Site visits unavailable" description="The calendar could not be loaded." onRetry={()=>void query.refetch()} />:<>

        {view==='review'&&<p className={styles.notice}>Resolve the specific questions or reconcile a changed Outlook booking. Verified Portal details stay saved.</p>}
        {events.length===0?<div className={styles.empty}><h3>No visits match this view</h3><p>{data.lastSuccess?'Try another view or clear the filters.':'Visits will appear after the first successful Outlook update.'}</p>{(person||search)&&<Button variant="secondary" onClick={()=>{select({person:'',q:''});searchRef.current?.focus();}}>Clear filters</Button>}</div>:[...groups].map(([day,items])=><section key={day} className={styles.day}><header><h2>{day==='unknown'?'Historical visits · date not recorded':visitDateOnly(day)}</h2><span>{items.length} {items.length===1?'entry':'entries'}</span></header>{items.map(visit=><VisitAgendaRow key={visit.id} visit={visit} questionFirst={view==='review'} />)}</section>)}
        <footer className={styles.footer}>{data.rangeStart&&data.rangeEnd?<span>Calendar range: {visitStamp(data.rangeStart)} to {visitStamp(data.rangeEnd)}.</span>:null}<span>Scheduled visits are not evidence of completion.</span></footer>
      </>}
    </div>
  </PageLayout>;
}
