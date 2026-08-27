// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260827000001_project_enquiry_attachments.sql",
  ),
  "utf8",
);
const executableMigration = migration.replace(
  /^create extension if not exists pgcrypto with schema extensions;\r?\n/m,
  "",
);
const signingBoundaryMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260827000003_project_enquiry_attachment_signing_boundary.sql",
  ),
  "utf8",
);

const bootstrap = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema private;
create schema storage;
create schema extensions;
create function extensions.digest(bytea,text) returns bytea language sql immutable as $$
  select decode(md5(convert_from($1,'UTF8')) || md5(reverse(convert_from($1,'UTF8'))),'hex')
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function public.has_portal_access() returns boolean language sql stable as $$
  select true
$$;
create function public.is_portal_admin() returns boolean language sql stable as $$
  select true
$$;
create table public.projects(
  id uuid primary key,
  name text not null
);
create table public.enquiry_requests(
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  submission_id uuid not null unique,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  unique(bucket_id, name)
);
alter table storage.objects enable row level security;
`;

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const ENQUIRY_NEW = "33333333-3333-4333-8333-333333333333";
const SUBMISSION_NEW = "44444444-4444-4444-8444-444444444444";
const ENQUIRY_OLD = "55555555-5555-4555-8555-555555555555";
const SUBMISSION_OLD = "66666666-6666-4666-8666-666666666666";

function descriptor(submissionId: string, name: string, size = 123) {
  return {
    path: `pending/${submissionId}/0-${name}`,
    name,
    size,
    type: "application/pdf",
  };
}

describe("project enquiry attachment migration", () => {
  it("links new files atomically, follows an explicit project reassignment, and audits both", async () => {
    const database = new PGlite();
    try {
      await database.exec(bootstrap);
      await database.exec(`
        insert into public.projects(id,name) values
          ('${PROJECT_A}','Project A'),
          ('${PROJECT_B}','Project B');
      `);
      await database.exec(executableMigration);
      const file = descriptor(SUBMISSION_NEW, "plan.pdf");
      await database.query(
        `insert into storage.objects(bucket_id,name)
         values ('enquiry-attachments',$1)`,
        [file.path],
      );
      await database.query(
        `insert into public.enquiry_requests(id,project_id,submission_id,files)
         values ('${ENQUIRY_NEW}','${PROJECT_A}','${SUBMISSION_NEW}',$1::jsonb)`,
        [JSON.stringify([file])],
      );

      const linked = await database.query<{
        project_id: string;
        storage_path: string;
        link_origin: string;
      }>(`select project_id,storage_path,link_origin from public.project_enquiry_attachments`);
      expect(linked.rows).toEqual([
        {
          project_id: PROJECT_A,
          storage_path: file.path,
          link_origin: "intake",
        },
      ]);

      await database.exec(`
        update public.enquiry_requests
        set project_id='${PROJECT_B}'
        where id='${ENQUIRY_NEW}';
      `);
      const moved = await database.query<{ project_id: string }>(
        `select project_id from public.project_enquiry_attachments`,
      );
      expect(moved.rows).toEqual([{ project_id: PROJECT_B }]);
      const events = await database.query<{
        event_type: string;
        previous_project_id: string | null;
        project_id: string | null;
      }>(`
        select event_type,previous_project_id,project_id
        from public.project_enquiry_attachment_events
        order by occurred_at,id
      `);
      expect(events.rows).toEqual([
        {
          event_type: "linked",
          previous_project_id: null,
          project_id: PROJECT_A,
        },
        {
          event_type: "relinked",
          previous_project_id: PROJECT_A,
          project_id: PROJECT_B,
        },
      ]);
      await database.exec(`delete from public.projects where id='${PROJECT_B}'`);
      const unlinked = await database.query<{ project_id: string | null; unlinked: boolean }>(`
        select project_id,unlinked_at is not null as unlinked
        from public.project_enquiry_attachments
      `);
      expect(unlinked.rows).toEqual([{ project_id: null, unlinked: true }]);
    } finally {
      await database.close();
    }
  });

  it("rolls back a new enquiry when its declared Storage object is missing", async () => {
    const database = new PGlite();
    try {
      await database.exec(bootstrap);
      await database.exec(`insert into public.projects(id,name) values ('${PROJECT_A}','Project A')`);
      await database.exec(executableMigration);
      const missing = descriptor(SUBMISSION_NEW, "missing.pdf");
      await expect(
        database.query(
          `insert into public.enquiry_requests(id,project_id,submission_id,files)
           values ('${ENQUIRY_NEW}','${PROJECT_A}','${SUBMISSION_NEW}',$1::jsonb)`,
          [JSON.stringify([missing])],
        ),
      ).rejects.toThrow(/invalid_or_missing_enquiry_attachment/);
      const rows = await database.query<{ count: number }>(
        `select count(*)::integer as count from public.enquiry_requests`,
      );
      expect(rows.rows[0]?.count).toBe(0);
    } finally {
      await database.close();
    }
  });

  it("backfills an exact historical candidate once and replays the same run safely", async () => {
    const database = new PGlite();
    try {
      await database.exec(bootstrap);
      const file = descriptor(SUBMISSION_OLD, "old-plan.pdf", 456);
      await database.exec(
        `insert into public.projects(id,name) values ('${PROJECT_A}','Project A')`,
      );
      await database.query(
        `insert into public.enquiry_requests(id,project_id,submission_id,files)
         values ('${ENQUIRY_OLD}','${PROJECT_A}','${SUBMISSION_OLD}',$1::jsonb)`,
        [JSON.stringify([file])],
      );
      await database.query(
        `insert into storage.objects(bucket_id,name)
         values ('enquiry-attachments',$1)`,
        [file.path],
      );
      await database.exec(executableMigration);
      const candidate = {
        enquiry_request_id: ENQUIRY_OLD,
        project_id: PROJECT_A,
        submission_id: SUBMISSION_OLD,
        file_ordinal: 0,
        storage_path: file.path,
        original_filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
      };
      const runId = "77777777-7777-4777-8777-777777777777";
      const first = await database.query<{
        inserted_count: number;
        existing_count: number;
        replayed: boolean;
      }>(
        `select inserted_count,existing_count,replayed
         from public.project_enquiry_attachment_backfill_apply('${runId}',$1::jsonb)`,
        [JSON.stringify([candidate])],
      );
      expect(first.rows).toEqual([
        { inserted_count: 1, existing_count: 0, replayed: false },
      ]);

      const replay = await database.query<{
        inserted_count: number;
        existing_count: number;
        replayed: boolean;
      }>(
        `select inserted_count,existing_count,replayed
         from public.project_enquiry_attachment_backfill_apply('${runId}',$1::jsonb)`,
        [JSON.stringify([candidate])],
      );
      expect(replay.rows).toEqual([
        { inserted_count: 1, existing_count: 0, replayed: true },
      ]);

      await expect(
        database.query(
          `select * from public.project_enquiry_attachment_backfill_apply('${runId}',$1::jsonb)`,
          [JSON.stringify([{ ...candidate, original_filename: "different.pdf" }])],
        ),
      ).rejects.toThrow(/attachment_backfill_command_conflict/);
    } finally {
      await database.close();
    }
  });

  it("keeps the bucket private and removes direct browser signing access", async () => {
    const normalized = migration.toLowerCase();
    const signingBoundaryNormalized = signingBoundaryMigration.toLowerCase();
    expect(normalized).not.toContain("public = true");
    expect(normalized).not.toMatch(/to\s+anon/);
    expect(normalized).toContain(
      "grant select on table public.project_enquiry_attachments to authenticated",
    );
    expect(normalized).toContain(
      "grant select on table public.project_enquiry_attachments to service_role",
    );
    expect(normalized).toMatch(
      /grant execute on function public\.project_enquiry_attachment_backfill_apply\(uuid,jsonb\)\s+to service_role/,
    );
    expect(signingBoundaryNormalized).toContain(
      "drop policy if exists enquiry_attachments_staff_signed_read on storage.objects",
    );

    const database = new PGlite();
    try {
      await database.exec(bootstrap);
      await database.exec(executableMigration);
      await database.exec(signingBoundaryMigration);
      const policies = await database.query<{ count: number }>(`
        select count(*)::integer as count
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'enquiry_attachments_staff_signed_read'
      `);
      expect(policies.rows).toEqual([{ count: 0 }]);
    } finally {
      await database.close();
    }
  });
});
