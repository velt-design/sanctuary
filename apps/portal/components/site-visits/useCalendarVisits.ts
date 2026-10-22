'use client';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import { calendarVisitsQueryKey,calendarVisitsReadFunction } from './calendarVisitsInitialRead';
import type { CalendarVisitsInitialRead } from '@/lib/siteVisits/savedVisitsContract';
export { calendarVisitKey } from './calendarVisitsInitialRead';
export function useCalendarVisits(projectId?:string,host?:string,visitId?:string,initial?:{read:CalendarVisitsInitialRead;ownerId:string|null}){
  const client=useQueryClient(),queryHost=host??(typeof window==='undefined'?'server':window.location.host),scope={project:projectId??null,visit:visitId??null};
  const query=useQuery({queryKey:calendarVisitsQueryKey(queryHost,scope),
    queryFn:calendarVisitsReadFunction(client,queryHost,scope,initial?.ownerId??null,initial?.read),
    staleTime:30000,refetchInterval:60000,retry:false});
  const denied=query.error instanceof ApiError&&[401,403].includes(query.error.status);
  return {...query,data:denied?undefined:query.data,denied};
}
