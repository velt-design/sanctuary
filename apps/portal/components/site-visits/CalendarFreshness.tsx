'use client';
import { useEffect,useState } from 'react';
import { visitStamp } from '@/lib/siteVisits/calendarModel';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import styles from './siteVisits.module.css';
export default function CalendarFreshness({data,readFailed=false}:{data:VisitSnapshot;readFailed?:boolean}){
  const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const stale=data.lastSuccess&&now-Date.parse(data.lastSuccess)>30*60000;
  return <div className={styles.freshness}>
    <span>{data.lastSuccess?`Outlook updated ${visitStamp(data.lastSuccess)}`:'Outlook has not been synced yet'}. New Zealand time.</span>
    {!data.enabled&&<strong>Calendar connection is not active.</strong>}
    {readFailed?<strong role="status">Latest Portal read failed. Showing saved data.</strong>:data.error||stale?<strong role="status">{data.error==='ACCESS_REQUIRED'?'Outlook access needs attention.':data.error?'The last Outlook update failed.':'Calendar updates are overdue.'} Check Outlook for recent changes.</strong>:data.enabled?<span>Updates every 15 minutes.</span>:null}
  </div>;
}
