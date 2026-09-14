// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { marketingEnquiryTestIntakeSql } from '../scripts/lib/marketing-enquiry-test-intake.mjs';

it('runs the exact intake function with replay and upload-session validation', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create table projects(id uuid primary key);');
    await db.exec(readFileSync('supabase/tests/marketing_enquiry_delivery_bootstrap.sql', 'utf8'));
    // PGlite supplies gen_random_uuid but not the external pgcrypto extension.
    await db.exec(readFileSync('supabase/enquiry_requests.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(marketingEnquiryTestIntakeSql(process.cwd()));
    const body = { enquiryType: 'residential', name: 'Intake fixture', email: 'INTAKE@example.test', phone: '+6400000002', files: [], rawPayload: { original: true } };
    const submit = (id: string, payload: unknown) => db.query('select * from marketing_enquiry_intake($1,$2,$3)', [id, '', JSON.stringify(payload)]);
    const id = '11111111-1111-4111-8111-111111111111';
    const first = await submit(id, body);
    const replay = await submit(id, { ...body, rawPayload: { original: false } });
    expect(replay.rows[0]).toEqual({ ...first.rows[0], already_existed: true });
    expect((await db.query('select email from contacts')).rows).toEqual([{ email: 'intake@example.test' }]);
    expect((await db.query('select raw_payload from enquiry_requests')).rows).toEqual([{ raw_payload: { original: true } }]);
    await expect(submit('22222222-2222-4222-8222-222222222222', { ...body, files: [{ name: 'plan.pdf', path: 'unverified/plan.pdf', type: 'application/pdf', size: 42 }] })).rejects.toThrow('invalid_upload_session');
    expect((await db.query('select count(*)::int n from projects')).rows).toEqual([{ n: 1 }]);
  } finally { await db.close(); }
}, 30000);
