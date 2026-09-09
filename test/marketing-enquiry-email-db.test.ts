// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const database = new PGlite();
const migration = readFileSync('supabase/migrations/20260909000001_marketing_enquiry_email_correlation.sql', 'utf8');
const reference = '31111111-1111-4111-8111-111111111111';
const enquiry = '11111111-1111-4111-8111-111111111111';
const submission = '21111111-1111-4111-8111-111111111111';
const hash = 'a'.repeat(64);
const begin = (ref = reference, enq = enquiry, sub = submission, digest = hash) => database.query<{ claimed: boolean }>(
  'select public.marketing_enquiry_email_begin($1,$2,$3,$4) as claimed', [ref, enq, sub, digest],
);
const record = (outcome: string, id: string | null, code: string, ref = reference, digest = hash) => database.query(
  'select public.marketing_enquiry_email_record($1,$2,$3,$4,$5)', [ref, digest, outcome, id, code],
);
const read = (ref = reference) => database.query<Record<string, unknown>>('select * from public.marketing_enquiry_email_read($1)', [ref]);

describe('isolated enquiry email SQL boundary', () => {
  beforeAll(async () => {
    await database.exec(readFileSync('supabase/tests/marketing_enquiry_email_bootstrap.sql', 'utf8'));
    await database.exec('begin');
    await database.exec(migration);
    await database.exec('rollback');
    expect((await database.query<{ absent: boolean }>("select to_regclass('private.marketing_enquiry_email_intents') is null as absent")).rows[0].absent).toBe(true);
    await database.exec(migration);
  });
  afterAll(async () => { await database.close(); });

  it('grants only the three narrow RPCs to service_role, no direct table access to any app role', async () => {
    const result = await database.query<{ role: string; table_access: boolean; rpc_access: boolean }>(`
      select role,
        has_table_privilege(role, 'private.marketing_enquiry_email_intents', 'SELECT,INSERT,UPDATE,DELETE')
        or has_table_privilege(role, 'private.marketing_enquiry_email_receipts', 'SELECT,INSERT,UPDATE,DELETE') as table_access,
        has_function_privilege(role, 'public.marketing_enquiry_email_begin(uuid,uuid,uuid,text)', 'EXECUTE')
        and has_function_privilege(role, 'public.marketing_enquiry_email_record(uuid,text,text,text,text)', 'EXECUTE')
        and has_function_privilege(role, 'public.marketing_enquiry_email_read(uuid)', 'EXECUTE') as rpc_access
      from unnest(array['anon','authenticated','service_role']) as role;
    `);
    expect(result.rows).toEqual([
      { role: 'anon', table_access: false, rpc_access: false },
      { role: 'authenticated', table_access: false, rpc_access: false },
      { role: 'service_role', table_access: false, rpc_access: true },
    ]);
    for (const role of ['anon', 'authenticated']) {
      await database.exec(`set role ${role}`);
      await expect(read()).rejects.toThrow(/permission denied/);
      await database.exec('reset role');
    }
    await database.exec('set role service_role');
    await expect(database.query('select * from private.marketing_enquiry_email_intents')).rejects.toThrow(/permission denied/);
    await database.exec('reset role');
  });

  it('rejects forged canonical bindings and malformed hash/reference; missing lookup is empty', async () => {
    await expect(begin(reference, enquiry, '22222222-2222-4222-8222-222222222222')).rejects.toThrow('ENQUIRY_EMAIL_IDENTITY_INVALID');
    await expect(begin(reference, enquiry, submission, 'bad')).rejects.toThrow(/check constraint/);
    await expect(begin('31111111-1111-1111-8111-111111111111')).rejects.toThrow(/check constraint/);
    expect((await read()).rows).toEqual([]);
    await expect(record('accepted', 'api-1', 'RESEND_ACCEPTED')).rejects.toThrow('ENQUIRY_EMAIL_INTENT_MISSING');
  });

  it('allows exactly one claim and preserves unknown after a crash with no receipt', async () => {
    await database.exec('set role service_role');
    const results = await Promise.all([begin(), begin(), begin('32222222-2222-4222-8222-222222222222')]);
    expect(results.map((result) => result.rows[0].claimed)).toEqual([true, false, false]);
    const row = (await read()).rows[0];
    expect(row).toMatchObject({ enquiry_request_id: enquiry, submission_id: submission, outcome: 'unknown', code: 'ENQUIRY_EMAIL_RECEIPT_MISSING', provider_api_message_id: null, rfc_message_id: null, payload_hash: hash });
    expect((await begin(reference, enquiry, submission, 'b'.repeat(64))).rows[0].claimed).toBe(false);
    await database.exec('reset role');
  });

  it('records acceptance once, returns exact replay and rejects conflicting/fabricated receipts', async () => {
    await expect(record('accepted', 'api-1', 'RESEND_ACCEPTED', reference, 'b'.repeat(64))).rejects.toThrow('ENQUIRY_EMAIL_INTENT_MISSING');
    await expect(record('failed', null, 'RESEND_TIMEOUT')).rejects.toThrow(/check constraint/);
    await expect(record('accepted', null, 'RESEND_ACCEPTED')).rejects.toThrow(/check constraint/);
    await record('accepted', 'api-1', 'RESEND_ACCEPTED');
    await record('accepted', 'api-1', 'RESEND_ACCEPTED');
    await expect(record('accepted', 'api-2', 'RESEND_ACCEPTED')).rejects.toThrow('ENQUIRY_EMAIL_RECEIPT_CONFLICT');
    await expect(record('failed', null, 'RESEND_AUTH_REJECTED')).rejects.toThrow('ENQUIRY_EMAIL_RECEIPT_CONFLICT');
    expect((await read()).rows[0]).toMatchObject({ outcome: 'accepted', provider_api_message_id: 'api-1', rfc_message_id: null });
  });

  it('preserves append-only evidence and denies a provider identifier linked to another intent', async () => {
    await begin('32222222-2222-4222-8222-222222222222', '12222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');
    await expect(record('accepted', 'api-1', 'RESEND_ACCEPTED', '32222222-2222-4222-8222-222222222222')).rejects.toThrow(/unique constraint/);
    await record('unknown', null, 'RESEND_IDEMPOTENCY_IN_PROGRESS', '32222222-2222-4222-8222-222222222222');
    for (const table of ['marketing_enquiry_email_intents', 'marketing_enquiry_email_receipts']) {
      await expect(database.exec(`delete from private.${table}`)).rejects.toThrow('ENQUIRY_EMAIL_IMMUTABLE');
    }
    await expect(database.exec("update private.marketing_enquiry_email_intents set payload_hash = repeat('b',64)")).rejects.toThrow('ENQUIRY_EMAIL_IMMUTABLE');
    await expect(database.exec("update private.marketing_enquiry_email_receipts set provider_api_message_id = 'changed'")).rejects.toThrow('ENQUIRY_EMAIL_IMMUTABLE');
    await expect(database.query('delete from public.enquiry_requests where id = $1', [enquiry])).rejects.toThrow(/foreign key constraint/);
    expect((await database.query<{ count: number }>('select count(*)::int as count from public.enquiry_requests')).rows[0].count).toBe(3);
  });
});
