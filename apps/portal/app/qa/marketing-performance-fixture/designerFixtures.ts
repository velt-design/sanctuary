import type { DesignerLoader } from '@/components/marketingPerformance/useDesigner';
import type { DesignerReport,DesignerVisit,DesignerScope } from '@/lib/marketingPerformance/designerContract';
import { hubFixture } from './hubFixtures';
const id=(n:number)=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`;
export function designerFixture(mode='complete'):DesignerReport {
  const project=(n:number)=>hubFixture.projects[n%hubFixture.projects.length].id;
  const visit=(n:number,extra:Partial<DesignerVisit>={}):DesignerVisit=>({id:id(n),projectId:project(n),contactId:id(n+100),origin:'outlook',day:'2026-09-04',at:'2026-09-04T00:00:00Z',purpose:'initial',status:'attended',kind:'visit',staff:['jordan'],unmappedStaff:0,removed:false,withdrawn:false,cancelled:false,duplicate:false,changed:false,questions:0,...extra});
  const visits=[visit(1,{staff:['jordan','jp']}),visit(2,{staff:['jp']}),visit(3,{staff:['joe'],purpose:'measurement'}),visit(4,{staff:['joe'],purpose:null,status:null}),visit(5,{staff:['bruce'],purpose:'site_visit',status:'booked'}),visit(6,{staff:['bruce'],origin:'history',day:null,at:null}),visit(7,{projectId:project(1),purpose:'measurement',day:'2026-09-20',at:'2026-09-20T00:00:00Z'})];
  const scope=(n:number,extra:Partial<DesignerScope>={}):DesignerScope=>({id:id(n+200),projectId:project(n),reference:`DEMO-SCOPE-${n}`,addOn:false,firstSentAt:'2026-09-07T00:00:00Z',undatedSend:false,accepted:true,acceptedAt:'2026-09-11T00:00:00Z',valueCents:1850000,paymentEvidence:true,paidAt:'2026-09-13T00:00:00Z',...extra});
  const scopes=[scope(1),scope(2,{accepted:false,acceptedAt:null,paidAt:null,valueCents:null,paymentEvidence:false}),scope(3),scope(9,{projectId:project(1),addOn:true,valueCents:250000})];
  if(mode==='incomplete'){for(const v of visits)if(v.purpose==='initial'&&v.day)v.purpose='site_visit';}
  if(mode==='conflict')visits.push(visit(10,{projectId:project(1),staff:['joe']}));
  return {schemaVersion:1,asOf:'2026-09-22T08:00:00Z',start:'2026-09-01',end:'2026-09-22',
    source:{enabled:mode!=='disabled',lastSuccess:mode==='stale'?'2026-09-21T00:00:00Z':'2026-09-22T07:50:00Z',failed:mode==='source-failed',rangeStart:'2026-08-23T00:00:00Z',rangeEnd:'2026-12-21T00:00:00Z',firstImportedAt:'2026-09-21T00:00:00Z'},
    visits:mode==='empty'?[]:mode==='disabled'?visits.filter(v=>v.origin==='history'):visits,scopes:mode==='empty'?[]:scopes};
}
export const designerLoader:DesignerLoader=async(filters,signal)=>{
  const mode=new URLSearchParams(window.location.search).get('designerScenario')??'complete';
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,mode==='slow'?2500:300);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Aborted'));},{once:true});});
  if(mode==='failure'||mode==='denied')throw new Error(mode==='denied'?'Developer access is required.':'Synthetic read failure. Retry when available.');
  return {...designerFixture(mode),start:filters.start,end:filters.end};
};
