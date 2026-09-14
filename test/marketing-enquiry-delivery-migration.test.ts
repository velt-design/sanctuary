// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const submission = '11111111-1111-4111-8111-111111111111';
const lease = '22222222-2222-4222-8222-222222222222';
const message = { from: 'info@example.test', to: 'customer@example.test', subject: 'Received', html: '<p>Original</p>', text: 'Original' };
const delivery = { draftEstimate: { inputs: { width: 6 }, outputs: { displayedEstimate: 12000 } }, templateId: 'TEST', emailType: 'WEBSITE_ESTIMATE_AUTORESPONDER', variables: {}, message };

it('atomically retains delivery, preserves replay, fences worker access and finalises once', async () => {
  const db = new PGlite();
  try {
    // Synthetic intake/queue prerequisites isolate the new transaction boundary.
    // Full PGMQ/role compatibility remains the Docker-backed jobs release gate.
    await db.exec(`
      create schema private; create role anon; create role authenticated; create role service_role;
      create table projects(id uuid primary key default gen_random_uuid());
      create table enquiry_requests(id uuid primary key, contact_id uuid, project_id uuid references projects(id));
      create table estimates(id uuid primary key default gen_random_uuid(),project_id uuid references projects(id),
        status text,created_by text,summary_json jsonb,inputs jsonb,outputs jsonb,warnings jsonb,
        costing_manifest text,costing_rules text,costing_config_version_id uuid,crew_hours numeric,duration_days numeric,
        materials_ex_gst numeric,install_payout_ex_gst numeric,overhead_ex_gst numeric,total_true_cost_ex_gst numeric,total_true_cost_inc_gst numeric);
      create table email_templates(id text primary key, subject text, body_html text, body_text text, variables jsonb);
      create table email_outbox(id uuid primary key default gen_random_uuid(), project_id uuid, contact_id uuid,
        email_type text, to_email text, subject text, template_id text references email_templates(id), variables jsonb,
        status text, idempotency_key text unique, error text, sent_at timestamptz);
      create table audit_events(project_id uuid, type text, idempotency_key text unique, payload jsonb);
      create type background_job_rollout_mode as enum ('worker_cohort');
      create type background_job_execution_owner as enum ('worker');
      create table background_jobs(id uuid primary key default gen_random_uuid(), kind text, subject_type text,
        subject_id text, project_id uuid, payload jsonb, lease_owner text, lease_token uuid, lease_expires_at timestamptz, status text);
      create table background_job_effects(job_id uuid, effect_kind text, state text, provider_message_id text);
      create function marketing_enquiry_intake(p_submission_id uuid, p_hash text, p_payload jsonb)
      returns table(contact_id uuid, project_id uuid, enquiry_request_id uuid, already_existed boolean)
      language plpgsql set search_path=public,pg_temp as $$ declare r enquiry_requests%rowtype; p uuid; begin
        select * into r from enquiry_requests where id=p_submission_id;
        if found then return query select r.contact_id,r.project_id,r.id,true; return; end if;
        insert into projects default values returning id into p;
        insert into enquiry_requests values(p_submission_id,gen_random_uuid(),p) returning * into r;
        return query select r.contact_id,r.project_id,r.id,false;
      end $$;
      create function private.background_job_enqueue_core(k text,v integer,st text,si text,p uuid,u uuid,a text,
        priority smallint,intent text,payload jsonb,n timestamptz,r background_job_rollout_mode,
        e background_job_execution_owner,c text) returns background_jobs language plpgsql set search_path=public,pg_temp as $$
      declare j background_jobs; begin
        if current_setting('test.fail_queue',true) = 'yes' then raise exception 'queue unavailable'; end if;
        if a <> 'system' then raise exception 'invalid actor'; end if;
        insert into background_jobs(kind,subject_type,subject_id,project_id,payload,lease_owner,lease_token,lease_expires_at,status)
          values(k,st,si,p,payload,'worker','${lease}',now()+interval '1 hour','running') returning * into j;
        return j;
      end $$;
    `);
    const lifecycle = readFileSync('supabase/migrations/20260720_000003_background_job_lifecycle.sql', 'utf8');
    await db.exec(lifecycle.slice(0, lifecycle.indexOf('$$;') + 3));
    await db.exec(readFileSync('supabase/migrations/20260914062001_marketing_enquiry_durable_delivery.sql', 'utf8'));
    const submit = (id: string, body: unknown = delivery) => db.query(
      'select * from marketing_enquiry_intake_with_delivery($1,$2,$3,$4)',
      [id, '', JSON.stringify({ email: message.to }), JSON.stringify(body)],
    );
    const count = async (table: string) => (await db.query<{ n: number }>(`select count(*)::int n from ${table}`)).rows[0].n;

    await db.exec("set test.fail_queue='yes'");
    await expect(submit(submission)).rejects.toThrow('queue unavailable');
    for (const table of ['projects', 'enquiry_requests', 'estimates', 'email_outbox', 'private.marketing_enquiry_deliveries']) {
      expect(await count(table)).toBe(0);
    }
    await db.exec("set test.fail_queue='no'");
    await expect(submit(submission, { ...delivery, message: { ...message, to: 'someoneelse@example.test' } })).rejects.toThrow('invalid_enquiry_delivery');
    expect(await count('enquiry_requests')).toBe(0);
    const first = await submit(submission);
    const retry = await submit(submission, { ...delivery, draftEstimate: { inputs: {}, outputs: { displayedEstimate: 50000 } }, message: { ...message, html: 'Changed retry' } });
    expect(first.rows[0].estimate_id).toBe(retry.rows[0].estimate_id);
    expect(await count('estimates')).toBe(1);
    expect((await db.query('select inputs,outputs from estimates')).rows[0]).toEqual(delivery.draftEstimate);
    await db.exec("update estimates set outputs='{}'::jsonb");
    expect((await db.query('select draft_estimate from private.marketing_enquiry_deliveries')).rows[0].draft_estimate).toEqual(delivery.draftEstimate);
    expect(await count('background_jobs')).toBe(1);
    expect(await count('email_outbox')).toBe(1);
    const job = (await db.query<{ id: string; payload: unknown }>('select id,payload from background_jobs')).rows[0];
    expect(job.payload).toEqual({ workflow: 'website_enquiry', outboxId: expect.any(String) });
    const read = (worker = 'worker', token = lease) => db.query<{ message: unknown }>(
      'select marketing_enquiry_delivery_read($1,$2,$3) message', [job.id, worker, token],
    );
    expect((await read()).rows[0].message).toEqual(message);
    await expect(read('intruder')).rejects.toThrow('lease is no longer owned');
    await expect(read('worker', submission)).rejects.toThrow('lease is no longer owned');
    const finalise = () => db.query('select marketing_enquiry_delivery_finalise($1,$2,$3,$4)', [job.id, 'worker', lease, 'provider-1']);
    await expect(finalise()).rejects.toThrow('acceptance_required');
    await db.query("insert into background_job_effects values($1,'email_dispatch','provider_accepted','provider-1')", [job.id]);
    await finalise();
    const sentAt = (await db.query('select sent_at from email_outbox')).rows[0].sent_at;
    await finalise();
    expect(await count('audit_events')).toBe(1);
    expect((await db.query('select status,sent_at from email_outbox')).rows[0]).toEqual({ status: 'SENT', sent_at: sentAt });
    await db.exec("update background_jobs set lease_expires_at=now()-interval '1 second'");
    await expect(read()).rejects.toThrow('lease is no longer owned');
    await expect(finalise()).rejects.toThrow('lease is no longer owned');

    const legacy = '33333333-3333-4333-8333-333333333333';
    await db.query('select * from marketing_enquiry_intake($1,$2,$3)', [legacy, '', '{}']);
    await expect(submit(legacy)).rejects.toThrow('legacy_enquiry_delivery_requires_reconciliation');
    expect(await count('background_jobs')).toBe(1);
    const large = '44444444-4444-4444-8444-444444444444';
    await submit(large, { ...delivery, message: { ...message, attachments: [{ filename: 'plan.pdf', content: 'A'.repeat(300_000) }] } });
    expect((await db.query<{ bytes: number }>('select max(octet_length(payload::text)) bytes from background_jobs')).rows[0].bytes).toBeLessThan(256 * 1024);
    await expect(submit('55555555-5555-4555-8555-555555555555', {
      ...delivery, message: { ...message, html: 'A'.repeat(16_777_217) },
    })).rejects.toThrow('check constraint');
    expect(await count('background_jobs')).toBe(2);
    expect(await count('enquiry_requests')).toBe(3); // Two durable submissions plus the legacy fixture.
    const permissions = await db.query<{ allowed: boolean }>(`select has_table_privilege('authenticated',
      'private.marketing_enquiry_deliveries','SELECT') allowed`);
    expect(permissions.rows[0].allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>(`select has_function_privilege('authenticated',
      'public.marketing_enquiry_delivery_read(uuid,text,uuid)','EXECUTE') allowed`)).rows[0].allowed).toBe(false);
  } finally {
    await db.close();
  }
}, 30_000);
