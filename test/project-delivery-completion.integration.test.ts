// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const project = '11111111-1111-4111-8111-111111111111';
const scheduled = '22222222-2222-4222-8222-222222222222';
const command = '33333333-3333-4333-8333-333333333333';
const source = readFileSync('supabase/migrations/20260729_000002_project_work_items_v2.sql', 'utf8').replaceAll('\r', '');
function sourceFunction(name: string) {
  const start = source.indexOf('create or replace function public.' + name + '(');
  return source.slice(start, source.indexOf('\n$$;', start) + 4);
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select '${command}'::uuid $$;
    create function public.has_portal_access() returns boolean language sql as $$ select coalesce(current_setting('test.access', true),'yes') <> 'no' $$;
    create table public.projects(id uuid primary key, pipeline_stage text, archived_at timestamptz, final_payment_date date);
    create table public.project_operational_states(project_id uuid primary key, state text);
    create table public.scheduled_jobs(id uuid primary key default gen_random_uuid(), job_id uuid, status text, actual_finish date);
    create table public.project_confirmation_events(
      id uuid primary key default gen_random_uuid(), project_id uuid, command_id uuid, event_sequence int default 0,
      event_kind text, confirmation_type text constraint project_confirmation_events_confirmation_type_check check (confirmation_type = 'SITE_VISIT_COMPLETED'),
      subject_kind text, subject_id uuid, occurred_at timestamptz, recorded_at timestamptz default now(),
      recorded_by uuid, actor_kind text, retracts_event_id uuid references public.project_confirmation_events(id),
      reason text, unique(command_id,event_sequence)
    );
    create table public.project_command_receipts(command_id uuid primary key, project_id uuid, command_type text, intent_hash text,
      actor_user_id uuid, actor_kind text, committed_result jsonb);
    create function public.project_work_items_assert_v2(uuid,boolean) returns void language sql as $$ select $$;
    create function public.project_operational_state_command(p_project_id uuid,p_command_id uuid,p_command text,p_payload jsonb)
    returns jsonb language plpgsql as $$
    begin
      if not exists (
        select 1
        from public.scheduled_jobs scheduled
        where scheduled.job_id = p_project_id
          and scheduled.status = 'done'
          and scheduled.actual_finish is not null
      ) then
        raise exception 'PROJECT_NOT_COMPLETE: Schedule V2 has not confirmed completion';
      end if;
      return '{}'::jsonb;
    end $$;
    insert into public.projects values ('${project}','DEPOSIT',null,null), ('${scheduled}','SCHEDULED',null,null);
    insert into public.project_operational_states values ('${project}','ACTIVE'), ('${scheduled}','ACTIVE');
  `);
  for (const name of ['project_work_items_intent_hash', 'project_work_items_receipt_replay', 'project_work_items_store_receipt']) {
    await db.exec(sourceFunction(name));
  }
  await db.exec(readFileSync('supabase/migrations/20260911000001_project_delivery_completion.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });

describe('delivery evidence without payment changes', () => {
  it('records date and note once, projects Completed, and replays the identical command', async () => {
    const sql = 'select public.project_record_delivery_completion($1,$2,$3,$4) as result';
    const args = [project, command, '2026-01-01', 'Supply-only order collected'];
    await db.query(sql, args);
    const replay = await db.query<{ result: { replayed: boolean } }>(sql, args);
    expect(replay.rows[0].result.replayed).toBe(true);
    const rows = await db.query('select pipeline_stage,final_payment_date from public.projects where id=$1', [project]);
    expect(rows.rows[0]).toEqual({ pipeline_stage: 'COMPLETED', final_payment_date: null });
    const events = await db.query('select delivery_details from public.project_confirmation_events where project_id=$1', [project]);
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].delivery_details).toEqual({ note: 'Supply-only order collected', previousStage: 'DEPOSIT' });
    await expect(db.query(sql, [project, command, '2026-01-01', 'Changed intent'])).rejects.toThrow();
  });

  it('retracts manual completion without erasing evidence and restores the prior stage', async () => {
    await db.exec(`insert into public.project_confirmation_events(project_id,command_id,event_kind,confirmation_type,retracts_event_id,reason)
      select project_id,gen_random_uuid(),'RETRACTED',confirmation_type,id,'Collected date was incorrect'
      from public.project_confirmation_events where project_id='${project}' and event_kind='CONFIRMED';`);
    expect((await db.query('select pipeline_stage from public.projects where id=$1', [project])).rows[0].pipeline_stage).toBe('DEPOSIT');
    expect((await db.query('select count(*)::int as count from public.project_confirmation_events')).rows[0].count).toBe(2);
  });

  it('uses schedule evidence, preserves payment dates, and projects a schedule reopening', async () => {
    await db.query("insert into public.scheduled_jobs(job_id,status) values ($1,'in_progress')", [scheduled]);
    await expect(db.query('select public.project_record_delivery_completion($1,$2,$3,$4)',
      [scheduled, crypto.randomUUID(), '2026-01-01', 'Do not bypass schedule'])).rejects.toThrow(/Schedule/);
    await db.query("update public.scheduled_jobs set status='done',actual_finish='2026-01-01' where job_id=$1", [scheduled]);
    expect((await db.query('select pipeline_stage,final_payment_date from public.projects where id=$1', [scheduled])).rows[0])
      .toEqual({ pipeline_stage: 'COMPLETED', final_payment_date: null });
    await db.query("update public.scheduled_jobs set status='in_progress',actual_finish=null where job_id=$1", [scheduled]);
    expect((await db.query('select pipeline_stage from public.projects where id=$1', [scheduled])).rows[0].pipeline_stage).toBe('SCHEDULED');
  });

  it('rejects missing notes, future dates, and unauthorized callers', async () => {
    const call = 'select public.project_record_delivery_completion($1,$2,$3,$4)';
    await expect(db.query(call, [project, crypto.randomUUID(), '2026-01-01', ''])).rejects.toThrow(/note/);
    await expect(db.query(call, [project, crypto.randomUUID(), '2999-01-01', 'Future'])).rejects.toThrow(/future/);
    await db.exec("set test.access='no'");
    await expect(db.query(call, [project, crypto.randomUUID(), '2026-01-01', 'Done'])).rejects.toThrow(/staff access/);
    await db.exec("set test.access='yes'");
    expect((await db.query("select has_function_privilege('anon','public.project_record_delivery_completion(uuid,uuid,date,text)','execute') as allowed")).rows[0].allowed).toBe(false);
  });
});
