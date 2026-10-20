import { PROJECT_OWNER_OPTIONS } from '@/lib/projects/commandCentre/projectOwners';
import type { CalendarVisit } from '@/lib/siteVisits/contract';
import type { VisitDetails,VisitPerson,VisitTiming } from '@/lib/siteVisits/correctionContract';
import { personKey } from '@/lib/siteVisits/reviewedVisit';

export function visitPeople(visit?:CalendarVisit){
  const people=[...(visit?.staff??[]),...(visit?.source?.staff??[])];
  for(const owner of PROJECT_OWNER_OPTIONS)if(!people.some(p=>p.name.toLowerCase()===owner.displayName.toLowerCase()))people.push({name:owner.displayName,email:'',staffId:owner.key});
  return [...new Map(people.map(p=>[personKey(p),p])).values()];
}
export function visitEditorDraft(v?:CalendarVisit){
  return {staff:v?.staff??[] as VisitPerson[],address:v?.address??'',purpose:v?.purpose??(v?'site_visit':'initial') as NonNullable<VisitDetails['purpose']>,
    status:v?.status??(v?.kindOverride==='provisional'?'provisional':v?'source':'attended'),timingMode:v?.timing?.mode??(v?'source':'unknown'),date:v?.timing?.date??'',time:v?.timing?.time??'',endTime:v?.timing?.endTime??'',
    basis:v?.correction?.basis??'',referenceUrl:v?.correction?.referenceUrl??'',questions:v?.correction?.questions.join('\n')??''};
}
export type VisitEditorDraft=ReturnType<typeof visitEditorDraft>;
export function visitEditorDetails(draft:VisitEditorDraft,visit?:CalendarVisit):VisitDetails {
  const source=visit?.origin==='history'?undefined:visit?.source??visit,details:VisitDetails={};
  if(!source||JSON.stringify(draft.staff)!==JSON.stringify(source.staff))details.staff=draft.staff;
  if(!source||draft.address.trim()!==(source.address??''))details.address=draft.address.trim()||null;
  if(!source||draft.purpose!=='site_visit')details.purpose=draft.purpose;
  if(draft.status!=='source')details.status=draft.status as VisitDetails['status'];
  if(draft.timingMode!=='source')details.timing={mode:draft.timingMode as VisitTiming['mode'],
    date:draft.timingMode==='unknown'?null:draft.date||null,time:['agreed','window'].includes(draft.timingMode)?draft.time||null:null,endTime:draft.timingMode==='window'?draft.endTime||null:null};
  return details;
}
