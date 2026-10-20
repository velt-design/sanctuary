// @vitest-environment node
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { marketingEnquiryTestIntakeSql } from '../scripts/lib/marketing-enquiry-test-intake.mjs';
import { DEFAULT_PREVIEW_DRAFT } from '../apps/marketing/components/configurator-prototype/previewDraft';

const previousPath = 'supabase/migrations/20260915080001_marketing_enquiry_optional_phone.sql';
const migrationPath = 'supabase/migrations/20261015000001_marketing_google_funnel_optional_phone.sql';
const metaMigrationPath = 'supabase/migrations/20261016000001_marketing_meta_funnel_optional_phone.sql';
const aluminiumMigrationPath = 'supabase/migrations/20261020020001_marketing_aluminium_optional_phone.sql';
const customMigrationPath = 'supabase/migrations/20261020030001_marketing_custom_optional_phone.sql';
const channelMigrationPath = 'supabase/migrations/20261020000001_marketing_facebook_channel_optional_phone.sql';
const source = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const h = vi.hoisted(() => ({ getClient: vi.fn(), send: vi.fn(), recordConversion: vi.fn() }));

// Only external services/pricing and post-intake side effects are replaced.
// Native fallback, API validation/normalization, intake adapter and SQL are real.
vi.mock('@/lib/supabaseService', () => ({ getServiceSupabase: h.getClient }));
vi.mock('../apps/marketing/lib/publishedEnquiryPricingSnapshot.server', () => ({
  buildPublishedEnquiryPricingSnapshot: vi.fn(async () => ({
    budgets: { baseRange: null, blindsRange: null, budgetBasis: null },
    verifiedSimpleCover: null, pricingSource: 'unavailable',
  })),
}));
vi.mock('../apps/marketing/lib/enquiryPricingSnapshot', () => ({ buildEnquiryDraftEstimateRow: vi.fn(() => ({})) }));
vi.mock('../apps/portal/lib/marketingAttribution/server', async importOriginal => ({
  ...await importOriginal<typeof import('../apps/portal/lib/marketingAttribution/server')>(),
  recordMarketingConversionEvent: h.recordConversion,
}));
vi.mock('@/lib/email/sendCustomerAutoresponder', () => ({ sendCustomerAutoresponder: h.send, prepareCustomerAutoresponder: vi.fn() }));
vi.mock('../apps/marketing/lib/enquiryEmailPreparation', () => ({
  prepareEnquiryEmail: vi.fn(async () => ({
    emailPayload: {}, resolvedAttachments: { attachments: [] }, templateId: 'TEST',
    subject: 'Synthetic', emailType: 'TEST', variables: {},
  })),
}));

async function createDatabase() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role; create table projects(id uuid primary key);');
  await db.exec(source('supabase/tests/marketing_enquiry_delivery_bootstrap.sql'));
  // Built-in gen_random_uuid is available; this harness needs no pgcrypto/PGMQ.
  await db.exec(source('supabase/enquiry_requests.sql').replace('create extension if not exists pgcrypto;', ''));
  await db.exec(marketingEnquiryTestIntakeSql(process.cwd()));
  await db.exec(source(previousPath));
  return db;
}

it('changes only the scoped eligibility predicate and rehearses the exact migration and rollback contracts', async () => {
  const oldSql = source(previousPath).slice(source(previousPath).indexOf('create or replace function'));
  const newSql = source(migrationPath).slice(source(migrationPath).indexOf('create or replace function'));
  expect(newSql.replace(
    "       and (\n         jsonb_typeof(p_payload->'rawPayload'->'customerBrief'->'design') = 'object'\n         or p_payload->>'page' in ('/ads/outdoor-living', '/ads/acrylic-pergolas')\n       ),",
    "       and jsonb_typeof(p_payload->'rawPayload'->'customerBrief'->'design') = 'object',",
  )).toBe(oldSql);
  const db = await createDatabase();
  try {
    const definition = async () => (await db.query("select pg_get_functiondef('public.marketing_enquiry_intake(uuid,text,jsonb)'::regprocedure) body")).rows[0].body;
    const previous = await definition();
    await db.exec(`begin;\n${source(migrationPath)}\nrollback;`);
    expect(await definition()).toBe(previous);
    await db.exec(source(migrationPath));
    await db.exec(source('supabase/tests/marketing_enquiry_optional_phone.sql'));
    await db.exec(source('supabase/tests/marketing_google_funnel_optional_phone.sql'));
    for (const table of ['contacts', 'projects', 'enquiry_requests', 'email_outbox']) {
      expect((await db.query(`select count(*)::int n from public.${table}`)).rows).toEqual([{ n: 0 }]);
    }
    expect((await db.query("select to_regprocedure('public.test_google_enquiry_failure()') fixture")).rows).toEqual([{ fixture: null }]);
  } finally { await db.close(); }
}, 30_000);

