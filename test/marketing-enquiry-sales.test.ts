// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getBrowserMarketingAttribution } from '../apps/marketing/lib/attribution';
import { normalizeMarketingAttributionInput } from '../apps/portal/lib/marketingAttribution/server';
vi.mock('../apps/portal/lib/supabaseClient',()=>({supabaseServiceRole:{}}));
import { installMarketingSalesDb,salesSql,salesEvidenceMigration,salesId as id } from './fixtures/marketing-sales-db';
import { hubSchema } from '../apps/portal/lib/marketingPerformance/hub';
import { designerReportSchema } from '../apps/portal/lib/marketingPerformance/designerContract';
import { designerSales } from '../apps/portal/lib/marketingPerformance/designerSales';
import { summarize } from '../apps/portal/lib/marketingPerformance/contract';
const nativePort=process.env.MARKETING_SALES_NATIVE_PORT;
if(nativePort&&!/^\d{4,5}$/.test(nativePort))throw Error('Invalid disposable PostgreSQL port');
const native=nativePort?postgres({host:'127.0.0.1',port:Number(nativePort),user:'postgres',database:'postgres',ssl:false,max:1,prepare:false}):null;
const db=native?{exec:(sql:string)=>native.unsafe(sql),query:async(sql:string,args?:unknown[])=>({rows:[...await native.unsafe(sql,args as never[])]}),close:()=>native.end()} as unknown as PGlite:new PGlite();
const hub=async()=>hubSchema.parse((await db.query<{v:unknown}>("select marketing_sales_hub_read('2026-09-01','2026-09-30') v")).rows[0].v);
const catalog=async()=>(await db.query<{name:string;metadata:unknown}>(`select n.nspname||'.'||p.proname name,to_jsonb(p)-'prosrc' metadata from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('marketing_observed_source','marketing_performance_read','marketing_sales_hub_read','marketing_commercial_performance_read','marketing_designer_performance_read','sanctuary_campaign_outcomes','sanctuary_campaign_outcomes_without_intake','advertising_scope_facts','marketing_conversion_delivery_claim') order by name`)).rows;
let authority:Awaited<ReturnType<typeof catalog>>;
beforeAll(async()=>{await installMarketingSalesDb(db);authority=await catalog();await db.exec(salesSql(salesEvidenceMigration));},30000);
afterAll(async()=>db.close());
it('joins a consented referral enquiry through accepted quote to signed ledger cash, without double crediting a repeat',async()=>{
 await db.exec(`insert into contacts values('${id(2)}','Synthetic customer','fiction@example.test',null);
 insert into projects(id,name,contact_id) values('${id(1)}','Synthetic enquiry-to-cash','${id(2)}');
 insert into enquiry_requests(id,project_id,created_at,raw_payload,utm) values('${id(10)}','${id(1)}','2026-09-02','{"attribution":{"consent":{"marketing":true},"referrer":"https://www.google.com/"}}','{}'),
 ('${id(11)}','${id(1)}','2026-09-03','{"attribution":{"consent":{"marketing":true},"utm":{"utm_source":"fb"}}}','{}');
 insert into quotes values('${id(20)}','${id(1)}','SYNTHETIC',null);
 insert into quote_versions values('${id(21)}','${id(20)}',1,'ACCEPTED','2026-09-03','2026-09-04','2026-09-05',200000);
 insert into project_payment_entries values('${id(30)}','${id(1)}',null,'PAYMENT','2026-09-06',100000,null),
 ('${id(31)}','${id(1)}',null,'REVERSAL','2026-09-07',-100000,'${id(30)}'),
 ('${id(32)}','${id(1)}',null,'PAYMENT','2026-09-08',60000,null);`);
 const result=await hub();expect(result.enquiries.rows[0]).toMatchObject({source:'Google referral',origin:true,accepted:true,won:true,recordedCash:{amountCents:60000,entryCount:3,complete:true}});
 expect(result.enquiries.rows[1]).toMatchObject({source:'Facebook',recordedSource:'fb',origin:false});
 expect(summarize(result.enquiries.rows)).toMatchObject({enquiries:2,origins:1,recordedCash:60000,cashEntries:3});
 expect(summarize(result.enquiries.rows.filter(row=>row.source==='Facebook'))).toMatchObject({origins:0,recordedCash:0});
 expect((await hub()).enquiries.rows).toEqual(result.enquiries.rows);
});
it('excludes only explicit tests, restores eligibility after audited clearing, and retains ambiguous Tag Assistant referrals',async()=>{
 await db.exec(`insert into enquiry_requests(id,project_id,created_at,raw_payload,utm) values('${id(12)}',null,'2026-09-03','{"attribution":{"consent":{"marketing":true},"utm":{"utm_source":"codex_qa","utm_medium":"qa"}}}','{}'),
 ('${id(13)}',null,'2026-09-03','{"name":"Test-looking real enquiry","attribution":{"consent":{"marketing":true},"referrer":"https://tagassistant.google.com/"}}','{}');
 select project_sales_outcome_record('${id(1)}','${id(81)}',0,'test','Explicit synthetic fixture');`);
 const result=await hub();expect(result.enquiries.excludedTests).toBe(3);expect(result.enquiries.rows.map(row=>row.enquiryId)).toEqual([id(13)]);
 expect(result.projects.find(p=>p.id===id(1))?.knownTest).toBe(true);expect(result.events).toEqual([]);
 expect((await db.query<{v:{rows:unknown[]}}>("select marketing_commercial_performance_read('2026-09-01','2026-09-30') v")).rows[0].v.rows).toEqual([]);
 expect((await db.query('select * from private.advertising_scope_facts()')).rows).toEqual([]);
 await db.exec(`select project_sales_outcome_record('${id(1)}','${id(82)}',1,null,'Restore report eligibility');`);
 expect((await hub()).enquiries.rows).toHaveLength(3);
 expect((await db.query('select * from private.project_sales_outcome_commands')).rows).toHaveLength(2);
});
it('rejects deceptive referrers and respects consent and stronger observed evidence',async()=>{
 for(const [referrer,expected] of [['https://www.google.com/','Google referral'],['https://facebook.com/','Facebook referral'],['https://instagram.com/','Instagram referral'],['https://www.bing.com/','Bing referral'],['https://chatgpt.com/','ChatGPT referral'],['https://www.google.com.evil.test/',null],['https://user@www.google.com/',null],['https://www.google.com:443/',null],['javascript://google.com/',null],['https://www.google.com/?private=value',null]]) {
  const payload={attribution:{consent:{marketing:true},referrer}};
  expect((await db.query<{v:string|null}>('select private.marketing_observed_source($1,$2) v',[payload,{}])).rows[0].v).toBe(expected);
 }
 const value=async(attribution:unknown)=>(await db.query<{v:string|null}>('select private.marketing_observed_source($1,$2) v',[{attribution},{}])).rows[0].v;
 expect(await value({consent:{marketing:false},referrer:'https://google.com/'})).toBeNull();
 expect(await value({consent:{marketing:true},referrer:'https://google.com/',clickIds:{gclid:'synthetic-click'}})).toBe('Google Ads');
 expect(await value({consent:{marketing:true},referrer:'https://google.com/',utm:{utm_source:'newsletter'}})).toBe('newsletter');
});

