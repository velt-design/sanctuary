// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import { staffTrialDatabase, seedTrialJobs } from './fixtures/studio-staff-trial-db';
import { packageIds as ids } from './fixtures/studio-client-package-db';
let db:Awaited<ReturnType<typeof staffTrialDatabase>>;
beforeEach(async()=>{db=await staffTrialDatabase();},20000);
afterEach(async()=>{await db?.close();});
const claim=(versions=['studio-booklet-layout.v4'],batch=100)=>db.query<{job_id:string}>('select * from public.background_jobs_claim_studio_trial($1,$2,120,$3)',['studio-trial',batch,versions]);
const enable=()=>db.exec("update private.studio_client_document_control set project_scope='staff_trial',project_ids='{}',enabled=true");

it('keeps explicit admission as default, requires staff role and an existing project, and returns zero after revocation',async()=>{
 const [job]=await seedTrialJobs(db,['studio-booklet-layout.v4']);
 expect((await claim()).rows).toEqual([]);
 expect((await db.query<{allowed:boolean}>('select public.studio_client_document_capability($1,$2) allowed',[ids.project,ids.actor])).rows[0].allowed).toBe(true);
 await enable();
 const project=(await db.query<{project_id:string}>('select project_id from public.background_jobs where id=$1',[job])).rows[0].project_id;
 expect((await db.query<{allowed:boolean}>('select public.studio_client_document_capability($1,$2) allowed',[project,ids.actor])).rows[0].allowed).toBe(true);
 expect((await db.query<{allowed:boolean}>('select public.studio_client_document_capability($1,$2) allowed',[project,ids.file])).rows[0].allowed).toBe(false);
 expect((await db.query<{allowed:boolean}>('select public.studio_client_document_capability($1,$2) allowed',[ids.file,ids.actor])).rows[0].allowed).toBe(false);
 await db.exec('update private.studio_client_document_control set enabled=false');
 expect((await claim()).rows).toEqual([]);
 expect((await db.query<{read_ct:number}>('select read_ct from pgmq.q_portal_background_jobs')).rows.every(row=>row.read_ct===0)).toBe(true);
});

it('filters unsupported projects before the 32-project limit and again before visibility/read-count mutation',async()=>{
 const jobs=await seedTrialJobs(db,[...Array(33).fill('studio-booklet-layout.v3'),'studio-booklet-layout.v4']);
 await enable();
 expect((await claim()).rows.map(row=>row.job_id)).toEqual([jobs[33]]);
 const reads=await db.query<{read_ct:number}>('select read_ct from pgmq.q_portal_background_jobs order by msg_id');
 expect(reads.rows.slice(0,33).every(row=>row.read_ct===0)).toBe(true);
 expect(reads.rows[33].read_ct).toBe(1);
 expect((await claim()).rows).toEqual([]);
});

it('claims at most 32 eligible projects per poll and leaves the remaining messages untouched until the next poll',async()=>{
 const jobs=await seedTrialJobs(db,Array(36).fill('studio-booklet-layout.v4'));
 await enable();
 expect((await claim()).rows.map(row=>row.job_id)).toEqual(jobs.slice(0,32));
 expect((await db.query<{read_ct:number}>('select read_ct from pgmq.q_portal_background_jobs order by msg_id')).rows.slice(32).every(row=>row.read_ct===0)).toBe(true);
 expect((await claim()).rows.map(row=>row.job_id)).toEqual(jobs.slice(32));
});

it('leaves malformed contracts and unrelated kinds untouched and rejects NULL capabilities',async()=>{
 const jobs=await seedTrialJobs(db,Array(3).fill('studio-booklet-layout.v4'));
 await enable();
 await db.query('update public.background_jobs set kind=$2 where id=$1',[jobs[0],'quote_send']);
 await db.query('update pgmq.q_portal_background_jobs set message=message||$2::jsonb where message->>\'jobId\'=$1',[jobs[1],{extra:'invalid'}]);
 await db.query('update public.background_jobs set contract_version=2 where id=$1',[jobs[2]]);
 expect((await claim()).rows).toEqual([]);
 expect((await db.query<{read_ct:number}>('select read_ct from pgmq.q_portal_background_jobs')).rows.every(row=>row.read_ct===0)).toBe(true);
 await expect(db.query('select * from public.background_jobs_claim_studio_trial($1,1,120,null)',['studio-trial'])).rejects.toThrow('invalid_studio_trial_claim');
});

it('refuses Studio dispatch by immutable binding or frozen package at attempt zero even after app rollback, preserving ordinary dispatch',async()=>{
 const studio='60000000-0000-4000-8000-000000000001',frozen='60000000-0000-4000-8000-000000000002',ordinary='60000000-0000-4000-8000-000000000003';
 for(const [id,kind,subject,payload] of [[studio,'quote_resend',ids.quote,{}],[frozen,'quote_send',ids.file,{studioPackage:{revision:1}}],[ordinary,'quote_send',ids.financial,{}]])await db.query("insert into private.commercial_email_intents(id,kind,subject_id,project_id,protected_payload,provider_idempotency_expires_at) values($1,$2,$3,$4,$5,now()+interval '1 day')",[id,kind,subject,ids.project,payload]);
 for(const id of [studio,frozen])await expect(db.query('select public.commercial_email_mark_dispatching($1)',[id])).rejects.toThrow('Studio customer email sending is disabled');
 expect((await db.query<{status:string;attempt_count:number}>('select status,attempt_count from private.commercial_email_intents where id=any($1)',[[studio,frozen]])).rows).toEqual([{status:'prepared',attempt_count:0},{status:'prepared',attempt_count:0}]);
 await db.query('select public.commercial_email_mark_dispatching($1)',[ordinary]);
 expect((await db.query('select status,attempt_count from private.commercial_email_intents where id=$1',[ordinary])).rows[0]).toEqual({status:'dispatching',attempt_count:1});
 const definitions=await db.query<{definition:string}>("select pg_get_functiondef('public.commercial_email_mark_dispatching(uuid)'::regprocedure) definition");
 expect(definitions.rows[0].definition).toContain('commercial-project-invoice:');
 expect(definitions.rows[0].definition).toContain("v_intent.status = 'cancelled'");
});
