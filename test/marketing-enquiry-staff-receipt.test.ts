// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('allows staff to read only the requested project receipt without private delivery or cost fields', async () => {
  const db = new PGlite();
  const project = '11111111-1111-4111-8111-111111111111';
  const enquiry = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema private;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.staff_uid',true),'')::uuid $$;
      create function public.has_portal_access() returns boolean language sql as $$ select current_setting('test.staff',true)='yes' $$;
      create table public.enquiry_requests(id uuid,project_id uuid,created_at timestamptz default now(),raw_payload jsonb);
      create table public.email_outbox(id uuid,status text);
      create table public.background_jobs(id uuid,status text);
      create table private.marketing_enquiry_deliveries(enquiry_request_id uuid,outbox_id uuid,draft_estimate jsonb,message jsonb,job_id uuid);
    `);
    await db.exec(readFileSync('supabase/migrations/20260914062002_marketing_enquiry_staff_receipt.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20260914062003_marketing_enquiry_delivery_status.sql', 'utf8'));
    const original = { customerBrief: { summary: 'Original design' }, projectPreferences: { preferredTiming: 'Summer' }, submittedPrice: { baseRange: { lowIncGst: 12000, highIncGst: 12000 }, includesGst: true } };
    await db.query('insert into enquiry_requests(id,project_id,raw_payload) values($1,$2,$3)', [enquiry,project,JSON.stringify({ customerBrief: { summary: 'Changed raw value' }, message: 'Please call', requestType: 'site-measure' })]);
    await db.query('insert into email_outbox values($1,$2)',[enquiry,'SENT']);
    await db.query('insert into private.marketing_enquiry_deliveries values($1,$1,$2,$3,$1)',[enquiry,JSON.stringify({ outputs: { snapshot: original, materials: { secretCost: 4000 } } }),JSON.stringify({secretProviderPayload:'private'})]);
    await db.query('insert into background_jobs values($1,$2)',[enquiry,'needs_attention']);
    const read = (id = project) => db.query<{ receipt: unknown[] }>('select marketing_enquiry_staff_receipts($1) receipt',[id]);
    await expect(read()).rejects.toThrow('Forbidden');
    await db.exec(`set test.staff_uid='${enquiry}'; set test.staff='no';`);
    await expect(read()).rejects.toThrow('Forbidden');
    await db.exec("set test.staff='yes'; set role authenticated");
    const result = (await read()).rows[0].receipt;
    expect(result).toEqual([expect.objectContaining({ customerBrief: original.customerBrief, preferences: original.projectPreferences, submittedPrice: original.submittedPrice, receiptFrozen:true,emailStatus:'SENT',requestType:'site-measure' })]);
    expect(result[0]).toMatchObject({ deliveryStatus: 'needs_attention' });
    expect(JSON.stringify(result)).not.toMatch(/secretCost|secretProviderPayload|Changed raw value|job_id|"lease/);
    expect((await read(enquiry)).rows[0].receipt).toEqual([]);
    await expect(db.query('select * from private.marketing_enquiry_deliveries')).rejects.toThrow();
    await db.exec('reset role; set role anon');
    await expect(read()).rejects.toThrow('permission denied');
  } finally { await db.close(); }
}, 30_000);
