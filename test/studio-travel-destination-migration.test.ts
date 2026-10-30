// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite(),
  project = "10000000-0000-4000-8000-000000000001",
  snapshot = "10000000-0000-4000-8000-000000000002",
  quote = "10000000-0000-4000-8000-000000000003";
const migration = readFileSync(
  "supabase/migrations/20261027234904_studio_travel_quote_destination_guard.sql",
  "utf8",
);
// Executable wrapper/rollback harness. The predecessor is a deliberately small fixture;
// this is not a replacement for real predecessor/native multi-session verification.
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table projects(id uuid primary key,site_address text);
 create table quote_versions(id uuid primary key,quote_id uuid,client_intent_id text);
 create table private.studio_website_quote_snapshots(id uuid primary key,content_hash text,project_id uuid,authored jsonb,customer_view jsonb);
 create table private.test_effects(id integer);
 create function public.studio_website_quote_commit(p_operation text,p_snapshot_id uuid,p_content_hash text,p_command jsonb) returns public.quote_versions language plpgsql as $$
 declare q public.quote_versions%rowtype;
 begin
 select * into q from public.quote_versions where quote_id=(p_command->>'p_quote_id')::uuid and client_intent_id=p_command->>'p_client_intent_id';
 if found then return q;end if;
 insert into private.test_effects values(1);
 if p_command ? 'test_late_address' then update public.projects set site_address=p_command->>'test_late_address';end if;
 insert into public.quote_versions values((p_command->>'id')::uuid,(p_command->>'p_quote_id')::uuid,p_command->>'p_client_intent_id') returning * into q;
 return q;
 end $$;
 insert into projects values('${project}','Original site');
 insert into private.studio_website_quote_snapshots values('${snapshot}','hash','${project}','{"site":{"values":{"travelAllowance":{"mode":"automatic","receipt":{"destinationCanonical":"Original site"}}}}}','{"travelContext":{"schemaVersion":"studio_quote_travel.v1","destinationCanonical":"Original site"}}');`);
  await db.exec(migration);
});
afterAll(() => db.close());
const command = (intent: string, extra = {}) => ({
  id: "10000000-0000-4000-8000-000000000004",
  p_quote_id: quote,
  p_client_intent_id: intent,
  ...extra,
});
async function commit(operation: string, body: unknown) {
  return db.query(
    "select public.studio_website_quote_commit_travel($1,$2,$3,$4)",
    [operation, snapshot, "hash", body],
  );
}
it("locks the Project with FOR SHARE, keeps predecessor unchanged and service-role-only RPC distinct", () => {
  expect(migration).toMatch(
    /from public\.projects where id=s\.project_id for share/,
  );
  expect(migration).not.toMatch(/for key share/i);
  expect(migration).toContain(
    "pg_advisory_xact_lock(hashtextextended('commercial-quote:'",
  );
  expect(migration).toContain(
    "grant execute on function public.studio_website_quote_commit_travel(text,uuid,text,jsonb) to service_role",
  );
  expect(migration).not.toContain(
    "create or replace function public.studio_website_quote_commit(",
  );
});
it("rolls back all delegated side effects when address changes during commit", async () => {
  await expect(
    commit("create", command("stale", { test_late_address: "Changed site" })),
  ).rejects.toThrow(/studio_travel_destination_changed/);
  expect((await db.query("select * from quote_versions")).rows).toHaveLength(0);
  expect(
    (await db.query("select * from private.test_effects")).rows,
  ).toHaveLength(0);
  expect((await db.query("select site_address from projects")).rows[0]).toEqual(
    { site_address: "Original site" },
  );
});
it("preserves committed same-intent retry and frozen revise after a later Project edit", async () => {
  await commit("create", command("same"));
  await db.exec("update projects set site_address='Later site'");
  await expect(commit("create", command("same"))).resolves.toBeDefined();
  await expect(
    commit(
      "revise",
      command("revise", { id: "10000000-0000-4000-8000-000000000005" }),
    ),
  ).resolves.toBeDefined();
});
it("rejects fresh refresh/create with stale or malformed automatic destination", async () => {
  await expect(
    commit(
      "refresh",
      command("fresh", { id: "10000000-0000-4000-8000-000000000006" }),
    ),
  ).rejects.toThrow(/destination_changed/);
  await db.exec(
    `update private.studio_website_quote_snapshots set customer_view='{}'`,
  );
  await expect(
    commit(
      "create",
      command("missing", { id: "10000000-0000-4000-8000-000000000007" }),
    ),
  ).rejects.toThrow(/destination_invalid/);
});