it('keeps the restricted summary projection usable without exposing raw attribution',async()=>{
 await db.exec(`set role sanctuary_praxis_reader`);
 try {
  expect((await db.query('select * from praxis_reporting.marketing_test_enquiries_v1')).rows).toHaveLength(1);
  expect((await db.query('select * from praxis_reporting.marketing_test_projects_v1')).rows).toEqual([]);
  await expect(db.query('select raw_payload from public.enquiry_requests')).rejects.toThrow(/permission denied/);
 } finally {await db.exec('reset role');}
});
it('retains real receipts on a mixed project and claims queued confirmed-test events as skipped evidence',async()=>{
 await db.exec(`insert into projects(id,name) values('${id(3)}','Mixed synthetic project');
 insert into enquiry_requests(id,project_id,created_at,raw_payload,utm) values('${id(14)}','${id(3)}','2026-09-01','{"attribution":{"verification":true}}','{}'),
 ('${id(15)}','${id(3)}','2026-09-02','{"attribution":{"consent":{"marketing":true},"utm":{"utm_source":"ig"}}}','{}');
 select project_sales_outcome_record('${id(1)}','${id(83)}',2,'test','Queue suppression fixture');
 insert into audit_events values('${id(40)}','marketing.quote_accepted',now(),'{"projectId":"${id(1)}","attribution":{"consent":{"analytics":true}}}'),
 ('${id(41)}','marketing.quote_accepted',now(),'{"projectId":"not-a-uuid"}');
 insert into marketing_conversion_deliveries(id,audit_event_id) values('${id(42)}','${id(40)}'),('${id(43)}','${id(41)}');`);
 const result=await hub();expect(result.enquiries.rows.find(row=>row.enquiryId===id(15))).toMatchObject({origin:true,source:'Instagram',recordedSource:'ig'});
 expect(result.enquiries.rows.some(row=>row.enquiryId===id(14))).toBe(false);
 const claimed=(await db.query<{payload:{verificationTraffic?:boolean}}> ('select * from marketing_conversion_delivery_claim(20,120)')).rows;
 expect(claimed.filter(row=>row.payload.verificationTraffic===true)).toHaveLength(1);
 expect((await db.query("select payload->'verificationTraffic' v from audit_events")).rows.every(row=>row.v===null)).toBe(true);
 await db.exec(`select project_sales_outcome_record('${id(1)}','${id(84)}',3,null,'Restore fixture');`);
});

