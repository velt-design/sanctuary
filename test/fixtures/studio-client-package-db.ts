import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
export const packageIds = {
  project: "10000000-0000-4000-8000-000000000001",
  actor: "10000000-0000-4000-8000-000000000002",
  snapshot: "10000000-0000-4000-8000-000000000003",
  quote: "10000000-0000-4000-8000-000000000004",
  family: "10000000-0000-4000-8000-000000000005",
  file: "10000000-0000-4000-8000-000000000006",
  financial: "10000000-0000-4000-8000-000000000007",
  booklet: "10000000-0000-4000-8000-000000000008",
};
const sql = (name: string) =>
  readFileSync(
    new URL(`../../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
export function functionSql(source: string, name: string) {
  const a = source.search(
    new RegExp(
      `create (?:or replace )?function ${name.replaceAll(".", "\\.")}\\(`,
    ),
  );
  if (a < 0) throw Error(name);
  return source.slice(a, source.indexOf("$$;", a) + 3);
}
/** Disposable relational fixture. Production SQL executes unchanged; providers/queue dispatch are absent. */
export async function packageDatabase() {
  const db = new PGlite();
  await db.exec(`create schema private;create schema pgmq;create role anon;create role authenticated;create role service_role;
 create type public.background_job_status as enum('queued','running','finalising','succeeded','needs_attention','permanent_failed','cancelled');
 create type public.background_job_rollout_mode as enum('worker_enabled');create type public.background_job_execution_owner as enum('worker');
 create table public.projects(id uuid primary key,pipeline_stage text);
 create table public.portal_users(user_id uuid primary key,role text);
 create table public.quotes(id uuid primary key,project_id uuid,quote_ref text);
 create table public.quote_versions(id uuid primary key,quote_id uuid,version_number integer,status text,commercial_revision bigint,is_current_draft boolean,delivery_prepared_at timestamptz);
 create table public.deposit_invoices(id uuid primary key,project_id uuid,status text,restore_command_id uuid);
 create table public.file_artifacts(id uuid primary key default gen_random_uuid(),project_id uuid,filename text,content_type text,size_bytes integer,content_base64 text,created_by text,created_at timestamptz default now());
 create table public.background_jobs(id uuid primary key default gen_random_uuid(),kind text,subject_type text,subject_id text,project_id uuid,queue_message_id bigint,status public.background_job_status default 'queued',attempt_count integer default 0,cancellation_requested_at timestamptz,test_payload jsonb);
 create table pgmq.q_portal_background_jobs(msg_id bigint generated always as identity,message jsonb,vt timestamptz default now(),read_ct integer default 0);
 create table private.studio_website_quote_snapshots(id uuid primary key,project_id uuid,actor_user_id uuid,content_hash text,customer_view jsonb,handoff jsonb);
 create table private.studio_website_quote_bindings(quote_version_id uuid primary key,snapshot_id uuid);
 create table private.studio_client_document_control(singleton boolean,enabled boolean,project_ids uuid[]);
 create table private.studio_client_document_sources(snapshot_id uuid primary key references private.studio_website_quote_snapshots(id),renderer_version text,drawing_source jsonb);
 create table private.studio_client_documents(snapshot_id uuid primary key references private.studio_client_document_sources(snapshot_id),project_id uuid references public.projects(id),quote_version_id uuid references public.quote_versions(id),renderer_version text,job_id uuid unique references public.background_jobs(id),total_pages integer check(total_pages between 1 and 193),file_id uuid references public.file_artifacts(id),enqueue_failed boolean default false,created_at timestamptz default now(),completed_at timestamptz);
 create table private.studio_client_document_pages(snapshot_id uuid references private.studio_client_documents(snapshot_id),page_index integer check(page_index between 0 and 192),content_hash text,content_base64 text,primary key(snapshot_id,page_index));
 create table private.commercial_email_intents(id uuid primary key default gen_random_uuid(),intent_key text unique,kind text,subject_id uuid,project_id uuid,payload_hash text,protected_payload jsonb,status text default 'prepared',provider_name text default 'resend',provider_idempotency_key text,provider_idempotency_expires_at timestamptz,provider_message_id text,attempt_count integer default 0,last_error_code text,created_at timestamptz default now(),updated_at timestamptz default now(),provider_accepted_at timestamptz,finalised_at timestamptz);
 create unique index unfinished on private.commercial_email_intents(kind,subject_id) where status not in ('cancelled','finalised');
 create function private.background_job_enqueue_core(text,integer,text,text,uuid,uuid,text,smallint,text,jsonb,text,text,text,text) returns public.background_jobs language plpgsql as $$declare j public.background_jobs%rowtype;mid bigint;begin insert into public.background_jobs(kind,subject_type,subject_id,project_id,test_payload) values($1,$3,$4,$5,$10) returning * into j;insert into pgmq.q_portal_background_jobs(message) values(jsonb_build_object('jobId',j.id)) returning msg_id into mid;update public.background_jobs set queue_message_id=mid where id=j.id returning * into j;return j;end$$;
 create function private.background_job_lock_owned(uuid,text,uuid) returns public.background_jobs language sql as $$ select * from public.background_jobs where id=$1 $$;
 create function public.background_job_manual_retry(uuid,uuid) returns void language sql as $$update public.background_jobs set status='queued' where id=$1$$;
 `);
  const trust = sql("20260728_000001_commercial_workflow_trust.sql");
  const inventory = sql(
    "20261029223138_studio_booklet_drawing_only_inventory.sql",
  );
  for (const name of [
    "private.studio_document_manifest_valid",
    "private.studio_document_total_pages",
  ])
    await db.exec(functionSql(inventory, name));
  for (const name of [
    "public.commercial_email_prepare",
    "public.commercial_quote_prepare_delivery_email",
    "public.commercial_email_mark_dispatching",
  ])
    await db.exec(functionSql(trust, name)).catch((error) => {
      throw Error(name + ": " + error.message);
    });
  const invoice = sql("20261012000001_invoice_restore.sql");
  await db
    .exec(functionSql(invoice, "private.invoice_email_generation_guard"))
    .catch((error) => {
      throw Error("invoice guard: " + error.message);
    });
  await db.exec(
    "create trigger invoice_email_generation_guard before insert or update of status on private.commercial_email_intents for each row execute function private.invoice_email_generation_guard();",
  );
  const { project, actor, snapshot, quote, family, file, financial, booklet } =
    packageIds;
  await db.query(
    "insert into public.projects(id,pipeline_stage) values($1,$2)",
    [project, "QUOTING"],
  );
  await db.query("insert into public.portal_users values($1,$2)", [
    actor,
    "staff",
  ]);
  await db.query("insert into public.quotes values($1,$2,$3)", [
    family,
    project,
    "Q-TEST",
  ]);
  await db.query(
    "insert into public.quote_versions values($1,$2,1,'DRAFT',1,true,null)",
    [quote, family],
  );
  await db.query(
    "insert into private.studio_website_quote_snapshots values($1,$2,$3,$4,$5,$6)",
    [
      snapshot,
      project,
      actor,
      "a".repeat(64),
      { schemaVersion: "studio_quote_snapshot.v2" },
      { source: { schemaVersion: "studio_authoring_view.v1" } },
    ],
  );
  await db.query(
    "insert into private.studio_website_quote_bindings values($1,$2)",
    [quote, snapshot],
  );
  await db.query(
    "insert into private.studio_client_document_control values(true,true,$1)",
    [[project]],
  );
  await db.query(
    "insert into private.studio_client_document_sources values($1,$2,$3)",
    [
      snapshot,
      "studio-booklet.v1",
      {
        layoutVersion: "studio-booklet-layout.v4",
        contentHash: "a".repeat(64),
      },
    ],
  );
  for (const [id, name, type, bytes] of [
    [file, "Synthetic render.png", "image/png", Buffer.from("synthetic image")],
    [financial, "Q-TEST.pdf", "application/pdf", Buffer.from("%PDF-financial")],
    [
      booklet,
      "Sanctuary-Design-Q-TEST.pdf",
      "application/pdf",
      Buffer.from("%PDF-original-booklet"),
    ],
  ] as const)
    await db.query(
      "insert into public.file_artifacts(id,project_id,filename,content_type,size_bytes,content_base64) values($1,$2,$3,$4,$5,$6)",
      [id, project, name, type, bytes.length, bytes.toString("base64")],
    );
  await db.query(
    "insert into private.studio_client_documents(snapshot_id,project_id,quote_version_id,renderer_version,total_pages,file_id) values($1,$2,$3,$4,13,$5)",
    [snapshot, project, quote, "studio-booklet.v1", booklet],
  );
  await db
    .exec(sql("20261029231641_studio_client_package_variants.sql"))
    .catch((error) => {
      throw Error(
        "variants migration: " + error.message + " position " + error.position,
      );
    });
  await db
    .exec(sql("20261029231753_studio_client_package_drafts.sql"))
    .catch((error) => {
      throw Error(
        "drafts migration: " +
          error.message +
          " position " +
          error.position +
          " internal " +
          error.internalPosition +
          " context " +
          error.where,
      );
    });
  return db;
}
