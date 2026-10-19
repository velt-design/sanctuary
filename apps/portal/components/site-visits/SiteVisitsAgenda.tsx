'use client';
import Link from 'next/link';
import { useMemo,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { PageLayout,Button,DataStatePanel,LoadingSkeleton } from '@/components/ui/foundation';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { visibleVisits,isScheduledVisit,requiresVisitReview,visitDay,visitDate,visitStamp } from '@/lib/siteVisits/calendarModel';
import { calendarVisitKey,useCalendarVisits } from './useCalendarVisits';
import VisitAgendaRow from './VisitAgendaRow';
import CalendarFreshness from './CalendarFreshness';
import styles from './siteVisits.module.css';
const views=[['today','Today'],['week','This week'],['upcoming','Upcoming'],['review','Needs review'],['changes','Changes']] as const;
export default function SiteVisitsAgenda({projectId,initialView='today',initialPerson='',initialQuery=''}:{projectId?:string;initialView?:string;initialPerson?:string;initialQuery?:string}){
  const query=useCalendarVisits(projectId),client=useQueryClient(),lock=useRef(false),searchRef=useRef<HTMLInputElement>(null);
  const [view,setView]=useState(views.some(([key])=>key===initialView)?initialView:'today'),[person,setPerson]=useState(initialPerson),[search,setSearch]=useState(initialQuery);
  const [refreshing,setRefreshing]=useState(false),[message,setMessage]=useState('');
  const data=query.data;
  const events=useMemo(()=>visibleVisits(data?.events??[],view,person,search),[data,view,person,search]);
  const scheduledCount=events.filter(isScheduledVisit).length;
  const groups=new Map<string,typeof events>();for(const visit of events){const day=visitDay(visit.startsAt);groups.set(day,[...(groups.get(day)??[]),visit]);}
  function select(next:{view?:string;person?:string;q?:string}){
    if(next.view!==undefined)setView(next.view);if(next.person!==undefined)setPerson(next.person);if(next.q!==undefined)setSearch(next.q);
    const url=new URL(window.location.href);for(const [key,value] of Object.entries(next)){if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}window.history.replaceState(null,'',url);
  }
  async function refresh(){if(lock.current)return;lock.current=true;setRefreshing(true);setMessage('');try{
    const result=await apiJson<{updated:boolean;reason?:string}>('/api/staff/v1/outlook-site-visits/refresh',{method:'POST'});
    setMessage(result.updated?'Outlook calendar updated.':result.reason==='recent'?'A refresh was attempted within the last five minutes. Please try again shortly.':'A calendar update is already running.');
    await client.invalidateQueries({queryKey:calendarVisitKey});
  }catch(e){setMessage(e instanceof Error?e.message:'Outlook could not be refreshed.');}finally{lock.current=false;setRefreshing(false);}}
  const staff=[...new Map((data?.events??[]).flatMap(v=>v.staff).map(p=>[p.email,p])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  return <PageLayout width="full" density="compact" className={styles.page}>
    <StaffPageHeader title="Site visits" right={<Button variant="secondary" loading={refreshing} disabled={!data?.enabled||query.denied} onClick={()=>void refresh()}>Refresh Outlook</Button>} />
    <div className={styles.content}><p className={styles.intro}>Who’s visiting, where, and when. Ellen keeps bookings in Outlook.</p>
      {data&&<CalendarFreshness data={data} readFailed={query.isError} />}
      {data&&query.isError&&<Button variant="quiet" onClick={()=>void query.refetch()}>Retry loading saved visits</Button>}
      {message&&<p className={styles.notice} role="status">{message}</p>}
      {projectId&&<p className={styles.projectScope}>Visits linked to this project. <Link href="/staff/site-visits">Show all visits</Link></p>}
      <div className={styles.controls}><div className={styles.views} role="group" aria-label="Show visits">{views.map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>select({view:key})}>{label}{key==='review'&&data?<span>{data.events.filter(requiresVisitReview).length}</span>:null}</button>)}</div>
        <div className={styles.filters}><label>Attending<select value={person} onChange={e=>select({person:e.target.value})}><option value="">Everyone</option>{staff.map(p=><option key={p.email} value={p.email}>{p.name}</option>)}<option value="unassigned">Unassigned</option></select></label>
          <label>Find a visit<div className={styles.searchBox}><input ref={searchRef} value={search} type="search" onChange={e=>select({q:e.target.value})} onKeyDown={e=>{if(e.key==='Escape')select({q:''});}} placeholder="Customer, place or address" /><button type="button" disabled={!search} aria-label="Clear search" onClick={()=>{select({q:''});searchRef.current?.focus();}}>Clear</button></div></label></div></div>
      {query.denied?<DataStatePanel state="unavailable" title="Site visit access unavailable" description="Your Portal session no longer has access." />:!data?query.isPending?<LoadingSkeleton rows={4} label="Loading site visits" />:<DataStatePanel state="error" title="Site visits unavailable" description="The calendar could not be loaded." onRetry={()=>void query.refetch()} />:<>
        <div className={styles.summary}><h2>{view==='today'?visitDate(new Date().toISOString()):view==='review'?'Needs review':view==='changes'?'Calendar changes':view==='week'?'This week':'Upcoming visits'}</h2><p role="status">{view==='review'||view==='changes'?`${events.length} ${events.length===1?'entry':'entries'}`:`${scheduledCount} scheduled ${scheduledCount===1?'visit':'visits'}${events.some(v=>v.kind==='provisional')?` · ${events.filter(v=>v.kind==='provisional').length} provisional`:''}`}</p><small>All times New Zealand</small></div>
        {view==='review'&&<p className={styles.notice}>Review uncertain bookings and project links here. Staff and time changes belong in Outlook.</p>}
        {events.length===0?<div className={styles.empty}><h3>No visits match this view</h3><p>{data.lastSuccess?'Try another view or clear the filters.':'Visits will appear after the first successful Outlook update.'}</p>{(person||search)&&<Button variant="secondary" onClick={()=>{select({person:'',q:''});searchRef.current?.focus();}}>Clear filters</Button>}</div>:[...groups].map(([day,items])=><section key={day} className={styles.day}><header><h2>{visitDate(items[0].startsAt)}</h2><span>{items.length} {items.length===1?'booking':'bookings'}</span></header>{items.map(visit=><VisitAgendaRow key={visit.id} visit={visit} />)}</section>)}
        <footer className={styles.footer}>{data.rangeStart&&data.rangeEnd?<span>Calendar range: {visitStamp(data.rangeStart)} to {visitStamp(data.rangeEnd)}.</span>:null}<span>Scheduled visits are not evidence of completion.</span></footer>
      </>}
    </div>
  </PageLayout>;
}
