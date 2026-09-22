import type { MarketingRow } from '@/lib/marketingPerformance/contract';
import type { HubProject, HubEvent, HubReport } from '@/lib/marketingPerformance/hub';

// Entirely generated: broad scale and missing-history patterns only. No production
// identifiers, customer details, row-level dates, amounts or source assignments.
const id = (n:number) => `77777777-7777-4777-8777-${String(n).padStart(12,'0')}`;
export const representativeFilters = {start:'2025-09-23',end:'2026-09-22',source:'',campaign:''};
const dates = [10,35,90,170,230,200,145,70,50].flatMap((count,month) =>
  Array.from({length:count},(_,i)=>`2026-${String(month+1).padStart(2,'0')}-${String(month===0?30+i%2:1+i%(month===1?28:month===8?22:28)).padStart(2,'0')}T03:00:00Z`));
const names = ['Courtyard cover','Garden pergola','Poolside shade','Entry canopy','Outdoor dining','Deck shelter'];
const projects:HubProject[] = Array.from({length:1200},(_,i)=>{
  const linked=i>=200, n=i-200;
  const source=linked&&n>=955?(n%2?'google':'meta'):null;
  const stage=i<40||(i>=200&&i<205)?'PAID':(i>=205&&i<215)||i>=1198?'DEPOSIT':i>=215&&i<235?'SCHEDULED':(i>=235&&i<370)||i>=1185?'SENT':i%5?'CONTACTED':'NEW';
  const stateRank=(i*197)%1200;
  const state=stateRank>=850?'ARCHIVED':stateRank>=550?'CLOSED':stateRank===549?'WAITING':'ACTIVE';
  return {id:id(i+1),name:`Demo ${names[i%names.length]} ${String(i+1).padStart(4,'0')}`,
    createdAt:linked?dates[n]:`2025-${String(1+i%9).padStart(2,'0')}-15T03:00:00Z`,stage,
    state,
    owner:['jordan','ellen','dave',null][i%4],closedOutcome:state==='CLOSED'?'LOST_NO_RESPONSE':null,
    originId:linked?id(2001+n):null,originAt:linked?dates[n]:null,source,
    campaign:source?(source==='google'?'Demo search campaign':'Demo outdoor living'):null,
    receiptCount:linked?(n<2?2:1):0,paymentVerified:(i>=204&&i<215)||i>=1198,
    knownTest:false,testCandidate:linked&&n%23===0};
});
const origins:MarketingRow[]=projects.slice(200).map((p,n)=>({enquiryId:p.originId!,receivedAt:p.originAt!,projectId:p.id,projectName:p.name,origin:true,
  source:p.source,campaign:p.campaign,qualification:n>=987?'unreviewed':'unavailable',visit:false,
  quote:n<70||n>=985,accepted:n<20||n>=995,won:p.paymentVerified,closedOutcome:p.closedOutcome}));
const rows:MarketingRow[]=[...origins,
  ...origins.slice(0,2).map((r,n)=>({...r,enquiryId:id(4001+n),receivedAt:'2026-08-15T03:00:00Z',origin:false})),
  ...Array.from({length:50},(_,n)=>({...origins[n],enquiryId:id(4101+n),projectId:null,projectName:null,origin:false,quote:false,accepted:false,won:false,closedOutcome:null})),
].sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)||a.enquiryId.localeCompare(b.enquiryId));
const events:HubEvent[]=[];
const quoted=projects.filter(p=>origins.some(r=>r.projectId===p.id&&r.quote));
const accepted=projects.filter(p=>origins.some(r=>r.projectId===p.id&&r.accepted));
const paid=projects.filter(p=>p.paymentVerified);
const eventDay=(p:HubProject,offset:number)=>new Date(Math.min(Date.parse(p.createdAt)+offset*86400000,Date.parse('2026-09-22T03:00:00Z'))).toISOString().slice(0,10);
for(let n=0;n<280;n++){
  const p=quoted[n%85];
  events.push({id:`demo-sent-${n}`,projectId:p.id,kind:'quote_sent',day:eventDay(p,3+Math.floor(n/85)*7),status:n<195?'SUPERSEDED':accepted.includes(p)?'ACCEPTED':'SENT',amountCents:null});
}
for(let n=0;n<60;n++){
  const p=accepted[n%25];
  events.push({id:`demo-accepted-${n}`,projectId:p.id,kind:'quote_accepted',day:eventDay(p,30+Math.floor(n/25)*7),status:n<35?'SUPERSEDED':'ACCEPTED',amountCents:null});
}
for(let n=0;n<24;n++){
  const p=paid[n%13];
  events.push({id:`demo-payment-${n}`,projectId:p.id,kind:'payment',day:eventDay(p,50+Math.floor(n/13)*14),status:'PAYMENT',amountCents:250000+(n%6)*125000});
  if(n<20) events.push({id:`demo-invoice-${n}`,projectId:p.id,kind:'invoice_paid',day:eventDay(p,50+Math.floor(n/13)*14),status:'PAID',amountCents:null});
}
// A fully reversed payment on a legacy project must not become a verified win.
events.push({id:'demo-refund-payment',projectId:projects[0].id,kind:'payment',day:'2026-09-10',status:'REVERSED',amountCents:150000},
  {id:'demo-refund-reversal',projectId:projects[0].id,kind:'reversal',day:'2026-09-12',status:'REVERSAL',amountCents:-150000});
export const representativeFixture:HubReport={schemaVersion:1,asOf:'2026-09-22T03:00:00Z',...representativeFilters,
  enquiries:{schemaVersion:1,asOf:'2026-09-22T03:00:00Z',start:representativeFilters.start,end:representativeFilters.end,
    timezone:'Pacific/Auckland',visitHistoryAvailable:false,excludedTests:0,rows},
  projects,events,earliestReceipt:'2026-01-30T03:00:00Z',candidateEnquiryIds:origins.filter((_,n)=>n%23===0).map(r=>r.enquiryId)};
