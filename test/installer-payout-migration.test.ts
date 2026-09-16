// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
const project = '11111111-1111-4111-8111-111111111111';
const quote = '22222222-2222-4222-8222-222222222222';
const estimate = '33333333-3333-4333-8333-333333333333';
const id = '44444444-4444-4444-8444-444444444444';
it('enforces append-only agreements, retries, stale writes, GST, accepted scope and staff redaction', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select '${id}'::uuid $$;
      create function public.is_portal_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true) = 'yes' $$;
      create function public.has_portal_access() returns boolean language sql stable as $$ select current_setting('test.access',true) = 'yes' $$;
      create table projects(id uuid primary key); insert into projects values('${project}');
      create table quote_versions(id uuid primary key,source_estimate_version_id uuid); insert into quote_versions values('${quote}','${estimate}');
      create function commercial_current_accepted_quote_versions(uuid) returns table(quote_version_id uuid) language sql as $$ select id from public.quote_versions $$;
      set test.admin='yes'; set test.access='yes';`);
    await db.exec(readFileSync('supabase/migrations/20260911000001_installer_payout_workflow.sql', 'utf8'));
    const payload = { installer: 'Test crew', scope: 'Erection', paymentTerms: 'After completion', acceptanceReference: 'Agreed 11 Sep', gstRegistered: true, sourceQuoteId: quote, sourceEstimateId: estimate, payoutExGst: 1886.96, gst: 283.04, totalPayable: 2170, internal: { config: 'private' } };
    const append = (eventId: string, seq: number, kind: string, data: unknown) => db.query('select installer_payout_append($1,$2,$3,$4,$5)', [project,eventId,seq,kind,JSON.stringify(data)]);
    await db.exec('set role authenticated');
    await expect(append(id,0,'agreement',{...payload,sourceEstimateId:id})).rejects.toThrow('Accepted quote changed');
    await append(id,0,'agreement',payload);
    await append(id,0,'agreement',payload);
    await expect(append(id,0,'agreement',{...payload,installer:'Changed'})).rejects.toThrow('Command');
    const v = '55555555-5555-4555-8555-555555555555';
    await expect(append(v,0,'variation',{reference:'V1'})).rejects.toThrow('Stale');
    await expect(append(v,1,'agreement',payload)).rejects.toThrow('cannot be replaced');
    await expect(append(v,1,'variation',{reference:'V1',reason:'Extra',payoutExGst:100,gst:0,totalPayable:100})).rejects.toThrow('GST');
    await append(v,1,'variation',{reference:'V1',reason:'Extra',payoutExGst:100,gst:15,totalPayable:115});
    await expect(append('66666666-6666-4666-8666-666666666666',2,'variation',{reference:'v1'})).rejects.toThrow('Duplicate');
    await expect(db.exec(`update project_installer_payout_events set kind='invoice'`)).rejects.toThrow('permission');
    await db.exec("set test.admin='no'");
    expect((await db.query('select * from project_installer_payout_events')).rows).toHaveLength(0);
    const visible = await db.query<{payload: Record<string,unknown>}>('select * from installer_payout_read($1)',[project]);
    expect(visible.rows).toHaveLength(2); expect(visible.rows[0].payload.internal).toBeUndefined();
    await expect(append(v,2,'invoice',{})).rejects.toThrow('Admin');
    await db.exec("set test.access='no'");
    await expect(db.query('select * from installer_payout_read($1)',[project])).rejects.toThrow('Forbidden');
  } finally { await db.close(); }
},30000);
