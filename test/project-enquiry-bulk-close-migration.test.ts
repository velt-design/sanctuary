// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260801000002_project_enquiry_bulk_close.sql",
  ),
  "utf8",
);

const bootstrap = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.portal_users(user_id uuid primary key, role text not null);
create function public.is_portal_admin() returns boolean language sql stable as $$
  select exists(
    select 1 from public.portal_users
    where user_id=auth.uid() and role='admin'
  )
$$;
create table public.project_operational_states(
  project_id uuid primary key,
  state text not null default 'ACTIVE',
  row_version bigint not null default 1
);
create table public.test_inactivity_activity(
  project_id uuid not null,
  project_name text not null,
  occurred_at timestamptz not null,
  source text not null,
  protected boolean not null default false
);
create function public.project_enquiry_inactivity_report_v1(
  p_as_of timestamptz default clock_timestamp(),
  p_inactive_days integer default 30
) returns table(
  project_id uuid,
  project_name text,
  pipeline_stage text,
  operational_state text,
  waiting_until timestamptz,
  owner_key text,
  last_activity_at timestamptz,
  last_activity_source text,
  inactive_for_days integer,
  protected_by_future_wait boolean,
  evidence_fingerprint text
) language sql stable as $$
  with latest as (
    select distinct on (activity.project_id)
      activity.project_id,
      activity.project_name,
      activity.occurred_at,
      activity.source,
      activity.protected
    from public.test_inactivity_activity activity
    where activity.occurred_at <= p_as_of
    order by activity.project_id, activity.occurred_at desc, activity.source
  )
  select
    latest.project_id,
    latest.project_name,
    'new'::text,
    state.state,
    null::timestamptz,
    'ellen'::text,
    latest.occurred_at,
    latest.source,
    floor(extract(epoch from (p_as_of-latest.occurred_at))/86400)::integer,
    latest.protected,
    md5(
      latest.project_id::text || ':' || latest.occurred_at::text || ':' ||
      p_as_of::text || ':' || p_inactive_days::text
    )
  from latest
  join public.project_operational_states state
    on state.project_id=latest.project_id
  where state.state in ('ACTIVE','WAITING')
    and latest.occurred_at < p_as_of-make_interval(days=>p_inactive_days)
