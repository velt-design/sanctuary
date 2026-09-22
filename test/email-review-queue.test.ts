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
 await db.exec(readFileSync('supabase/migrations/20260923010001_email_review_queue.sql','utf8'));},30000);
afterAll(()=>db.close());
beforeEach(async()=>{await db.exec(`update auth.users set email_confirmed_at=now(),deleted_at=null,banned_until=null; truncate private.email_review_receipts,private.email_review_events,private.email_review_items,private.email_review_batches;
 update public.contacts set email='customer@example.invalid';update public.projects set archived_at=null,pipeline_stage='CONTACTED';
 update public.project_operational_states set state='ACTIVE',row_version=1;update public.portal_users set role=case when user_id='${admin}' then 'admin' else 'staff' end;`);
 const result=await rpc('email_review_import',[input()],admin);batch=result.batchId;
 item=(await rpc('email_review_read',[batch,null,1,50,'all',''])).items[0].id;});
describe('persistent email review SQL boundary',()=>{
 it.each([undefined,'',' \n\t'])('requires an actual reason for a skipped item: %s',async(note)=>{await expect(change('skip',1,note===undefined?{}:{note})).rejects.toMatchObject({code:'22023'});expect((await read()).item.revision).toBe(1);});
 it('imports exact private content and projects summaries/counts to assigned reviewer only',async()=>{
  expect((await read()).item.body).toContain('scope still current');expect((await rpc('email_review_read',[])).batches).toHaveLength(1);
  expect((await rpc('email_review_read',[],other)).batches).toEqual([]);await expect(rpc('email_review_read',[batch,item],other)).rejects.toThrow();
  expect((await rpc('email_review_read',[batch,null,1,10,'draft','synthetic'])).total).toBe(1);
  expect((await rpc('email_review_read',[batch,null,1,10,'draft','no match'])).total).toBe(0);
 });
 it('denies staff import and directory; permits admin reviewer directory',async()=>{await expect(rpc('email_review_import',[input()])).rejects.toThrow();await expect(rpc('email_review_reviewers',[])).rejects.toThrow();expect((await rpc('email_review_reviewers',[],admin)).reviewers).toHaveLength(3);});
 it('denies all direct tables and private helpers to browser/service roles',async()=>{
  for(const role of ['anon','authenticated','service_role']){const x=await db.query(`select has_table_privilege($1,'private.email_review_items','SELECT') as read,has_table_privilege($1,'private.email_review_items','UPDATE') as write,has_function_privilege($1,'private.email_review_actor()','EXECUTE') as helper`,[role]);expect(x.rows[0]).toEqual({read:false,write:false,helper:false});}
 });
 it('repeated source import never overwrites edits and changed source conflicts',async()=>{await change('save',1,{body:'Edited by reviewer'});const retry=input();expect((await rpc('email_review_import',[retry],admin)).existing).toBe(true);expect((await read()).item.body).toBe('Edited by reviewer');retry.items[0].body='Changed import';await expect(rpc('email_review_import',[retry],admin)).rejects.toMatchObject({code:'PT409'});});
 it('requires a saved matching thread and both explicit confirmations',async()=>{
  await expect(change('approve',1,{prerequisitesConfirmed:true,threadConfirmed:true})).rejects.toMatchObject({code:'PT409'});
  await selectThread();await expect(change('approve',2,{prerequisitesConfirmed:true})).rejects.toThrow();
  const r=await change('approve',2,{prerequisitesConfirmed:true,threadConfirmed:true});expect(r.item.status).toBe('approved');expect(r.item.approvalHash).toMatch(/^[a-f0-9]{64}$/);expect(r.item.approvedBy).toBe(staff);
 });
 it('rejects fabricated thread, changed recipient, or subject the reply connector cannot send',async()=>{
  await expect(change('save',1,{threadMessageId:'fabricated'})).rejects.toThrow();await selectThread();
  await change('save',2,{to:'other@example.invalid'});await expect(change('approve',3,{prerequisitesConfirmed:true,threadConfirmed:true})).rejects.toMatchObject({code:'PT409'});
  await change('save',3,{to:'customer@example.invalid',subject:'Different subject'});await expect(change('approve',4,{prerequisitesConfirmed:true,threadConfirmed:true})).rejects.toMatchObject({code:'PT409'});
 });
 it('binds hash to exact approved revision and clears it on any edit',async()=>{await selectThread();const approved=await change('approve',2,{prerequisitesConfirmed:true,threadConfirmed:true});expect(approved.item.revision).toBe(3);
  const row=(await db.query('select private.email_review_hash(private.email_review_approval_content(i)) as hash from private.email_review_items i')).rows[0];expect(row.hash).toBe(approved.item.approvalHash);
  const edited=await change('save',3,{body:'Changed'});expect(edited.item.status).toBe('draft');expect(edited.item.approvalHash).toBeNull();expect(edited.item.events).toHaveLength(4);
 });
 it('supports skip/unapprove and rejects stale revision',async()=>{await change('skip',1,{note:'Check internally'});await expect(change('save',1,{body:'Lost update'})).rejects.toMatchObject({code:'PT409'});expect((await change('unapprove',2)).item.status).toBe('draft');});
 it('replays one command receipt without a second write and rejects collisions',async()=>{const c={commandId:command(),expectedRevision:1,action:'save',body:'Changed'};const a=await rpc('email_review_command',[batch,item,c]);expect(await rpc('email_review_command',[batch,item,c])).toEqual(a);expect((await read()).item.events).toHaveLength(2);await expect(rpc('email_review_command',[batch,item,{...c,body:'Other'}])).rejects.toMatchObject({code:'PT409'});});
 it('fences project/contact drift and requires exact displayed context hash to acknowledge',async()=>{await selectThread();await db.exec("update public.contacts set email='changed@example.invalid'");let current=(await read()).item;expect(current.contextChanged).toBe(true);
  await expect(change('approve',2,{prerequisitesConfirmed:true,threadConfirmed:true})).rejects.toMatchObject({code:'PT409'});
  await expect(change('save',2,{acknowledgeContextChange:true,expectedContextHash:'0'.repeat(64)})).rejects.toMatchObject({code:'PT409'});
  expect((await change('save',2,{acknowledgeContextChange:true,expectedContextHash:current.currentContextHash})).item.contextChanged).toBe(false);
 });
 it.each(["update public.project_operational_states set state='WAITING',row_version=2", "update public.projects set archived_at=now()", "update public.projects set pipeline_stage='DEPOSIT'"])('blocks approval for ineligible current context after rebase: %s',async(sql)=>{await selectThread();await db.exec(sql);const c=(await read()).item;await change('save',2,{acknowledgeContextChange:true,expectedContextHash:c.currentContextHash});await expect(change('approve',3,{prerequisitesConfirmed:true,threadConfirmed:true})).rejects.toMatchObject({code:'PT409'});});
 it.each(["email_confirmed_at=null", "banned_until=now()+interval '1 day'", "deleted_at=now()"])('denies a valid JWT for an inactive auth identity: %s',async(set)=>{await db.query(`update auth.users set ${set} where id=$1`,[staff]);await expect(read()).rejects.toMatchObject({code:'42501'});expect((await rpc('email_review_reviewers',[],admin)).reviewers.map((x:any)=>x.id)).not.toContain(staff);await expect(rpc('email_review_import',[input()],admin)).rejects.toThrow();});
 it('blocks mutation after dispatch freeze',async()=>{await db.query('update private.email_review_items set dispatch_id=$1',[id(90)]);await expect(change('save',1,{body:'Changed after freeze'})).rejects.toMatchObject({code:'PT409'});});
 it('checks current role on every call, permits identifiable admin override',async()=>{const x=await change('skip',1,{note:'Admin review'},admin);expect(x.item.events.at(-1).actorId).toBe(admin);await db.query('delete from public.portal_users where user_id=$1',[staff]);await expect(read()).rejects.toThrow();await db.query('insert into public.portal_users values($1,$2)',[staff,'staff']);});
 it('rejects direct RPC oversized/invalid content and duplicate source IDs atomically',async()=>{let x=input();x.sourceKey='invalid';x.items[0].to='a@example.invalid\r\nBcc: secret@example.invalid';await expect(rpc('email_review_import',[x],admin)).rejects.toThrow();x=input();x.sourceKey='duplicate';x.items.push(x.items[0]);await expect(rpc('email_review_import',[x],admin)).rejects.toThrow();expect((await rpc('email_review_read',[],admin)).batches).toHaveLength(1);});
});
