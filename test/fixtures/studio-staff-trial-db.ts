import { readFileSync } from 'node:fs';
import { functionSql, packageDatabase } from './studio-client-package-db';

const migration = (name:string) => readFileSync(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
/** Actual forward migration and scoped queue readers. The foundation claim is a
 * controlled lease stub; this fixture does not establish multi-connection races,
 * the complete production state machine or provider/hosting behaviour. */
export async function staffTrialDatabase(){
 const db=await packageDatabase();
 await db.exec(`
  create table public.estimates(id uuid primary key);
  alter table private.studio_client_document_control add constraint studio_client_document_control_check check(not enabled or cardinality(project_ids)>0);
  alter table public.background_jobs add column contract_version integer default 1,
   add column execution_owner public.background_job_execution_owner default 'worker',
   add column rollout_mode public.background_job_rollout_mode default 'worker_enabled',
   add column next_attempt_at timestamptz default now(),add column lease_expires_at timestamptz;
 `);
 for(const [file,names] of [
  ['20261028090403_studio_client_documents.sql',['public.studio_client_document_capability']],
  ['20261028132459_studio_client_document_archives.sql',['public.studio_client_quote_prepare']],
  ['20261028114624_studio_client_quote_atomic_create.sql',['public.studio_client_quote_create_replay','public.studio_client_quote_store_pdf']],
 ] as const)for(const name of names)await db.exec(functionSql(migration(file),name));
 // Preserve the invoice lock added by the public migration before testing the trial dispatch patch.
 const invoice=migration('20261012000001_invoice_restore.sql');
 const start=invoice.indexOf('-- Dispatch must take the project lock');
 const patch=invoice.slice(start,invoice.indexOf("notify pgrst",start));
 // This patch also requires the canonical unfinished reader.
 await db.exec(functionSql(migration('20260728_000001_commercial_workflow_trust.sql'),'public.commercial_email_read_unfinished'));
 await db.exec(patch);
 await db.exec(`create function public.background_jobs_claim(p_worker_id text,p_batch_size integer,p_visibility_timeout_seconds integer)
 returns table(job_id uuid,kind text,contract_version integer,status public.background_job_status,current_phase text,attempt_number integer,max_attempts integer,queue_message_id bigint,lease_token uuid,lease_expires_at timestamptz,cancellation_requested_at timestamptz,rollout_mode public.background_job_rollout_mode,execution_owner public.background_job_execution_owner)
 language plpgsql as $$ declare message record;job public.background_jobs%rowtype;begin
 for message in select * from private.background_job_read_claim_queue(p_visibility_timeout_seconds,p_batch_size) loop
  update public.background_jobs set status='running',attempt_count=attempt_count+1,lease_expires_at=clock_timestamp()+make_interval(secs=>p_visibility_timeout_seconds)
  where id::text=message.message->>'jobId' returning * into job;
  return query select job.id,job.kind,job.contract_version,job.status,'running'::text,job.attempt_count,3,job.queue_message_id,gen_random_uuid(),job.lease_expires_at,job.cancellation_requested_at,job.rollout_mode,job.execution_owner;
 end loop;end $$;
 create table public.background_job_kinds(kind text primary key);
 insert into public.background_job_kinds values('studio_design_booklet_v1');`);
 await db.exec(functionSql(migration('20261028090414_background_jobs_scoped_claim.sql'),'public.background_jobs_claim_scoped'));
 await db.exec(migration('20261030020837_studio_designer_staff_trial_scope.sql'));
 return db;
}

export async function seedTrialJobs(db:Awaited<ReturnType<typeof staffTrialDatabase>>,versions:readonly string[]){
 const ids:string[]=[];
 for(const [index,version] of versions.entries()){
  const suffix=String(index+100).padStart(12,'0');
  const project=`20000000-0000-4000-8000-${suffix}`,snapshot=`30000000-0000-4000-8000-${suffix}`,quote=`40000000-0000-4000-8000-${suffix}`,job=`50000000-0000-4000-8000-${suffix}`;
  await db.query(`insert into public.projects(id) values($1);
   `,[project]);
  await db.query('insert into public.quotes(id,project_id) values($1,$2)',[quote,project]);
  await db.query('insert into public.quote_versions(id,quote_id) values($1,$1)',[quote]);
  await db.query('insert into private.studio_website_quote_snapshots(id,project_id) values($1,$2)',[snapshot,project]);
  await db.query("insert into private.studio_client_document_sources values($1,'studio-booklet.v1',$2)",[snapshot,{layoutVersion:version}]);
  await db.query("insert into public.background_jobs(id,kind,subject_type,subject_id,project_id) values($1,'studio_design_booklet_v1','studio_snapshot',$2,$3)",[job,snapshot,project]);
  await db.query("insert into private.studio_client_documents(document_id,snapshot_id,project_id,quote_version_id,renderer_version,job_id,total_pages) values($1,$1,$2,$3,'studio-booklet.v1',$4,6)",[snapshot,project,quote,job]);
  const message=await db.query<{msg_id:number}>('insert into pgmq.q_portal_background_jobs(message) values($1) returning msg_id',[{jobId:job,contractVersion:1}]);
  await db.query('update public.background_jobs set queue_message_id=$2 where id=$1',[job,message.rows[0].msg_id]);
  ids.push(job);
 }
 return ids;
}
