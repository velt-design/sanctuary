'use client';
import { useQuery } from '@tanstack/react-query';
import { apiJson,ApiError } from '@/lib/repo/apiClient';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
export const calendarVisitKey=['outlook-calendar-visits'] as const;
export function useCalendarVisits(projectId?:string,host?:string,visitId?:string){
  const query=useQuery({queryKey:[...calendarVisitKey,host??(typeof window==='undefined'?'server':window.location.host),projectId??null,visitId??null],
    queryFn:({signal})=>apiJson<VisitSnapshot>(`/api/staff/v1/outlook-site-visits?${new URLSearchParams({...projectId?{project:projectId}:{},...visitId?{visit:visitId}:{}})}`,{signal,cache:'no-store'}),
    staleTime:30000,refetchInterval:60000,retry:false});
  const denied=query.error instanceof ApiError&&[401,403].includes(query.error.status);
  return {...query,data:denied?undefined:query.data,denied};
}
