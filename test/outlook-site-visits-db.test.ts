// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,beforeEach,describe,it,expect } from 'vitest';
import { reviewedVisit } from '../apps/portal/lib/siteVisits/reviewedVisit';
import { requiresVisitReview,visibleVisits } from '../apps/portal/lib/siteVisits/calendarModel';
const db=new PGlite();const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const staff=id(1),contact=id(2),project=id(3),other=id(4),binding='a'.repeat(64);let seq=10;
const operation=()=>id(++seq);
const now=Date.now();const from=new Date(now-86400000).toISOString(),to=new Date(now+7*86400000).toISOString();
const event=(key='one',extra:Record<string,unknown>={})=>({sourceKey:key,sourceId:key,subject:'Site visit - Synthetic customer',startsAt:new Date(now+3600000).toISOString(),endsAt:new Date(now+5400000).toISOString(),
 sourceUrl:'https://outlook.office.com/calendar/item/synthetic',address:'12 Example Road, Auckland',staff:[{name:'Example Rep',email:'rep@example.invalid'}],assignmentHint:null,kind:'visit',
 customerEmails:['customer@example.invalid'],cancelled:false,duplicate:false,reviewReasons:[],...extra});
async function rpc(name:string,args:unknown[]=[],role='authenticated',actor=staff):Promise<any>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[actor,role]);await db.exec(`set role ${role}`);
 try{return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args.map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))).rows[0].value;}
 finally{await db.exec('reset role');}
}
const sync=(action:string,op:string,input:unknown={},bound=binding)=>rpc('outlook_calendar_sync',[action,bound,op,input],'service_role');
async function publish(events:unknown[],extra:Record<string,unknown>={}){await db.exec('update private.outlook_calendar_control set last_attempt=null,lease_until=null');const op=operation();expect((await sync('claim',op)).claimed).toBe(true);return sync('publish',op,{from,to,events,hiddenKeys:[],sourceCount:events.length,...extra});}
const read=()=>rpc('outlook_site_visits_read',[null]);
beforeAll(async()=>{await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now(),deleted_at timestamptz,banned_until timestamptz);
 create table public.portal_users(user_id uuid primary key references auth.users,role text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
 create table public.contacts(id uuid primary key,name text,email text,phone text);
 create table public.projects(id uuid primary key,name text,contact_id uuid references public.contacts,site_address text,archived_at timestamptz);
 grant usage on schema public,auth to authenticated,anon,service_role;
 insert into auth.users(id) values('${staff}');insert into public.portal_users values('${staff}','staff');
 insert into public.contacts values('${contact}','Synthetic customer','customer@example.invalid','000000000');
 insert into public.projects values('${project}','Synthetic project','${contact}','12 Example Rd, Auckland',null);`);
 await db.exec(readFileSync('supabase/migrations/20261020010001_outlook_site_visits.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261020010002_outlook_site_visits_address_match.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261020010003_outlook_site_visits_all_day.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261020010004_site_visit_corrections.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261020010005_site_visit_staff_identity.sql','utf8'));},30000);
afterAll(()=>db.close());
beforeEach(async()=>{await db.exec(`truncate private.site_visit_staff_identities,private.site_visit_detail_history,private.site_visit_details,private.outlook_calendar_reviews,private.outlook_calendar_visits;delete from public.projects where id<>'${project}';
 update public.projects set archived_at=null,site_address='12 Example Rd, Auckland';update auth.users set email_confirmed_at=now(),deleted_at=null,banned_until=null;update public.portal_users set role='staff';
 update private.outlook_calendar_control set enabled=true,binding='${binding}',lease_token=null,lease_until=null,last_attempt=null,last_success=null,last_error=null,range_start=null,range_end=null;`);});
describe('Outlook calendar durable mirror',()=>{
 it('projects all-day date ranges, retains them through review and updates the same source back to timed',async()=>{
   await publish([event()]);expect((await read()).events[0]).toMatchObject({isAllDay:false,allDayStartDate:null,allDayEndDate:null});
   const date=new Date(now).toISOString().slice(0,10),end=new Date(now+2*86400000).toISOString().slice(0,10);
   const allDay={isAllDay:true,allDayStartDate:date,allDayEndDate:end,kind:'provisional',cancelled:true,duplicate:true};
   await publish([event('one',allDay)]);const v=(await read()).events[0];expect(v).toMatchObject(allDay);
   const reviewed=await rpc('outlook_site_visit_review',[{id:v.id,revision:v.revision,projectId:null,linkMode:'manual',kind:'excluded'}]);
   expect(reviewed).toMatchObject({...allDay,kind:'excluded'});
   await publish([event('one',{isAllDay:false,allDayStartDate:null,allDayEndDate:null})]);const timed=(await read()).events[0];
   expect(timed).toMatchObject({id:v.id,isAllDay:false,allDayStartDate:null,allDayEndDate:null,kind:'excluded',linkMode:'manual',projectId:null});
 });
 it('atomically imports, links corroborated address/email, and retains unmatched visits',async()=>{
   await publish([event(),event('unlinked',{customerEmails:['unmatched@example.invalid']})]);const snap=await read();
   expect(snap.events).toHaveLength(2);expect(snap.events.find((e:any)=>e.sourceKey==='one')).toMatchObject({projectId:project,phone:'000000000',kind:'visit'});
   expect(snap.events.find((e:any)=>e.sourceKey==='unlinked').projectId).toBeNull();expect(snap.lastSuccess).toBeTruthy();
   expect((await rpc('outlook_site_visits_read',[project])).events).toHaveLength(1);
 });
 it('is idempotent and applies cancellation/rescheduling to the same identity',async()=>{
   await publish([event()]);const first=(await read()).events[0];await publish([event()]);expect((await read()).events[0].revision).toBe(first.revision);
   await publish([event('one',{startsAt:new Date(now+7200000).toISOString(),endsAt:new Date(now+9000000).toISOString(),cancelled:true})]);
   const changed=(await read()).events[0];expect(changed.id).toBe(first.id);expect(changed.revision).toBe(first.revision+1);expect(changed.cancelled).toBe(true);
 });
 it('does not guess among multiple projects or match email alone',async()=>{
   await db.exec(`insert into public.projects values('${other}','Second synthetic project','${contact}','12 Example Road',null)`);
   await publish([event(),event('wrong-address',{address:'999 Different Street'})]);expect((await read()).events.every((e:any)=>e.projectId===null)).toBe(true);
 });
 it('preserves unit numbers and street words when corroborating an exact email',async()=>{
   for (const [stored,incoming] of [['1/23 Example Road','12/3 Example Road'],['12 St. James Road','12 St. Heliers Road'],['1-23 Example Road','123 Example Road']]) {
     await db.query('update public.projects set site_address=$1',[stored]);
     await publish([event('one',{address:incoming})]);expect((await read()).events[0].projectId).toBeNull();
   }
   await db.query('update public.projects set site_address=$1',['12 St. James Rd, Auckland']);
   await publish([event('one',{address:' 12 St James Road, Auckland '})]);expect((await read()).events[0].projectId).toBe(project);
 });
 it('requires a street/unit number, never corroborating only a suburb or provisional label',async()=>{
   for (const address of ['Example Bay','TBC Auckland']) {
     await db.query('update public.projects set site_address=$1',[address]);
     await publish([event('one',{address})]);expect((await read()).events[0].projectId).toBeNull();
   }
   await db.query('update public.projects set site_address=$1',['1/23 Samplemead, Example Bay']);
   await publish([event('one',{address:'1/23 Samplemead, Example Bay'})]);expect((await read()).events[0].projectId).toBe(project);
 });
 it('retains last success and all rows after source failure; reconciles absence only on successful publication',async()=>{
   await publish([event()]);const first=await read();await db.exec('update private.outlook_calendar_control set last_attempt=null');const op=operation();await sync('claim',op);await sync('fail',op,{code:'SOURCE_UNAVAILABLE'});
   const failed=await read();expect(failed.lastSuccess).toBe(first.lastSuccess);expect(failed.events[0].removed).toBe(false);expect(failed.error).toBe('SOURCE_UNAVAILABLE');
   await publish([]);expect((await read()).events[0].removed).toBe(true);await publish([event()]);expect((await read()).events[0].removed).toBe(false);
 });
 it('fences overlapping/stale runs and enforces shared manual refresh cooldown',async()=>{
   const a=operation(),b=operation();await sync('claim',a);expect(await sync('claim',b)).toEqual({claimed:false,reason:'busy'});
   await expect(sync('publish',b,{from,to,events:[],hiddenKeys:[]})).rejects.toMatchObject({code:'40001'});
   await sync('fail',a);expect(await sync('claim',b)).toEqual({claimed:false,reason:'recent'});
 });
 it('rejects a malformed later event without publishing earlier rows or success',async()=>{
   await publish([event()]);const first=await read();await expect(publish([event('new'),event('bad',{endsAt:from})])).rejects.toThrow();
   const after=await read();expect(after.events.map((e:any)=>e.sourceKey)).toEqual(['one']);expect(after.lastSuccess).toBe(first.lastSuccess);
 });
 it('preserves explicit local review/linking across sync, rejects stale review, and allows auto-link recovery',async()=>{
   await publish([event('one',{kind:'review',reviewReasons:['Check whether this appointment is a site visit.'],duplicate:true})]);const v=(await read()).events[0];
   const updated=await rpc('outlook_site_visit_review',[{id:v.id,revision:v.revision,projectId:null,linkMode:'manual',kind:'visit'}]);
   expect(updated).toMatchObject({kind:'visit',duplicate:false,projectId:null,linkMode:'manual',reviewReasons:[]});
   await expect(rpc('outlook_site_visit_review',[{id:v.id,revision:v.revision,projectId:project,linkMode:'manual',kind:null}])).rejects.toMatchObject({code:'40001'});
   await publish([event()]);const next=(await read()).events[0];expect(next.projectId).toBeNull();expect(next.kindOverride).toBe('visit');
   const auto=await rpc('outlook_site_visit_review',[{id:next.id,revision:next.revision,projectId:null,linkMode:'auto',kind:null}]);expect(auto.projectId).toBe(project);
 });
 it('withholds a formerly visible appointment when Outlook sensitivity becomes private',async()=>{
   await publish([event()]);await publish([],{hiddenKeys:['one']});expect((await read()).events).toEqual([]);
 });
 it('denies direct tables, anonymous RPC, role loss, banned identity and wrong source binding',async()=>{
   await expect(rpc('outlook_site_visits_read',[null],'anon')).rejects.toMatchObject({code:'42501'});
   await expect(sync('claim',operation(),{},'b'.repeat(64))).rejects.toMatchObject({code:'42501'});
   await db.exec('set role authenticated');await expect(db.exec('select * from private.outlook_calendar_visits')).rejects.toMatchObject({code:'42501'});await db.exec('reset role');
   await db.exec("update public.portal_users set role='other'");await expect(read()).rejects.toMatchObject({code:'42501'});
   await db.exec("update public.portal_users set role='staff';update auth.users set banned_until=now()+interval '1 day'");await expect(read()).rejects.toMatchObject({code:'42501'});
 });
});

const correction=(v:any,extra:Record<string,unknown>={})=>({action:'save',id:v.id,revision:v.revision,projectId:project,linkMode:'manual',kind:'visit',details:{staff:[{name:'Known owner',email:'',staffId:'known-owner'}],address:'14 Verified Road, Auckland'},questions:[],basis:'Verified in a staff statement and linked project.',referenceUrl:null,...extra});
describe('Portal reviewed details and historical attendance',()=>{
 it('resolves verified imported and manual staff identities without name guessing or source rewrites',async()=>{
  const email='original-rep@example.invalid',sourcePerson={name:'Jordan Synthetic Fullname',email},manual={name:'Jordan',email:'',staffId:'jordan'};
  await db.query('insert into private.site_visit_staff_identities values($1,$2,$3),($4,$5,$6)',[binding,email,'jordan','b'.repeat(64),'unrelated@example.invalid','jordan']);
  const equal=async(a:unknown[],b:unknown[])=>(await db.query('select private.site_visit_people_equal($1::jsonb,$2::jsonb) ok',[JSON.stringify(a),JSON.stringify(b)])).rows[0].ok;
  expect(await equal([manual],[sourcePerson])).toBe(true);
  expect(await equal([manual],[{name:'Jordan',email:'customer@example.invalid'}])).toBe(false);
  expect(await equal([manual],[{name:'Jordan',email:'unrelated@example.invalid'}])).toBe(false);
  expect(await equal([sourcePerson],[{...sourcePerson,name:'Updated display label'}])).toBe(true);
  expect(await equal([manual,sourcePerson],[sourcePerson])).toBe(true);
  await publish([event('one',{staff:[],address:null})]);const before=(await read()).events[0];
  await rpc('site_visit_correct',[correction(before,{details:{staff:[manual],address:'14 Verified Road, Auckland'}})]);
  const caughtUp=event('one',{staff:[sourcePerson],address:'14 Verified Road, Auckland'});await publish([caughtUp]);
  const current=(await read()).events[0];expect(current.staff).toEqual([{...sourcePerson,staffId:'jordan'}]);expect(current.correction.sourceChanged).toBe(false);
  expect((await db.query('select payload from private.outlook_calendar_visits')).rows[0].payload).toEqual(caughtUp);
  await publish([event('one',{staff:[{name:'Different rep',email:'different@example.invalid'}],address:'14 Verified Road, Auckland'})]);expect((await read()).events[0].correction.sourceChanged).toBe(true);
  for(const role of ['authenticated','service_role']){await db.exec(`set role ${role}`);await expect(db.exec('select * from private.site_visit_staff_identities')).rejects.toMatchObject({code:'42501'});await db.exec('reset role');}
 });
 it('retains a correction through imports and restores source without editing the source payload',async()=>{
  await publish([event('one',{staff:[],address:null,reviewReasons:['Check Outlook for address.']})]);const v=(await read()).events[0];
  const original=(await db.query('select payload from private.outlook_calendar_visits')).rows[0].payload;
  const saved=reviewedVisit(await rpc('site_visit_correct',[correction(v)]));
  expect(saved.staff[0].name).toBe('Known owner');expect(saved.address).toBe('14 Verified Road, Auckland');expect(requiresVisitReview(saved)).toBe(false);
  await publish([event('one',{staff:[],address:null,reviewReasons:['Check Outlook for address.']})]);const current=(await read()).events[0];
  expect(current.correction.sourceChanged).toBe(false);expect((await db.query('select payload from private.outlook_calendar_visits')).rows[0].payload).toEqual(original);
  await expect(rpc('site_visit_correct',[correction(v)])).rejects.toMatchObject({code:'40001'});
  const restored=await rpc('site_visit_correct',[correction(current,{action:'restore'})]);expect(restored.correction).toBeNull();expect(restored.staff).toEqual([]);
  expect((await db.query('select count(*)::int n from private.site_visit_detail_history')).rows[0].n).toBe(2);
 });
 it('reopens actual conflicts, not metadata changes or Outlook catching up to already verified facts',async()=>{
  await db.query('insert into private.site_visit_staff_identities values($1,$2,$3)',[binding,'owner@example.invalid','known-owner']);
  await publish([event()]);const v=(await read()).events[0];await rpc('site_visit_correct',[correction(v)]);
  await publish([event('one',{sourceUrl:'https://outlook.office.com/calendar/item/new-link',subject:'Site Visit - title spelling fixed'})]);expect((await read()).events[0].correction.sourceChanged).toBe(false);
  await publish([event('one',{staff:[{name:'Known owner',email:'owner@example.invalid'}],address:'14 Verified Road, Auckland'})]);expect((await read()).events[0].correction.sourceChanged).toBe(false);
  await publish([event('one',{address:'99 Conflicting Road'})]);const conflict=reviewedVisit((await read()).events[0]);expect(conflict.correction?.sourceChanged).toBe(true);expect(requiresVisitReview(conflict)).toBe(true);
  const reconciled=await rpc('site_visit_correct',[correction(conflict)]);expect(reconciled.correction.sourceChanged).toBe(false);
  await publish([event('one',{address:'99 Conflicting Road',cancelled:true})]);expect((await read()).events[0].correction.sourceChanged).toBe(true);
 });
 it('keeps unknown historical attendance separate from the later source booking on a closed project',async()=>{
  await publish([event()]);await db.exec('update public.projects set archived_at=now()');
  const input={action:'save',id:id(999),revision:0,projectId:project,details:{staff:[{name:'Original rep',email:'',staffId:'original-rep'}],purpose:'initial',status:'attended',timing:{mode:'unknown',date:null,time:null,endTime:null}},questions:[],basis:'Original attendee confirmed the visit; exact date is unknown.',referenceUrl:null};
  const first=await rpc('site_visit_history_save',[input]);const repeated=await rpc('site_visit_history_save',[input]);expect(repeated.id).toBe(first.id);expect(repeated.revision).toBe(1);
  // A timed-out create may commit after an absence read. Retrying its held ID
  // with a newer draft cannot overwrite that committed original or duplicate it.
  await expect(rpc('site_visit_history_save',[{...input,basis:'A different retained draft after uncertain completion.'}])).rejects.toMatchObject({code:'40001'});
  expect((await db.query(`select count(*)::int n from private.site_visit_details where id='${input.id}'`)).rows[0].n).toBe(1);
  const history=reviewedVisit(first);expect(history.startsAt).toBeNull();expect(requiresVisitReview(history)).toBe(false);expect(visibleVisits([history],'today','','')).toEqual([]);
  await publish([]);const both=(await rpc('outlook_site_visits_read',[project])).events;expect(both).toHaveLength(2);expect(both.find((e:any)=>e.origin==='history').staff).toEqual([]);
  expect((await db.query('select archived_at from public.projects')).rows[0].archived_at).not.toBeNull();
  const withdrawn=reviewedVisit(await rpc('site_visit_history_save',[{...input,revision:1,action:'withdraw'}]));expect(withdrawn.withdrawn).toBe(true);expect(withdrawn.kind).toBe('excluded');
  await expect(rpc('site_visit_history_save',[{...input,revision:1,action:'restore'}])).rejects.toMatchObject({code:'40001'});
  const restored=await rpc('site_visit_history_save',[{...input,revision:2,action:'restore'}]);expect(restored.withdrawn).toBe(false);expect(restored.revision).toBe(3);
  expect((await db.query('select count(*)::int n from private.site_visit_detail_history')).rows[0].n).toBe(3);
 });
 it('keeps reviewed project history outside the rolling source window and retains specific unresolved questions',async()=>{
  await publish([event()]);const v=(await read()).events[0];
  const saved=reviewedVisit(await rpc('site_visit_correct',[correction(v,{details:{status:'cancelled'},questions:['Agree a replacement booking and address.']})]));
  expect(saved.cancelled).toBe(true);expect(requiresVisitReview(saved)).toBe(true);expect(visibleVisits([saved],'today','','')).toEqual([]);
  await db.exec(`update private.outlook_calendar_control set range_start=now()+interval '30 days',range_end=now()+interval '60 days'`);
  expect((await rpc('outlook_site_visits_read',[project])).events).toHaveLength(1);
 });
 it('validates timing and enforces staff identity and private storage boundaries',async()=>{
  await publish([event()]);const v=(await read()).events[0];
  await expect(rpc('site_visit_correct',[correction(v,{details:{timing:{mode:'window',date:'2026-10-20',time:'10:30',endTime:'09:00'}}})])).rejects.toMatchObject({code:'22023'});
  expect((await read()).events[0].revision).toBe(v.revision);
  await expect(rpc('site_visit_correct',[correction(v)],'anon')).rejects.toMatchObject({code:'42501'});
  await db.exec('set role authenticated');await expect(db.exec('select * from private.site_visit_details')).rejects.toMatchObject({code:'42501'});await db.exec('reset role');
  await db.exec("update public.portal_users set role='other'");await expect(rpc('site_visit_correct',[correction(v)])).rejects.toMatchObject({code:'42501'});
 });
});