it('preserves existing RPC authority and denies browser access to classification helpers and projections',async()=>{
 expect(await catalog()).toEqual(authority);
 for(const role of ['anon','authenticated','service_role']){
  await db.exec(`set role ${role}`);
  try {
   await expect(db.query(`select private.marketing_test_project('${id(1)}')`)).rejects.toThrow(/permission denied/);
   await expect(db.query('select * from praxis_reporting.marketing_test_enquiries_v1')).rejects.toThrow(/permission denied/);
  } finally {await db.exec('reset role');}
 }
});
it('keeps accepted scope distinct from cash, and withholds malformed or future ledger evidence',async()=>{
 await db.exec(`insert into projects(id,name) values('${id(4)}','Accepted unpaid fixture');
 insert into enquiry_requests(id,project_id,created_at,raw_payload,utm) values('${id(16)}','${id(4)}','2026-09-02','{}','{}');
 insert into quotes values('${id(22)}','${id(4)}','UNPAID',null);
 insert into quote_versions values('${id(23)}','${id(22)}',1,'ACCEPTED','2026-09-03','2026-09-04','2026-09-05',500000);`);
 expect((await hub()).enquiries.rows.find(row=>row.enquiryId===id(16))).toMatchObject({accepted:true,won:false,recordedCash:{amountCents:0,entryCount:0,complete:true}});
 await db.exec(`update quote_versions set status='DECLINED' where id='${id(23)}'`);
 expect((await hub()).enquiries.rows.find(row=>row.enquiryId===id(16))?.accepted).toBe(false);
 await db.exec(`insert into project_payment_entries values('${id(33)}','${id(4)}',null,'PAYMENT',now()+interval '1 day',10000,null);`);
 expect((await hub()).enquiries.rows.find(row=>row.enquiryId===id(16))?.recordedCash).toMatchObject({amountCents:null,entryCount:1,complete:false});
 await db.exec(`update project_payment_entries set occurred_at='2026-09-03' where id='${id(33)}';insert into project_payment_entries values('${id(34)}','${id(4)}',null,'REVERSAL','2026-09-04',-1000,'${id(33)}');`);
 expect((await hub()).enquiries.rows.find(row=>row.enquiryId===id(16))?.recordedCash).toMatchObject({amountCents:null,entryCount:2,complete:false});
});

it('retains Designer test review evidence while all business consumers exclude confirmed tests',async()=>{
 await db.exec(`update enquiry_requests set raw_payload=jsonb_set(raw_payload,'{attribution,utm}','{"utm_source":"ig","utm_campaign":"synthetic-campaign","utm_content":"synthetic-ad","utm_term":"synthetic-adset"}') where id='${id(15)}';
 insert into quotes values('${id(24)}','${id(3)}','TEST-REVIEW',null);
 insert into quote_versions values('${id(25)}','${id(24)}',1,'ACCEPTED','2026-09-03','2026-09-04','2026-09-05',500000);
 insert into private.sanctuary_meta_operations values('${id(50)}','{"health":true,"scope":{"launchDay":"2026-09-01","campaign":"synthetic-campaign","adset":"synthetic-adset","ads":[{"id":"synthetic-ad"}]}}');`);
 const campaign=async()=>(await db.query<{v:{ads:{enquiries:number;acceptedProjects:number}[]}}> (`select sanctuary_campaign_outcomes('${id(90)}','synthetic','synthetic','synthetic','${id(91)}','test','${id(50)}') v`)).rows[0].v;
 expect((await campaign()).ads[0]).toMatchObject({enquiries:1,acceptedProjects:1});
 await db.exec(`select project_sales_outcome_record('${id(3)}','${id(85)}',0,'test','Synthetic excluded project with retained review');`);
 expect((await campaign()).ads[0]).toMatchObject({enquiries:0,acceptedProjects:0});
 expect((await hub()).enquiries.rows.some(row=>row.projectId===id(3))).toBe(false);
 const commercial=(await db.query<{v:{rows:{projectId:string}[]}}>("select marketing_commercial_performance_read('2026-09-01','2026-09-30') v")).rows[0].v;
 expect(commercial.rows.some(row=>row.projectId===id(3))).toBe(false);
 const designer=designerReportSchema.parse((await db.query<{v:unknown}>("select marketing_designer_performance_read('2026-09-01','2026-09-30') v")).rows[0].v);
 const sales=designerSales(designer);expect(sales.total.tests.find(job=>job.projectId===id(3))?.scopes).toHaveLength(1);
 expect(sales.total.jobs.some(job=>job.projectId===id(3))).toBe(false);
 expect((await db.query<{project_id:string}>('select * from private.advertising_scope_facts()')).rows.some(row=>row.project_id===id(3))).toBe(false);
});