it('extends only the two Meta route literals and preserves rollback and the guarded intake', async () => {
  const oldSql = source(migrationPath).slice(source(migrationPath).indexOf('create or replace function'));
  const newSql = source(metaMigrationPath).slice(source(metaMigrationPath).indexOf('create or replace function'));
  expect(newSql.replace(", '/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland'", '').trimEnd()).toBe(oldSql.trimEnd());
  const db = await createDatabase();
  try {
    await db.exec(source(migrationPath));
    const definition = async () => (await db.query("select pg_get_functiondef('public.marketing_enquiry_intake(uuid,text,jsonb)'::regprocedure) body")).rows[0].body;
    const previous = await definition();
    await db.exec(`begin;\n${source(metaMigrationPath)}\nrollback;`);
    expect(await definition()).toBe(previous);
    await db.exec(source(metaMigrationPath));
    await db.exec(source('supabase/tests/marketing_meta_funnel_optional_phone.sql'));
    for (const table of ['contacts', 'projects', 'enquiry_requests', 'email_outbox']) {
      expect((await db.query(`select count(*)::int n from public.${table}`)).rows).toEqual([{ n: 0 }]);
    }
  } finally { await db.close(); }
}, 30_000);

it('extends only the two Facebook channel routes and preserves exact SQL rollback/contracts', async () => {
  const oldSql = source(metaMigrationPath).slice(source(metaMigrationPath).indexOf('create or replace function'));
  const newSql = source(channelMigrationPath).slice(source(channelMigrationPath).indexOf('create or replace function'));
  expect(newSql.replace(", '/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas'", '').trimEnd()).toBe(oldSql.trimEnd());
  const db = await createDatabase();
  try {
    await db.exec(source(metaMigrationPath));
    const definition = async () => (await db.query("select pg_get_functiondef('public.marketing_enquiry_intake(uuid,text,jsonb)'::regprocedure) body")).rows[0].body;
    const previous = await definition();
    await db.exec(`begin;\n${source(channelMigrationPath)}\nrollback;`);
    expect(await definition()).toBe(previous);
    await db.exec(source(channelMigrationPath));
    await db.exec(source('supabase/tests/marketing_meta_funnel_optional_phone.sql').replace(
      "array['/ads/outdoor-living', '/ads/acrylic-pergolas', '/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland']",
      "array['/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas']"));
    for (const table of ['contacts', 'projects', 'enquiry_requests', 'email_outbox']) {
      expect((await db.query(`select count(*)::int n from public.${table}`)).rows).toEqual([{ n: 0 }]);
    }
  } finally { await db.close(); }
}, 30_000);

it('extends only the aluminium route and preserves function security, rollback and contact contracts', async () => {
  const body = (path: string) => source(path).slice(source(path).indexOf('create or replace function')).trimEnd();
  expect(body(aluminiumMigrationPath).replace(", '/aluminium-pergolas-auckland'", '')).toBe(body(channelMigrationPath));
  const db = await createDatabase();
  try {
    await db.exec(source(channelMigrationPath));
    const definition = async () => (await db.query("select pg_get_functiondef('public.marketing_enquiry_intake(uuid,text,jsonb)'::regprocedure) body")).rows[0].body;
    const previous = await definition();
    await db.exec('begin;\n' + source(aluminiumMigrationPath) + '\nrollback;');
    expect(await definition()).toBe(previous);
    await db.exec(source(aluminiumMigrationPath));
    await db.exec(source('supabase/tests/marketing_aluminium_optional_phone.sql'));
    await db.exec(source('supabase/tests/marketing_enquiry_optional_phone.sql'));
    for (const table of ['contacts', 'projects', 'enquiry_requests', 'email_outbox']) {
      expect((await db.query(`select count(*)::int n from public.${table}`)).rows).toEqual([{ n: 0 }]);
    }
  } finally { await db.close(); }
}, 30_000);

it('extends only Custom discussion and preserves security, rollback, idempotency and existing contact contracts', async () => {
  const body = (path: string) => source(path).slice(source(path).indexOf('create or replace function')).trimEnd();
  expect(body(customMigrationPath).replace(", '/custom-pergolas-auckland'", '')).toBe(body(aluminiumMigrationPath));
  const db = await createDatabase();
  try {
    await db.exec(source(aluminiumMigrationPath));
    const definition = async () => (await db.query("select pg_get_functiondef('public.marketing_enquiry_intake(uuid,text,jsonb)'::regprocedure) body")).rows[0].body;
    const previous = await definition();
    await db.exec('begin;\n' + source(customMigrationPath) + '\nrollback;');
    expect(await definition()).toBe(previous);
    await db.exec(source(customMigrationPath));
    await db.exec(source('supabase/tests/marketing_custom_optional_phone.sql'));
    await db.exec(source('supabase/tests/marketing_enquiry_optional_phone.sql'));
    for (const table of ['contacts', 'projects', 'enquiry_requests', 'email_outbox']) {
      expect((await db.query(`select count(*)::int n from public.${table}`)).rows).toEqual([{ n: 0 }]);
    }
  } finally { await db.close(); }
}, 30_000);

