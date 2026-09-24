// @vitest-environment node
import { expect, it } from 'vitest';
import { initialCompletedQuery, validateCompletedQuery, type AnalyticsReport } from './report';
import { websiteJourney } from './journey';
import { businessOutcomes } from './outcomes';
import { parseReportResponse } from './response';
const query = { period: { start: '2026-09-17', end: '2026-09-20' }, comparison: { start: '2026-09-13', end: '2026-09-16' } };
it('preserves completed UTC daily dates and the existing 28-day comparison',()=>{
 expect(initialCompletedQuery(new Date('2026-09-23T01:15:00Z'))).toEqual({period:{start:'2026-08-26',end:'2026-09-22'},comparison:{start:'2026-07-29',end:'2026-08-25'}});
 expect(validateCompletedQuery({period:{start:'2026-09-23',end:'2026-09-23'},comparison:null},new Date('2026-09-23T20:00:00Z'))).not.toBeNull();
});
it('preserves missing stages, actual zeros and the pre-release comparison boundary',()=>{
 const journey=websiteJourney([{label:'design_review',value:0,previous:4}],query);
 expect(journey.counts.find(row=>row.label==='design_review')).toEqual({label:'design_review',value:0,previous:null});
 expect(journey.counts.find(row=>row.label==='contact_success')?.value).toBeNull();
 expect(websiteJourney([{label:'design_review',value:0,previous:4}],{period:{start:'2026-09-21',end:'2026-09-24'},comparison:{start:'2026-09-17',end:'2026-09-20'}}).counts.find(row=>row.label==='design_review')?.previous).toBe(4);
});
it('normalizes the existing source aggregate without importing customer records or changing activity definitions',()=>{
 const id='10000000-0000-4000-8000-000000000001',stamp='2026-09-23T00:00:00.000Z';
 const source: Parameters<typeof businessOutcomes>[0]={schemaVersion:'sanctuary.praxis.marketing.v1',requestId:id,
  source:{sourceKey:'synthetic',connectionId:id,environment:'test',authority:'canonical',asOf:stamp,retrievedAt:stamp},
  coverage:'complete_period_activity',timezone:'Pacific/Auckland',query,excludedTestRecords:1,exclusion:'labelled_measurement_test_20260916',
  counts:(['Enquiries received','Quotes created','Quotes sent','Quotes accepted'] as const).map(label=>({label,value:1152,previous:1000}))};
 const business=businessOutcomes(source);expect(business.counts).toEqual(source.counts);expect(business.warnings.join(' ')).toContain('not the same group');
 expect(business).not.toHaveProperty('requestId');expect(business).not.toHaveProperty('source.connectionId');
 const report:AnalyticsReport={source:'ga4',property:'123',timezone:'Pacific/Auckland',fetchedAt:stamp,query,traffic:[],channels:[],landing:[],events:[],sessions:null,previousSessions:null,warnings:[],journey:websiteJourney([],query),business:{status:'available',binding:'a'.repeat(64),operations:[id],report:business}};
 expect(parseReportResponse(report,query)).toEqual(report);
 expect(()=>parseReportResponse({...report,business:{...report.business,report:{...business,timezone:'UTC'}}},query)).toThrow();
 expect(()=>parseReportResponse({...report,privateCustomer:'Synthetic hidden record'},query)).toThrow();
});