it('keeps storage-denied genuine enquiries through server intake normalization and SQL exclusion checks for every consent combination',async()=>{
 const dom=new JSDOM('',{url:'https://www.sanctuarypergolas.co.nz/contact'});
 vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);
 Object.defineProperty(dom.window,'sessionStorage',{get(){throw Error('Storage unavailable');}});
 try {
  let sequence=300;
  for(const analytics of [false,true])for(const marketing of [false,true])for(const verification of [false,true]) {
   dom.window.history.replaceState(null,'',verification?'/?measurement=verification':'/?measurement=normal');
   const attribution=getBrowserMarketingAttribution({consent:{analytics,marketing},trackingBasis:'user_choice',trackingRegionPolicy:null});
   const normalized=normalizeMarketingAttributionInput(attribution);
   expect(normalized.verification===true).toBe(verification);
   const enquiryId=id(sequence++);
   await db.query('insert into enquiry_requests(id,created_at,raw_payload) values($1,$2,$3)',[enquiryId,'2026-09-25',{attribution:normalized}]);
   const excluded=(await db.query<{v:boolean}>('select private.marketing_test_enquiry($1,null) v',[enquiryId])).rows[0].v;
   expect(excluded).toBe(verification);
   expect((await hub()).enquiries.rows.some(row=>row.enquiryId===enquiryId)).toBe(!verification);
  }
 } finally {vi.unstubAllGlobals();dom.window.close();}
});


it('ignores validated adjustment reversals of either sign while retaining true cash and rejecting broken reversal relationships',async()=>{
 await db.exec(`insert into projects(id,name) values('${id(400)}','Synthetic adjustment reversal'),('${id(401)}','Synthetic other project');
 insert into project_payment_entries values
 ('${id(410)}','${id(400)}',null,'PAYMENT','2026-09-02',100000,null),
 ('${id(411)}','${id(400)}',null,'ADJUSTMENT','2026-09-03',5000,null),
 ('${id(412)}','${id(400)}',null,'REVERSAL','2026-09-04',-5000,'${id(411)}'),
 ('${id(413)}','${id(400)}',null,'ADJUSTMENT','2026-09-05',-3000,null),
 ('${id(414)}','${id(400)}',null,'REVERSAL','2026-09-06',3000,'${id(413)}');`);
 const cash=async()=>(await db.query<{v:unknown}>('select private.marketing_recorded_cash($1) v',[id(400)])).rows[0].v;
 expect(await cash()).toEqual({amountCents:100000,entryCount:1,complete:true});
 await db.exec(`insert into project_payment_entries values('${id(415)}','${id(400)}',null,'REVERSAL','2026-09-07',-100000,'${id(410)}');`);
 expect(await cash()).toEqual({amountCents:0,entryCount:2,complete:true});
 await db.exec(`update project_payment_entries set amount_inc_gst_cents=-4000 where id='${id(412)}'`);
 expect(await cash()).toMatchObject({amountCents:null,complete:false});
 await db.exec(`update project_payment_entries set amount_inc_gst_cents=-5000 where id='${id(412)}';update project_payment_entries set project_id='${id(401)}' where id='${id(411)}'`);
 expect(await cash()).toMatchObject({amountCents:null,complete:false});
 await db.exec(`update project_payment_entries set project_id='${id(400)}' where id='${id(411)}';update project_payment_entries set reverses_entry_id=null where id='${id(412)}'`);
 expect(await cash()).toMatchObject({amountCents:null,complete:false});
 await db.exec(`update project_payment_entries set reverses_entry_id='${id(411)}' where id='${id(412)}'`);
 expect(await cash()).toEqual({amountCents:0,entryCount:2,complete:true});
});
