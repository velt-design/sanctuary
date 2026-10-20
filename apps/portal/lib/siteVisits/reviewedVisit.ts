import type { CalendarVisit } from './contract';
import type { VisitDetails,VisitPerson } from './correctionContract';

export const personKey=(person:VisitPerson)=>person.staffId?`staff:${person.staffId}`:person.email||`name:${person.name.toLowerCase()}`;
export const visitPurposeLabel=(purpose:VisitDetails['purpose'])=>({initial:'Original site visit',measurement:'Return measurement',follow_up:'Follow-up visit',site_visit:'Site visit'}[purpose??'site_visit']);
export const visitStatusLabel=(status:VisitDetails['status'])=>status?({booked:'Booked',provisional:'Provisional',cancelled:'Cancelled',attended:'Attendance recorded',not_attended:'Did not take place'}[status]):null;

// Resolve one effective projection at the API boundary. Outlook remains separately available
// for comparison; neither a past date nor an accepted appointment proves attendance.
export function reviewedVisit(source:CalendarVisit):CalendarVisit {
  const correction=source.correction;
  if(!correction)return source;
  const d=correction.details,kind=source.withdrawn||source.kind==='excluded'?'excluded':source.kindOverride==='review'?'review':d.status==='provisional'?'provisional':d.status==='booked'||d.status==='attended'?'visit':source.kind;
  const visit:CalendarVisit={...source,source:source.origin==='history'?undefined:{...source,correction:null},kind,
    ...(d.staff!==undefined?{staff:d.staff}:{}),...(d.address!==undefined?{address:d.address}:{}),purpose:d.purpose,status:d.status,timing:d.timing,
    cancelled:d.status?d.status==='cancelled'||d.status==='not_attended':source.cancelled,
    reviewReasons:[...correction.questions]};
  if(correction.sourceChanged)visit.reviewReasons.unshift('Outlook changed after this review. Check the source and reconcile these details.');
  if(source.origin!=='history'&&!visit.cancelled&&visit.kind!=='excluded'){
    if(!visit.staff.length)visit.reviewReasons.push('Choose who is attending.');
    if(!visit.address?.trim())visit.reviewReasons.push('Confirm the site address.');
    if(d.timing?.mode==='unknown'&&d.status!=='attended')visit.reviewReasons.push('Arrange a new date and time.');
    if(d.timing?.mode==='date'&&d.status!=='attended'&&d.status!=='not_attended')visit.reviewReasons.push('Confirm the visit time.');
    if(visit.kind==='review')visit.reviewReasons.push('Check whether this appointment is a site visit.');
    if(visit.kind==='provisional')visit.reviewReasons.push('Confirm whether this provisional visit is going ahead.');
    if(visit.duplicate)visit.reviewReasons.push('Check the possible duplicate booking.');
  }
  visit.reviewReasons=[...new Set(visit.reviewReasons)];
  return visit;
}
