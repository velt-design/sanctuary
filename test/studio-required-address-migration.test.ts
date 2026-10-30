// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite(),
  project = "10000000-0000-4000-8000-000000000001",
  snapshot = "10000000-0000-4000-8000-000000000002",
  quote = "10000000-0000-4000-8000-000000000003";
const migration = readFileSync(
  "supabase/migrations/20261028004820_studio_required_quote_site_address.sql",
  "utf8",
);
const proof = {
  schemaVersion: "studio_selected_address.v1",
  projectId: `proj_${project}`,
  destinationCanonical: "Original site",
  placeId: "fixture_place",
  issuedAt: 1,
  proof: "a".repeat(64),
};
const authored = {
  site: {
    values: {
      travelExGst: "0",
      travelAllowance: { mode: "manual" },
      siteAddressProof: proof,
    },
  },
};
const customerView = {
  travelContext: {
    schemaVersion: "studio_quote_travel.v1",
    destinationCanonical: "Original site",
  },
};
// Real new wrapper, deliberately small predecessor fixture. No actual-predecessor
// or multi-session PostgreSQL verification is claimed by this local harness.
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table public.projects(id uuid primary key,site_address text);
 create table public.quote_versions(id uuid primary key,quote_id uuid,client_intent_id text);
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
 return q;end $$;`);
  await db.exec(migration);
});
beforeEach(async () => {
  await db.exec(
    "truncate public.quote_versions,public.projects,private.test_effects,private.studio_website_quote_snapshots",
  );
  await db.query("insert into public.projects values($1,$2)", [
    project,
    "Original site",
  ]);
  await db.query(
    "insert into private.studio_website_quote_snapshots values($1,$2,$3,$4,$5)",
    [snapshot, "hash", project, authored, customerView],
  );
});
afterAll(() => db.close());
const command = (intent = "same", extra = {}) => ({
  id: "10000000-0000-4000-8000-000000000004",
  p_quote_id: quote,
  p_client_intent_id: intent,
  ...extra,
});
const commit = (operation = "create", body = command()) =>
  db.query("select public.studio_website_quote_commit_address($1,$2,$3,$4)", [
    operation,
    snapshot,
    "hash",
    body,
  ]);
it("uses a distinct service-only RPC and FOR SHARE while leaving predecessor definition unchanged", () => {
  expect(migration).toContain(
    "create function public.studio_website_quote_commit_address(",
  );
  expect(migration).toContain(
    "from public.projects where id=s.project_id for share",
  );
  expect(migration).toContain(
    "grant execute on function public.studio_website_quote_commit_address(text,uuid,text,jsonb) to service_role",
  );
  expect(migration).not.toContain(
    "create or replace function public.studio_website_quote_commit(",
  );
});
it("accepts a new manual-zero quote only with matching independent proof and frozen own destination", async () => {
  await expect(commit()).resolves.toBeDefined();
  expect(
    (await db.query("select * from public.quote_versions")).rows,
  ).toHaveLength(1);
});
it("rejects missing proof even for manual zero and rolls back delegated effects", async () => {
  await db.query(
    "update private.studio_website_quote_snapshots set authored=authored #- '{site,values,siteAddressProof}'",
  );
  await expect(commit()).rejects.toThrow(/studio_site_address_required/);
  expect(
    (await db.query("select * from private.test_effects")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.quote_versions")).rows,
  ).toHaveLength(0);
});
it("rejects wrong-project proof, missing marker, pending travel and mismatched automatic destination", async () => {
  const changes = [
    {
      authored: {
        site: {
          values: {
            ...authored.site.values,
            siteAddressProof: { ...proof, projectId: "other" },
          },
        },
      },
      customerView,
    },
    { authored, customerView: {} },
    {
      authored: {
        site: {
          values: {
            ...authored.site.values,
            travelAllowance: { mode: "pending" },
          },
        },
      },
      customerView,
    },
    {
      authored: {
        site: {
          values: {
            ...authored.site.values,
            travelAllowance: {
              mode: "automatic",
              receipt: { destinationCanonical: "Other site" },
            },
          },
        },
      },
      customerView,
    },
  ];
  for (const changed of changes) {
    await db.query(
      "update private.studio_website_quote_snapshots set authored=$1,customer_view=$2",
      [changed.authored, changed.customerView],
    );
    await expect(commit()).rejects.toThrow(/studio_(site_address|travel_)/);
  }
  expect(
    (await db.query("select * from public.quote_versions")).rows,
  ).toHaveLength(0);
});
it("rolls back fresh manual create/refresh after a late canonical address change", async () => {
  for (const operation of ["create", "refresh"])
    await expect(
      commit(operation, command("late", { test_late_address: "Changed site" })),
    ).rejects.toThrow(/studio_site_address_changed/);
  expect(
    (await db.query("select * from private.test_effects")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select site_address from public.projects")).rows[0],
  ).toEqual({ site_address: "Original site" });
});
it("preserves exact committed retry and historical revise without current proof/address", async () => {
  await commit();
  await db.query(
    "update private.studio_website_quote_snapshots set authored='{}',customer_view='{}'",
  );
  await db.query("update public.projects set site_address='Later site'");
  await expect(commit()).resolves.toBeDefined();
  await expect(
    commit(
      "revise",
      command("revise", { id: "10000000-0000-4000-8000-000000000005" }),
    ),
  ).resolves.toBeDefined();
});