describe('actual inline funnel API/native payload through the real intake function', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await createDatabase();
    await db.exec(source(migrationPath));
    await db.exec(source(metaMigrationPath));
    await db.exec(source(channelMigrationPath));
    await db.exec(source(aluminiumMigrationPath));
    await db.exec(source(customMigrationPath));
  }, 30_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await db.exec('begin');
    vi.stubEnv('WEBSITE_ENQUIRY_DURABLE_DELIVERY', 'false');
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External network prohibited in disposable intake test'); }));
    h.send.mockClear(); h.recordConversion.mockClear();
    h.getClient.mockReturnValue({
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === 'marketing_public_rate_limit_take') return { data: [{ allowed: true }], error: null };
        if (name !== 'marketing_enquiry_intake') throw new Error(`Unexpected RPC ${name}`);
        try {
          // The existing service-only security-definer function owns these writes.
          await db.exec('savepoint intake; set local role service_role');
          const result = await db.query('select * from public.marketing_enquiry_intake($1,$2,$3)',
            [args.p_submission_id, args.p_upload_token_hash, JSON.stringify(args.p_payload)]);
          await db.exec('reset role; release savepoint intake');
          return { data: result.rows, error: null };
        } catch (error) {
          await db.exec('rollback to savepoint intake; reset role; release savepoint intake');
          return { data: null, error };
        }
      },
      // Post-intake estimate/audit writes are outside this SQL acceptance test.
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'fixture-estimate' }, error: null }) }) }),
        upsert: async () => ({ error: null }),
      }),
    });
  });
  afterEach(async () => { await db.exec('rollback'); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each(['/aluminium-pergolas-auckland', '/custom-pergolas-auckland'])('rejects incomplete or wrongly scoped %s requests before intake', async page => {
    const { POST } = await import('../apps/marketing/app/api/enquiry/route');
    const base = { submissionId: randomUUID(), enquiryType: 'residential', page,
      requestType: 'project-discussion', name: 'Synthetic', email: 'fixture@example.invalid', phone: '', suburb: 'Albany' };
    for (const patch of [{ phone: 'invalid' }, { enquiryType: 'commercial' }, { enquiryType: 'professional' },
      { page: `${page}-extra` }, { page: '/contact' }, { requestType: '' },
      { requestType: 'site-measure' }, { name: '' }, { email: '' }, { suburb: '' }]) {
      const response = await POST(new Request('http://localhost/api/enquiry', { method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ ...base, ...patch }) }));
      expect(response.status).toBe(422);
    }
    expect((await db.query('select count(*)::int n from enquiry_requests')).rows).toEqual([{ n: 0 }]);
    expect(h.send).not.toHaveBeenCalled();
  });

  for (const page of ['/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas', '/ads/outdoor-living', '/ads/acrylic-pergolas', '/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland']) {
    it.each([false, true])(`${page} accepts blank-phone JSON, configured=%s, preserving truthful receipt and retry`, async configured => {
      const { POST } = await import('../apps/marketing/app/api/enquiry/route');
      const payload = {
        submissionId: randomUUID(), enquiryType: 'residential', page, requestType: 'project-discussion',
        name: 'Synthetic Google enquiry', email: 'google-fixture@example.invalid', phone: '', suburb: 'Albany',
        ...(configured ? { customerDesign: DEFAULT_PREVIEW_DRAFT } : {}),
      };
      const request = () => new Request('http://localhost/api/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(payload),
      });
      expect((await POST(request())).status).toBe(200);
      const receipt = (await db.query<{ raw_payload: { customerBrief: { design?: unknown }; requestType: string }; page: string }>('select page,raw_payload from enquiry_requests')).rows[0];
      expect(receipt).toMatchObject({ page, raw_payload: { requestType: 'project-discussion' } });
      expect(Boolean(receipt.raw_payload.customerBrief.design)).toBe(configured);
      expect((await db.query('select phone from contacts')).rows).toEqual([{ phone: null }]);
      expect(await (await POST(request())).json()).toMatchObject({ ok: true, idempotentReplay: true });
      expect((await db.query('select count(*)::int n from enquiry_requests')).rows).toEqual([{ n: 1 }]);
      expect(h.send).toHaveBeenCalledTimes(1); // Mock transport only, never a provider.
    });

    it(`${page} preserves native discussion intent through fallback/API/SQL without inventing a design`, async () => {
      const { POST } = await import('../apps/marketing/app/api/enquiry/fallback/route');
      const response = await POST(new Request('http://localhost/api/enquiry/fallback', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', origin: 'http://localhost' },
        body: new URLSearchParams({ enquiryType: 'residential', page, requestType: 'project-discussion',
          name: 'Native Google fixture', email: 'native-fixture@example.invalid', phone: '', suburb: 'Albany' }),
      }));
      expect(response.status).toBe(303);
      expect((await db.query('select phone from contacts')).rows).toEqual([{ phone: null }]);
      const receipt = (await db.query<{ raw_payload: { requestType: string; customerBrief: { design?: unknown } } }>('select raw_payload from enquiry_requests')).rows[0];
      expect(receipt.raw_payload.requestType).toBe('project-discussion');
      expect(receipt.raw_payload.customerBrief.design).toBeFalsy();
    });
  }
});
