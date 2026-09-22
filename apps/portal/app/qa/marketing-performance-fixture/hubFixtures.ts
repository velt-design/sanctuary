import type { HubReport, HubProject, HubEvent } from '@/lib/marketingPerformance/hub';
import { fixtureReport, historicalFixtureRows } from './fixtures';

const allRows=[...fixtureReport.rows,...historicalFixtureRows];
const projects:HubProject[]=[...new Map(allRows.filter(r=>r.projectId).map(r=>[r.projectId,{
  id:r.projectId!,name:r.projectName,createdAt:r.receivedAt,stage:r.won?'DEPOSIT':r.quote?'SENT':'NEW',state:r.closedOutcome?'CLOSED':'ACTIVE',
  owner:r.quote?'jordan':'ellen',closedOutcome:r.closedOutcome,originId:r.enquiryId,originAt:r.receivedAt,source:r.source,campaign:r.campaign,
  receiptCount:allRows.filter(x=>x.projectId===r.projectId).length,paymentVerified:r.won,knownTest:false,testCandidate:false,
}])).values()];
// Preserve earliest evidence when a later submission reports another source.
for(const p of projects){const origin=allRows.filter(r=>r.projectId===p.id).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt))[0];p.originId=origin.enquiryId;p.originAt=origin.receivedAt;p.createdAt=origin.receivedAt;p.source=origin.source;p.campaign=origin.campaign;}
const legacy:HubProject={...projects[0],id:'22222222-2222-4222-8222-000000000001',name:'Sample legacy settled project',createdAt:'2024-03-02T00:00:00Z',stage:'PAID',state:'ARCHIVED',originId:null,originAt:null,source:null,campaign:null,receiptCount:0,paymentVerified:false,owner:'dave'};
projects.push(legacy,{...legacy,id:'22222222-2222-4222-8222-000000000002',name:'Sample manual project',state:'ACTIVE',stage:'PAID'},
  {...legacy,id:'10c5db1a-602c-4f0c-8193-855b186215bb',name:'Known QA sample',stage:'NEW',knownTest:true,testCandidate:true});
const events:HubEvent[]=[
  {id:'sent:sample-1',projectId:projects[0].id,kind:'quote_sent',day:'2026-09-03',status:'SUPERSEDED',amountCents:null},
  {id:'sent:sample-2',projectId:projects[0].id,kind:'quote_sent',day:'2026-09-05',status:'ACCEPTED',amountCents:null},
  {id:'accepted:sample-2',projectId:projects[0].id,kind:'quote_accepted',day:'2026-09-08',status:'ACCEPTED',amountCents:null},
  {id:'payment:sample-1',projectId:projects[0].id,kind:'payment',day:'2026-09-09',status:'PAYMENT',amountCents:150000},
  {id:'invoice:sample-1',projectId:projects[0].id,kind:'invoice_paid',day:'2026-09-09',status:'PAID',amountCents:null},
  {id:'payment:legacy',projectId:legacy.id,kind:'payment',day:'2026-09-11',status:'REVERSED',amountCents:30000},
  {id:'reversal:legacy',projectId:legacy.id,kind:'reversal',day:'2026-09-12',status:'REVERSAL',amountCents:-30000},
];
export const hubFixture:HubReport={schemaVersion:1,asOf:fixtureReport.asOf,start:fixtureReport.start,end:fixtureReport.end,enquiries:fixtureReport,
  projects,events,earliestReceipt:'2026-08-01T00:00:00Z',candidateEnquiryIds:[]};
