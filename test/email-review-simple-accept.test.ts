// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,beforeEach,describe,it,expect } from 'vitest';
const db=new PGlite();
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=id(1),staff=id(2),other=id(3),project=id(4),contact=id(5);
let seq=100,batch:string,item:string;
const command=()=>id(++seq);
const input=()=>({commandId:command(),sourceKey:'synthetic-batch',title:'Synthetic review',reviewerId:staff,items:[{
  sourceId:'one',projectId:project,to:'customer@example.invalid',subject:'Re: Project scope',body:'Hi, is this scope still current?',
  prerequisites:['Review latest conversation'],evidence:[{label:'Message',url:'https://outlook.office.com/mail/example'}],context:'Synthetic only',
  threads:[{messageId:'synthetic-message',webLink:'https://outlook.office.com/mail/example',subject:'Project scope',matchedRecipient:'customer@example.invalid'}],
}]});
async function rpc(name:string,args:unknown[],actor=staff){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);await db.exec('set role authenticated');
 try{return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args.map(x=>x !== null && typeof x==='object'?JSON.stringify(x):x))).rows[0].value as any;}
 finally{await db.exec('reset role');}}
const read=()=>rpc('email_review_read',[batch,item]);
const change=(action:string,revision:number,extra:Record<string,unknown>={},actor=staff)=>rpc('email_review_command',[batch,item,{commandId:command(),expectedRevision:revision,action,...extra}],actor);
async function selectThread(){return change('save',1,{threadMessageId:'synthetic-message'});}
beforeAll(async()=>{await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb default '{}');
 create table public.portal_users(user_id uuid primary key references auth.users,role text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.contacts(id uuid primary key,name text,email text);
 create table public.projects(id uuid primary key,name text,contact_id uuid references public.contacts,pipeline_stage text,archived_at timestamptz);
 create table public.project_operational_states(project_id uuid primary key references public.projects,state text,row_version bigint);
 grant usage on schema public,auth to authenticated,anon,service_role;
 insert into auth.users(id,email) values('${admin}','admin@example.invalid'),('${staff}','reviewer@example.invalid'),('${other}','other@example.invalid');
 insert into public.portal_users values('${admin}','admin'),('${staff}','staff'),('${other}','staff');
 insert into public.contacts values('${contact}','Synthetic customer','customer@example.invalid');
 insert into public.projects values('${project}','Synthetic project','${contact}','CONTACTED',null);
 insert into public.project_operational_states values('${project}','ACTIVE',1);`);
 await db.exec(readFileSync('supabase/migrations/20260923010001_email_review_queue.sql','utf8'));await db.exec(readFileSync('supabase/migrations/20260923010002_email_review_dispatch.sql','utf8'));await db.exec(readFileSync('supabase/migrations/20260923020001_email_review_simple_accept.sql','utf8'));},30000);
afterAll(()=>db.close());
beforeEach(async()=>{await db.exec(`update auth.users set email_confirmed_at=now(),deleted_at=null,banned_until=null; truncate private.email_review_dispatches,private.email_review_receipts,private.email_review_events,private.email_review_items,private.email_review_batches;
 update public.contacts set email='customer@example.invalid';update public.projects set archived_at=null,pipeline_stage='CONTACTED';
 update public.project_operational_states set state='ACTIVE',row_version=1;update public.portal_users set role=case when user_id='${admin}' then 'admin' else 'staff' end;`);
 const result=await rpc('email_review_import',[input()],admin);batch=result.batchId;
 item=(await rpc('email_review_read',[batch,null,1,50,'all',''])).items[0].id;});

async function accept(extra:Record<string,unknown>={}){const current=(await read()).item;return change('accept',current.revision,{to:current.to,subject:current.subject,body:current.body,expectedContextHash:current.currentContextHash,...extra});}
const dispatch=(action:string,extra:Record<string,unknown>={})=>rpc('email_review_dispatch',[batch,action,{...(action==='read'||action==='result'?{}:{commandId:command()}),...extra}],admin);
describe('one-step acceptance and frozen Outlook delivery',()=>{
 it('accepts edited content atomically in a single revision without checkboxes or prior save',async()=>{const r=await accept({body:'Reviewed and edited in one step.'});expect(r.item).toMatchObject({status:'approved',revision:2,body:'Reviewed and edited in one step.',deliveryMode:'reply',threadMessageId:'synthetic-message'});expect(r.item.events).toHaveLength(2);expect(r.item.events.at(-1).action).toBe('accept');expect(r.item.approvalHash).toMatch(/^[a-f0-9]{64}$/);});
 it('accepts a missing conversation as a fresh message and claims its exact approved subject/body',async()=>{await db.exec("update private.email_review_items set threads='[]'");const r=await accept({subject:'Project scope',body:'Fresh approved body'});expect(r.item).toMatchObject({deliveryMode:'new',threadMessageId:null,subject:'Project scope'});await dispatch('prepare');const claim=(await dispatch('claim',{limit:1})).replies[0];expect(claim).toMatchObject({deliveryMode:'new',messageId:null,subject:'Project scope',body:'Fresh approved body',to:'customer@example.invalid'});});
 it('uses fresh delivery for ambiguous conversations or a changed recipient without asking the reviewer to choose',async()=>{await db.exec(`update private.email_review_items set threads=threads||jsonb_build_array(threads->0||'${JSON.stringify({messageId:'second-message'})}'::jsonb)`);expect((await accept({subject:'Project scope'})).item.deliveryMode).toBe('new');await change('unapprove',2);expect((await accept({to:'new@example.invalid'})).item).toMatchObject({to:'new@example.invalid',deliveryMode:'new'});});
 it('preserves an edited subject by switching to fresh delivery, rejects hidden Re-prefix rewriting at acceptance',async()=>{expect((await accept({subject:'A revised question'})).item.deliveryMode).toBe('new');await change('unapprove',2);await expect(accept({subject:'Re: A revised question'})).rejects.toMatchObject({code:'22023'});expect((await read()).item.subject).toBe('A revised question');});
 it('requires the exact displayed current context, then accepts changed context atomically',async()=>{const old=(await read()).item;await db.exec("update public.contacts set name='Updated synthetic contact'");await expect(accept({expectedContextHash:old.currentContextHash})).rejects.toMatchObject({code:'PT409'});const r=await accept();expect(r.item.contextChanged).toBe(false);expect(r.item.savedProjectContext.contactName).toBe('Updated synthetic contact');});
 it.each(["update public.projects set archived_at=now()","update public.projects set pipeline_stage='DEPOSIT'","update public.project_operational_states set state='WAITING'"])('still denies ineligible project acceptance: %s',async sql=>{await db.exec(sql);await expect(accept()).rejects.toMatchObject({code:'PT409'});});
 it('rejects stale revision and safely replays the same accepted command once',async()=>{const c=(await read()).item;const intent={commandId:command(),expectedRevision:1,action:'accept',to:c.to,subject:c.subject,body:'Final edit',expectedContextHash:c.currentContextHash};const first=await rpc('email_review_command',[batch,item,intent]);expect(await rpc('email_review_command',[batch,item,intent])).toEqual(first);expect((await read()).item.events).toHaveLength(2);await expect(rpc('email_review_command',[batch,item,{...intent,commandId:command()}])).rejects.toMatchObject({code:'PT409'});await expect(rpc('email_review_command',[batch,item,{...intent,body:'Changed replay'}])).rejects.toMatchObject({code:'PT409'});});
 it('skips without a note and preserves its saved content',async()=>{const r=await change('skip',1);expect(r.item.status).toBe('skipped');expect(r.item.body).toBe('Hi, is this scope still current?');expect(r.item.events.at(-1).note).toBeNull();});
 it('prepares only accepted messages while leaving pending messages editable',async()=>{const x=input();x.sourceKey='two';x.items.push({...x.items[0],sourceId:'second'});const imported=await rpc('email_review_import',[x],admin);batch=imported.batchId;const rows=(await rpc('email_review_read',[batch])).items;item=rows[0].id;await accept();expect((await dispatch('prepare')).counts.ready).toBe(1);const pending=rows[1].id;expect((await rpc('email_review_read',[batch,pending])).item).toMatchObject({status:'draft',revision:1,dispatchId:null});await expect(change('save',2,{body:'Frozen edit'})).rejects.toMatchObject({code:'PT409'});const result=await rpc('email_review_command',[batch,pending,{commandId:command(),expectedRevision:1,action:'save',body:'Pending revised'}]);expect(result.item.body).toBe('Pending revised');});
 it('never claims twice or retries an uncertain fresh-message attempt',async()=>{await db.exec("update private.email_review_items set threads='[]'");await accept({subject:'Project scope'});await dispatch('prepare');const commandId=command(),first=await dispatch('claim',{commandId,limit:1});expect((await dispatch('claim',{commandId,limit:1})).replies).toEqual([]);const d=first.replies[0];await dispatch('result',{intentId:d.id,attemptId:d.attemptId,outcome:'uncertain',note:'Synthetic unknown response'});expect((await dispatch('claim',{limit:1})).replies).toEqual([]);expect((await dispatch('cancel')).counts.uncertain).toBe(1);});
 it('retains the legacy approval hash shape and default reply mode for legacy approvals',async()=>{await selectThread();await change('approve',2,{prerequisitesConfirmed:true,threadConfirmed:true});const x=(await db.query('select approval_version,approval_hash,private.email_review_approval_content(i) payload from private.email_review_items i')).rows[0] as any;expect(x.approval_version).toBe(1);expect(x.payload).not.toHaveProperty('deliveryMode');await dispatch('prepare');expect((await dispatch('claim',{limit:1})).replies[0].deliveryMode).toBe('reply');});
 it('denies unassigned mutation and raw access to the new resolver',async()=>{const current=(await read()).item;await expect(change('accept',1,{to:current.to,subject:current.subject,body:current.body,expectedContextHash:current.currentContextHash},other)).rejects.toMatchObject({code:'42501'});for(const role of ['anon','authenticated','service_role'])expect((await db.query("select has_function_privilege($1,'private.email_review_delivery(jsonb,text,text)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);});
});
