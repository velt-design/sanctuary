'use client';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import VisitDetailsEditor from './VisitDetailsEditor';
export default function VisitReview({visit,onDone}:{visit:CalendarVisit;onDone:()=>void}){
  return <VisitDetailsEditor visit={visit} projectId={visit.projectId??undefined} onDone={onDone} />;
}
