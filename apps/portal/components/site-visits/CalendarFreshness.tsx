'use client';
import ReadStatus from '@/components/page-state/ReadStatus';
import { useEffect,useState,type ReactNode } from 'react';
import { visitStamp } from '@/lib/siteVisits/calendarModel';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import styles from './siteVisits.module.css';
export default function CalendarFreshness({data,readFailed=false,compact=false,message,action}:{data:VisitSnapshot;readFailed?:boolean;compact?:boolean;message?:string;action?:ReactNode}){
  const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const stale=data.lastSuccess&&now-Date.parse(data.lastSuccess)>30*60000;
  const content=<div className={styles.freshness}>
    <span>{data.lastSuccess?`Outlook updated ${visitStamp(data.lastSuccess)}`:'Outlook has not been synced yet'}. New Zealand time.</span>
    {!data.enabled&&<strong>Calendar connection is not active.</strong>}
    {readFailed?<strong role="status">Latest Portal read failed. Showing saved data.</strong>:data.error||stale?<strong role="status">{data.error==='ACCESS_REQUIRED'?'Outlook access needs attention.':data.error?'The last Outlook update failed.':'Calendar updates are overdue.'} Check Outlook for recent changes.</strong>:data.enabled?<span>Updates every 15 minutes.</span>:null}
  </div>;
  if(!compact)return content;
  const title=readFailed?'Latest Portal read failed. Showing saved data.':data.error==='ACCESS_REQUIRED'?'Outlook access needs attention':data.error?'The last Outlook update failed':!data.enabled?'Calendar connection is not active':stale?'Calendar updates are overdue':message||(data.lastSuccess?`Outlook updated ${visitStamp(data.lastSuccess)}`:'Outlook has not been synced yet');
  return <ReadStatus title={title} tone={!data.enabled||readFailed||data.error||stale?'warning':'neutral'} action={action} details={<>{content}{message?<p>{message}</p>:null}</>}/>;
}
