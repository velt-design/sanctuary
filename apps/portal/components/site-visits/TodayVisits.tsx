'use client';
import {useLayoutEffect} from 'react';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import { useCalendarVisits } from './useCalendarVisits';
import { visibleVisits } from '@/lib/siteVisits/calendarModel';
import TodayVisitsSurface from './TodayVisitsSurface';
import TodayVisitsDetails from './TodayVisitsDetails';
import {useDashboardWorkspace} from '@/app/dashboard/DashboardWorkspace';
export default function TodayVisits({loader}:{loader?:()=>Promise<VisitSnapshot>}={}){
  const workspace=useDashboardWorkspace();
  const query=useCalendarVisits(undefined,undefined,undefined,undefined,loader);
  const data=query.denied?undefined:query.data;
  const visits=visibleVisits(data?.events??[],'today','','').filter(v=>!v.correction?.sourceChanged);
  const props={data,details:data?<TodayVisitsDetails data={data} visits={visits} readFailed={query.isError}/>:undefined,pending:query.isPending&&!query.denied,readFailed:query.isError,onRetry:()=>void query.refetch()};
  useLayoutEffect(()=>{workspace?.publishVisits(props);});
  useLayoutEffect(()=>()=>workspace?.publishVisits(null),[workspace?.publishVisits]);
  return workspace||query.denied?null:<TodayVisitsSurface {...props}/>;
}
