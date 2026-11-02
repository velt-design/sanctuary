// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import { paymentConversionMigration, paymentId as id, paymentSql, preparePaymentConversions, seedPaymentProject } from './fixtures/verified-payment-conversion-db';
import { prepareGa4MarketingEvent, processMarketingConversionDeliveries } from '../apps/marketing/lib/marketingConversionDelivery';

let db: PGlite;
const events = async () => (await db.query<{id: string;created_at: string;payload: Record<string, any>}>(
  "select id,created_at::text,payload from audit_events where type='marketing.deposit_received' order by idempotency_key")).rows;
const outbox = async () => (await db.query<{status: string;attempt_count: number}>(
  'select status,attempt_count from marketing_conversion_deliveries')).rows;
const mark = (family = 1, age = "interval '1 hour'") => db.query(
  `select * from commercial_mark_invoice_paid_with_project_lock($1,$2,now()-(${age}),null,null,null)`, [id(3000 + family), id(99)]);
const ledger = (entry: number, project = 1, age = "interval '1 hour'", invoice: number | null = null) => db.exec(
  `insert into project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at,source_invoice_id)
  values('${id(entry)}','${id(project)}','PAYMENT',4000,now()-${age},${invoice ? `'${id(3000 + invoice)}'` : 'null'});`);
const allocate = (entry: number, family = 1, project = 1, term = 'deposit') => db.query(
  'select commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)', [id(entry), [{quote_version_id: id(2000 + family), payment_term_id: term, amount_inc_gst_cents: 4000}], 'Synthetic allocation', id(99)]);
const reverse = (entry: string) => db.query('select commercial_reverse_payment_entry_with_project_lock($1,$2,$3)', [entry, 'Synthetic reversal', id(99)]);
function senderDatabase(failCompletion = false) {
  return { rpc: async (name: string, params: Record<string, any>) => {
    if (name === 'marketing_conversion_delivery_claim') return {data: JSON.parse(JSON.stringify((await db.query('select * from marketing_conversion_delivery_claim($1,$2)',[params.p_limit,params.p_lease_seconds])).rows)),error: null};
    if (failCompletion) return {data: null,error: {message: 'Synthetic completion outage'}};
    const result=await db.query('select marketing_conversion_delivery_complete($1,$2,$3,$4,$5,$6)',[params.p_delivery_id,params.p_lease_token,params.p_outcome,params.p_error_code,params.p_provider_status,params.p_retry_after_seconds]);
    return {data: result.rows,error:null};
  }};
}