$$;
create function public.project_operational_state_command(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql as $$
declare v_version bigint;
begin
  select row_version into v_version
  from public.project_operational_states
  where project_id=p_project_id for update;
  if v_version <> (p_payload->>'expectedRowVersion')::bigint then
    raise exception 'STALE_PROJECT_STATE' using errcode='40001';
  end if;
  update public.project_operational_states
  set state='CLOSED', row_version=row_version+1
  where project_id=p_project_id
  returning row_version into v_version;
  return jsonb_build_object(
    'row_version',v_version,'cancelled_count',1,'replayed',false
  );
end
$$;
`;

describe("stale Enquiry bulk-close migration", () => {
  it("keeps the workflow admin-only, fingerprint-bound and command-owned", () => {
    expect(migration).toContain("project_enquiry_bulk_close_v1");
    expect(migration).toContain("public.is_portal_admin()");
    expect(migration).toContain("project_enquiry_inactivity_report_v1");
    expect(migration).toContain("STALE_REVIEW");
    expect(migration).toContain("project_operational_state_command");
    expect(migration).toContain("LOST_NO_RESPONSE");
    expect(migration).toContain("project_enquiry_close_batches");
    expect(migration).not.toMatch(/update\s+public\.projects/i);
    expect(migration).toMatch(
      /grant execute on function public\.project_enquiry_bulk_close_v1\([\s\S]*?\) to authenticated;/,
    );
  });

  it("closes an exact list atomically, replays safely, and rejects changed evidence", async () => {
    const database = new PGlite();
    const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const projectA = "11111111-1111-4111-8111-111111111111";
    const projectB = "22222222-2222-4222-8222-222222222222";
    const reportAsOf = "2026-07-01T00:00:00.000Z";
    try {
      await database.exec(bootstrap);
      await database.exec(migration);
      await database.exec(`
        set "request.jwt.claim.sub"='${adminId}';
        insert into public.portal_users values ('${adminId}','admin');
        insert into public.project_operational_states(project_id)
        values ('${projectA}'),('${projectB}');
        insert into public.test_inactivity_activity(
          project_id,project_name,occurred_at,source
        ) values
          ('${projectA}','A stale enquiry','2026-05-01T00:00:00Z','project_note'),
          ('${projectB}','Another stale enquiry','2026-05-02T00:00:00Z','email');
      `);
      const approved = await database.query<{ candidates: unknown }>(`
        select jsonb_agg(jsonb_build_object(
          'project_id',project_id,
          'evidence_fingerprint',evidence_fingerprint,
          'last_activity_at',last_activity_at,
          'last_activity_source',last_activity_source
        ) order by project_id) as candidates
        from public.project_enquiry_inactivity_report_v1('${reportAsOf}',30)
      `);
      const candidates = approved.rows[0]?.candidates;
      const commandId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const first = await database.query<{ result: any }>(
        `select public.project_enquiry_bulk_close_v1(
          '${commandId}','${reportAsOf}',30,$1::jsonb
        ) as result`,
        [JSON.stringify(candidates)],
      );
      expect(first.rows[0]?.result).toEqual(
        expect.objectContaining({ closed_count: 2, replayed: false }),
      );
      const states = await database.query<{ state: string }>(`
        select state from public.project_operational_states order by project_id
      `);
      expect(states.rows).toEqual([{ state: "CLOSED" }, { state: "CLOSED" }]);

      const replay = await database.query<{ result: any }>(
        `select public.project_enquiry_bulk_close_v1(
          '${commandId}','${reportAsOf}',30,$1::jsonb
        ) as result`,
        [JSON.stringify(candidates)],
      );
      expect(replay.rows[0]?.result.replayed).toBe(true);

      await database.exec(`
        update public.project_operational_states set state='ACTIVE',row_version=1;
        update public.test_inactivity_activity set protected=true
        where project_id='${projectA}';
      `);
      await expect(
        database.query(
          `select public.project_enquiry_bulk_close_v1(
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            '${reportAsOf}',30,$1::jsonb
          )`,
          [JSON.stringify(candidates)],
        ),
      ).rejects.toThrow(/STALE_REVIEW/);
      const protectedStates = await database.query<{ state: string }>(`
        select state from public.project_operational_states order by project_id
      `);
      expect(protectedStates.rows).toEqual([
        { state: "ACTIVE" },
        { state: "ACTIVE" },
      ]);

      await database.exec(`
        update public.test_inactivity_activity set protected=false
        where project_id='${projectA}';
        insert into public.test_inactivity_activity(
          project_id,project_name,occurred_at,source
        ) values (
          '${projectB}','Another stale enquiry','2026-07-15T00:00:00Z','project_note'
        );
      `);
      await expect(
        database.query(
          `select public.project_enquiry_bulk_close_v1(
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            '${reportAsOf}',30,$1::jsonb
          )`,
          [JSON.stringify(candidates)],
        ),
      ).rejects.toThrow(/STALE_REVIEW/);
      const unchanged = await database.query<{ state: string }>(`
        select state from public.project_operational_states order by project_id
      `);
      expect(unchanged.rows).toEqual([{ state: "ACTIVE" }, { state: "ACTIVE" }]);
    } finally {
      await database.close();
    }
  });

  it("rejects non-admin callers before changing anything", async () => {
    const database = new PGlite();
    try {
      await database.exec(bootstrap);
      await database.exec(migration);
      await expect(
        database.query(`select public.project_enquiry_bulk_close_v1(
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd',clock_timestamp(),30,
          '[{"project_id":"11111111-1111-4111-8111-111111111111"}]'::jsonb
        )`),
      ).rejects.toThrow(/admin access required/);
    } finally {
      await database.close();
    }
  });
});