describe('verified payments atomically create source-owned conversion events', () => {
  beforeAll(async () => {
    db = new PGlite();
    await preparePaymentConversions(db);
    await db.exec(`begin;${paymentSql(paymentConversionMigration)} rollback;`);
    expect((await db.query("select to_regprocedure('private.marketing_enqueue_verified_deposit(uuid,uuid,boolean,uuid)') v")).rows[0]).toEqual({v: null});
    await db.exec(paymentSql(paymentConversionMigration));
  }, 30000);
  beforeEach(async () => {
    await db.exec('rollback');
    await db.exec(`truncate public.xero_deposit_matches,public.xero_payment_approvers,auth.users,public.projects,public.quotes,public.quote_versions,
      public.deposit_invoices,public.project_payment_entries,public.project_payment_allocations,public.project_invoice_plan_items,public.audit_events,
      public.enquiry_requests,public.marketing_conversion_deliveries,public.project_operational_states,private.project_sales_outcomes cascade;
      insert into auth.users(id) values('${id(99)}');
      insert into xero_payment_approvers(user_id,granted_by) values('${id(99)}','Synthetic fixture');`);
    await seedPaymentProject(db);
  });
  afterEach(async () => { await db.exec('rollback'); vi.unstubAllEnvs(); });
  afterAll(async () => db?.close());

  it('connects whole-invoice recording to one durable event and sender-safe GA4 payload', async () => {
    await mark();
    const [event] = await events();
    expect(event.payload).toMatchObject({producer: 'verified-payment-v1',quoteId: id(1),quoteVersionId: id(2001),valueIncGstCents: 20001});
    expect(event.payload.attribution).toMatchObject({analyticsClientId: '123.456',consent: {analytics: true,marketing: true}});
    expect(JSON.stringify(event.payload)).not.toMatch(/private@example|never-copy-this|gclid/);
    expect(await outbox()).toEqual([{status: 'PENDING',attempt_count: 0}]);
    const [claim] = (await db.query<any>('select * from marketing_conversion_delivery_claim(1,120)')).rows;
    const prepared = prepareGa4MarketingEvent(claim);
    expect(prepared).toMatchObject({kind: 'send',body: {client_id: '123.456',events: [{name: 'close_convert_lead',params: {value: 200.01,currency: 'NZD'}}]}});
    expect(new Date(event.created_at).getTime()).toBeLessThan(Date.now()-59*60000);
  });

  it('requires an allocated first-term positive receipt; unallocated and final-stage credit are not sales', async () => {
    await db.exec('delete from deposit_invoices');
    await ledger(40); expect(await events()).toEqual([]);
    await allocate(40,1,1,'final'); expect(await events()).toEqual([]);
    await allocate(40); expect(await events()).toHaveLength(1);
    expect((await db.query('select count(*)::int n from deposit_invoices')).rows[0]).toEqual({n: 0});
  });

  it('creates one event for a partial Xero deposit through the actual approval command', async () => {
    const context = (await db.query<any>('select xero_deposit_review_context($1) v',[id(3001)])).rows[0].v;
    const args = [id(50),id(99),id(98),id(51),id(97),id(1),id(3001),1,new Date().toISOString().slice(0,10),context.invoiceFingerprint,context.ledgerFingerprint,'a'.repeat(64),'Synthetic partial receipt'];
    await db.query('select xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',args);
    await db.query('select xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',args);
    expect(await events()).toHaveLength(1);expect(await outbox()).toHaveLength(1);
    expect((await db.query('select status from deposit_invoices where id=$1',[id(3001)])).rows[0]).toEqual({status: 'OPEN'});
  });

  it('deduplicates invoice replay, legacy old-app audit calls, and subsequent accepted revisions without rewriting evidence', async () => {
    await mark(); const original = await events();
    await mark();
    await db.query(`insert into audit_events(project_id,type,idempotency_key,payload) values($1,'marketing.deposit_received',$2,$3)`,
      [id(1),`marketing:marketing.deposit_received:${id(1)}:project`,{depositInvoiceId: id(3001),valueIncGstCents: 999}]);
    await db.exec(`update quote_versions set status='SUPERSEDED' where id='${id(2001)}';
      insert into quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
      values('${id(2010)}','${id(1)}',2,'ACCEPTED',now(),30000,26087,3913,'[{"id":"deposit","resolvedAmountIncGstCents":15000}]');`);
    expect(await events()).toEqual(original); expect(await outbox()).toHaveLength(1);
  });

  it('does not manufacture events from a PAID label, compatibility stage/date, adjustments, non-NZD or standalone payment', async () => {
    await db.exec(`update deposit_invoices set status='PAID',paid_at=now() where id='${id(3001)}';
      update projects set pipeline_stage='DEPOSIT',deposit_received_at=now() where id='${id(1)}';`);
    expect(await events()).toEqual([]);
    await db.exec(`update deposit_invoices set status='OPEN',currency='USD' where id='${id(3001)}';`);
    await ledger(40); await expect(allocate(40)).rejects.toThrow(/whole invoice/); expect(await events()).toEqual([]);
    await db.exec(`insert into project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at)
      values('${id(41)}','${id(1)}','ADJUSTMENT',-4000,now());`);
    expect(await events()).toEqual([]);
  });

  it('observes reversal before commit and preserves a previously recorded fact after a later reversal', async () => {
    await db.exec('delete from deposit_invoices');
    await db.exec('begin'); await ledger(40); await allocate(40); await reverse(id(40)); await db.exec('commit');
    expect(await events()).toEqual([]);
    await ledger(41); await allocate(41); const original = await events(); expect(original).toHaveLength(1);
    await reverse(id(41)); expect(await events()).toEqual(original);
  });

  it('records a newly verified late payment honestly, leaving EVENT_TOO_OLD to the existing sender', async () => {
    await mark(1,"interval '4 days'");
    const [claim] = (await db.query<any>('select * from marketing_conversion_delivery_claim(1,120)')).rows;
    expect(prepareGa4MarketingEvent(claim)).toEqual({kind: 'skip',errorCode: 'EVENT_TOO_OLD'});
    expect(new Date((await events())[0].created_at).getTime()).toBe(new Date(claim.event_timestamp).getTime());
  });

  it('does not unlock an unrelated old paid base when an add-on is newly paid', async () => {
    // Existing historical source with no event, as at deployment. No install sweep.
    await db.exec('alter table deposit_invoices disable trigger marketing_verified_deposit_invoices; alter table project_payment_entries disable trigger marketing_verified_payment_entries; alter table project_payment_allocations disable trigger marketing_verified_payment_allocations;');
    await mark(1,"interval '10 days'");
    await db.exec('alter table deposit_invoices enable trigger marketing_verified_deposit_invoices; alter table project_payment_entries enable trigger marketing_verified_payment_entries; alter table project_payment_allocations enable trigger marketing_verified_payment_allocations;');
    await seedPaymentProject(db,1,2); await mark(2);
    expect((await events()).map(e=>e.payload.quoteId)).toEqual([id(2)]);
    await db.exec(`update deposit_invoices set paid_at=paid_at where id='${id(3001)}';`);
    await db.query(`insert into audit_events(project_id,type,idempotency_key,payload) values($1,'marketing.deposit_received','synthetic-old-replay',$2)`,[id(1),{depositInvoiceId:id(3001)}]);
    expect((await events()).map(e=>e.payload.quoteId)).toEqual([id(2)]);
  });

  it('does not turn a second partial payment into a backfill of an old first deposit in the same family', async () => {
    const approve=async(receipt: number, date: string) => {
      const context=(await db.query<any>('select xero_deposit_review_context($1) v',[id(3001)])).rows[0].v;
      return db.query('select xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [id(receipt),id(99),id(98),id(receipt+100),id(97),id(1),id(3001),1000,date,context.invoiceFingerprint,context.ledgerFingerprint,'a'.repeat(64),'Synthetic staged receipt']);
    };
    await db.exec('alter table xero_deposit_matches disable trigger marketing_verified_xero_matches');
    await approve(70,new Date(Date.now()-10*86400000).toISOString().slice(0,10));
    await db.exec('alter table xero_deposit_matches enable trigger marketing_verified_xero_matches');
    await approve(71,new Date().toISOString().slice(0,10));
    expect(await events()).toEqual([]);expect(await outbox()).toEqual([]);
  });

  it('retains a legacy family audit and does not duplicate its outbox when later payment evidence arrives', async () => {
    await db.exec('alter table audit_events disable trigger marketing_deposit_event_source_guard');
    await db.query(`insert into audit_events(project_id,type,idempotency_key,payload) values($1,'marketing.deposit_received',$2,$3)`,[id(1),`marketing:marketing.deposit_received:${id(1)}:project`,{depositInvoiceId:id(3001)}]);
    await db.exec('alter table audit_events enable trigger marketing_deposit_event_source_guard');
    const original=await events(); await mark();expect(await events()).toEqual(original);expect(await outbox()).toHaveLength(1);
  });

  it('uses original enquiry analytics consent and identity; missing permission/identity skips safely', async () => {
    await db.exec(`update enquiry_requests set raw_payload='{"attribution":{"consent":{"analytics":false,"marketing":true},"analyticsClientId":"123.456"}}'`);
    await mark(); const [claim]=(await db.query<any>('select * from marketing_conversion_delivery_claim(1,120)')).rows;
    expect(prepareGa4MarketingEvent(claim)).toEqual({kind:'skip',errorCode:'ANALYTICS_CONSENT_NOT_GRANTED'});
    expect((await events())[0].payload.attribution.analyticsClientId).toBeNull();
  });

  it('records missing original identity for explicit sender skip rather than using contact/staff identity', async () => {
    await db.exec(`update enquiry_requests set raw_payload='{"attribution":{"consent":{"analytics":true,"marketing":false}}}'`);
    await mark(); const [claim]=(await db.query<any>('select * from marketing_conversion_delivery_claim(1,120)')).rows;
    expect(prepareGa4MarketingEvent(claim)).toEqual({kind:'skip',errorCode:'GA_CLIENT_ID_MISSING'});
    expect((await events())[0].payload.attribution.utm).toEqual({});
  });

  it('waits for an initial real acceptance and excludes future and standalone receipts', async () => {
    await db.exec(`update quote_versions set status='SENT',accepted_at=null`);
    await mark();expect(await events()).toEqual([]);
    await db.exec(`update quote_versions set status='ACCEPTED',accepted_at=now()`);
    expect(await events()).toHaveLength(1);
    await seedPaymentProject(db,2,2);await mark(2,"-interval '1 day'");
    expect(await events()).toHaveLength(1);
    await seedPaymentProject(db,3,3);
    await db.exec(`update deposit_invoices set quote_id=null,quote_version_id=null,quote_ref=null,quote_version_number=null,invoice_kind='STANDALONE' where id='${id(3003)}'`);
    await mark(3);expect(await events()).toHaveLength(1);
  });

  it('does not accept a caller-supplied source marker as payment evidence', async () => {
    await db.query(`insert into audit_events(project_id,type,idempotency_key,payload) values($1,'marketing.deposit_received','synthetic-forged-event',$2)`,
      [id(1),{producer:'verified-payment-v1',quoteId:id(1),valueIncGstCents:20001}]);
    expect(await events()).toEqual([]);expect(await outbox()).toEqual([]);
  });

  it('connects a payment through actual outbox claim/complete and bounded local transport retry', async () => {
    await mark();vi.stubEnv('VERCEL_ENV','production');
    const bodies:string[]=[];
    const first=await processMarketingConversionDeliveries({supabase:senderDatabase(),config:{measurementId:'G-SYNTHETIC',apiSecret:'synthetic-only'},limit:1,
      fetchImpl:async(_url,init)=>{bodies.push(String(init?.body));return new Response(null,{status:503});}});
    expect(first).toMatchObject({claimed:1,retrying:1});
    await db.exec("update marketing_conversion_deliveries set next_attempt_at=now()-interval '1 second'");
    const second=await processMarketingConversionDeliveries({supabase:senderDatabase(),config:{measurementId:'G-SYNTHETIC',apiSecret:'synthetic-only'},limit:1,
      fetchImpl:async(_url,init)=>{bodies.push(String(init?.body));return new Response(null,{status:204});}});
    expect(second).toMatchObject({claimed:1,sent:1});expect(bodies[1]).toBe(bodies[0]);
    expect(await outbox()).toEqual([{status:'SENT',attempt_count:2}]);expect(await events()).toHaveLength(1);
  });

  it('retains at-least-once provider semantics after an acknowledgement/checkpoint failure', async () => {
    await mark();vi.stubEnv('VERCEL_ENV','production');const bodies:string[]=[];
    const transport:typeof fetch=async(_url,init)=>{bodies.push(String(init?.body));return new Response(null,{status:204});};
    await expect(processMarketingConversionDeliveries({supabase:senderDatabase(true),config:{measurementId:'G-SYNTHETIC',apiSecret:'synthetic-only'},limit:1,fetchImpl:transport})).rejects.toThrow(/COMPLETE_FAILED/);
    await db.exec("update marketing_conversion_deliveries set lease_expires_at=now()-interval '1 second'");
    const retry=await processMarketingConversionDeliveries({supabase:senderDatabase(),config:{measurementId:'G-SYNTHETIC',apiSecret:'synthetic-only'},limit:1,fetchImpl:transport});
    expect(retry.sent).toBe(1);expect(bodies[1]).toBe(bodies[0]);expect(await events()).toHaveLength(1);expect(await outbox()).toHaveLength(1);
  });

  it('excludes confirmed tests and cancelled scopes before creating event/outbox', async () => {
    await db.exec(`insert into private.project_sales_outcomes values('${id(1)}','test')`);
    await mark();expect(await events()).toEqual([]);
    await seedPaymentProject(db,2,2);await db.exec(`insert into project_operational_states values('${id(2)}','CLOSED','CANCELLED')`);
    await mark(2);expect(await events()).toEqual([]);
  });

  it('suppresses verification-only enquiries and chooses the first real receipt on a mixed project', async () => {
    await db.exec(`update enquiry_requests set raw_payload='{"attribution":{"verification":true,"consent":{"analytics":true}}}'`);
    await mark();expect(await events()).toEqual([]);
    await db.exec(`insert into enquiry_requests(id,project_id,raw_payload) values('${id(5000)}','${id(1)}',
      '{"attribution":{"analyticsClientId":"321.654","consent":{"analytics":true,"marketing":false}}}');`);
    await db.query(`insert into audit_events(project_id,type,idempotency_key,payload) values($1,'marketing.deposit_received','synthetic-recovery',$2)`,[id(1),{depositInvoiceId:id(3001)}]);
    expect((await events())[0].payload.attribution.analyticsClientId).toBe('321.654');
    expect(await outbox()).toHaveLength(1);
  });

  it('rolls back the payment command if event/outbox persistence fails, and a retry creates exactly one pair', async () => {
    await db.exec(`create function public.synthetic_outbox_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic outbox outage'; end $$;
      create trigger synthetic_outbox_failure before insert on marketing_conversion_deliveries for each row execute function public.synthetic_outbox_failure();`);
    try {
      await expect(mark()).rejects.toThrow(/Synthetic outbox outage/);
      expect((await db.query('select count(*)::int n from project_payment_entries')).rows[0]).toEqual({n:0});
      expect(await events()).toEqual([]);expect(await outbox()).toEqual([]);
      expect((await db.query('select status from deposit_invoices where id=$1',[id(3001)])).rows[0]).toEqual({status:'OPEN'});
    } finally {await db.exec('drop trigger synthetic_outbox_failure on marketing_conversion_deliveries;drop function public.synthetic_outbox_failure()');}
    await mark();expect(await events()).toHaveLength(1);expect(await outbox()).toHaveLength(1);
  });

  it('keeps new source helpers inaccessible to application roles', async () => {
    for(const role of ['anon','authenticated','service_role']) {
      await db.exec(`set role ${role}`);
      try {await expect(db.query('select private.marketing_enqueue_verified_deposit($1,$2,true,null)',[id(1),id(1)])).rejects.toThrow(/permission denied/);}
      finally {await db.exec('reset role');}
    }
  });
});
