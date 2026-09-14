// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
const read=(name:string)=>readFileSync(`supabase/${name}`,'utf8').replace(/\r/g,'');
function command(source:string,name:string) {
  const start=source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`));
  if(start<0) throw new Error(`Missing actual SQL owner ${name}`);
  return source.slice(start,source.indexOf('\n$$;',start)+4).replace('create function','create or replace function');
}
const id=(n:number)=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
let db:PGlite;
async function context(invoice=1) { return (await db.query<{ c: { invoiceFingerprint:string;ledgerFingerprint:string;matchedCents:number;customerWon:boolean } }>('select public.xero_deposit_review_context($1) c',[id(invoice)])).rows[0].c; }
async function approve(approval=10,source=10,amount=4000,invoice=1,actor=99,snapshot?:Awaited<ReturnType<typeof context>>) {
  const evidence=snapshot??await context(invoice);
  return (await db.query<{ result:{matchId:string;paymentEntryId:string;replayed:boolean} }>(`select public.xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) result`,
    [id(approval),id(actor),id(98),id(source),id(97),id(invoice),id(invoice),amount,'2026-09-13',evidence.invoiceFingerprint,evidence.ledgerFingerprint,'a'.repeat(64),'Deposit reference'])).rows[0].result;
}
async function balance() { return (await db.query<{ net:number;entries:number;allocated:number;status:string }>(`select
  (select coalesce(sum(amount_inc_gst_cents),0)::int from public.project_payment_entries where project_id='${id(1)}') net,
  (select count(*)::int from public.project_payment_entries where project_id='${id(1)}') entries,
  (select coalesce(sum(amount_inc_gst_cents),0)::int from public.project_payment_allocations where project_id='${id(1)}' and reversed_at is null) allocated,
  (select status from public.deposit_invoices where id='${id(1)}') status`)).rows[0]; }
async function reverse(payment:string,actor=99) { return db.query('select public.commercial_reverse_payment_entry_with_project_lock($1,$2,$3)',[payment,'Correct mistaken deposit match',id(actor)]); }

describe('approved deposits use actual commercial SQL owners',()=>{
  beforeAll(async()=>{
    db=new PGlite(); await db.exec(read('tests/commercial_truth_invariants_bootstrap.sql'));
    await db.exec(`create table auth.users(id uuid primary key);
      alter table public.deposit_invoices add column invoice_kind text not null default 'QUOTE_LINKED';
      create unique index project_payment_entries_client_intent_unique on public.project_payment_entries(project_id,client_intent_id) where client_intent_id is not null;`);
    const reconciliation=read('migrations/20260810000004_admin_payment_reconciliation.sql');
    for(const name of ['commercial_replace_payment_allocations','commercial_reverse_payment_entry','commercial_audit_payment_entry','commercial_audit_payment_allocation','commercial_guard_payment_allocation_update']) await db.exec(command(reconciliation,name));
    await db.exec(`create trigger project_payment_entries_audit_insert after insert on public.project_payment_entries for each row execute function public.commercial_audit_payment_entry();
      create trigger project_payment_allocations_audit_write after insert or update of reversed_at on public.project_payment_allocations for each row execute function public.commercial_audit_payment_allocation();
      create trigger project_payment_allocations_guard_update before update on public.project_payment_allocations for each row execute function public.commercial_guard_payment_allocation_update();`);
    await db.exec(command(read('migrations/20260813000002_commercial_admin_action_idempotency.sql'),'commercial_record_project_payment_entry'));
    await db.exec(read('migrations/20260813000003_commercial_truth_invariants.sql'));
    // Real whole-invoice owner, including the unreversed receipt correction.
    await db.exec(command(read('migrations/20260911000005_standalone_invoice_balances.sql'),'commercial_mark_invoice_paid_and_record_payment'));
    await db.exec(read('migrations/20260911000007_invoice_payment_reapplication.sql'));
    await db.exec(read('migrations/20260914000002_xero_deposit_matching.sql'));
    await db.exec(read('migrations/20260914000003_xero_deposit_commands.sql'));
    await db.exec(read('migrations/20260914000004_xero_deposit_review_notes.sql'));
    await db.exec(`alter table public.project_payment_allocations alter column quote_version_id drop not null,
      alter column payment_term_id drop not null,add column standalone_invoice_id uuid references public.deposit_invoices(id);
      alter table public.deposit_invoices alter column quote_id drop not null,alter column quote_version_id drop not null,
      alter column quote_ref drop not null,alter column quote_version_number drop not null;`);
    await db.exec(command(read('migrations/20260911000005_standalone_invoice_balances.sql'),'commercial_guard_payment_allocation_update'));
    await db.exec(command(read('migrations/20260911000005_standalone_invoice_balances.sql'),'commercial_standalone_allocation_guard'));
    await db.exec(`create trigger project_payment_allocations_standalone_guard before insert on public.project_payment_allocations
      for each row execute function public.commercial_standalone_allocation_guard();`);
    // Transfer identity fixtures only; canonical ledger/approval functions above
    // are real SQL owners. This does not exercise invoice dispatch or PGMQ.
    await db.exec(`create schema if not exists private;
      create table private.xero_invoice_transfer_control(singleton boolean,tenant_id uuid);
      create table private.xero_invoice_transfers(id uuid primary key,invoice_id uuid,project_id uuid,tenant_id uuid,provider_invoice_id uuid);
      create table private.xero_invoice_requests(transfer_id uuid,body text);`);
    await db.exec(read('migrations/20260914000014_xero_invoice_payment_commands.sql'));
    await db.exec(read('migrations/20260914000015_xero_invoice_payment_review.sql'));
    await db.exec('alter table auth.users add column email text');
    await db.exec(read('migrations/20260914000016_xero_payment_history.sql'));
    await db.exec(read('migrations/20260914000017_xero_partial_payment_balances.sql'));
  },20000);
  beforeEach(async()=>{
    await db.exec(`truncate private.xero_invoice_transfer_control,private.xero_invoice_transfers,private.xero_invoice_requests,
      public.xero_deposit_matches,public.xero_payment_approvers,auth.users,public.projects,public.quotes,public.quote_versions,
      public.deposit_invoices,public.project_payment_entries,public.project_payment_allocations,public.project_invoice_plan_items,public.audit_events cascade;
      insert into auth.users values('${id(99)}'),('${id(96)}');
      insert into public.xero_payment_approvers(user_id,granted_by) values('${id(99)}','Pilot test setup');
      insert into public.projects(id,name) values('${id(1)}','First test project'),('${id(2)}','Second test project');
      insert into public.quotes(id,project_id,quote_ref) values('${id(1)}','${id(1)}','Q-1'),('${id(2)}','${id(2)}','Q-2');
      insert into public.quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
      select id,id,1,'ACCEPTED',now(),20000,17391,2609,'[{"id":"deposit","resolvedAmountIncGstCents":10000}]'::jsonb from public.quotes;
      insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,
        quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label)
      select id,id,id,id,quote_ref,1,'INV-'||quote_ref,'OPEN',20000,10000,8696,1304,'deposit','Initial payment' from public.quotes;`);
  });
  afterAll(async()=>{await db?.close();});
  it('stores review notes once without money changes and denies ungranted authors',async()=>{
    const write=(actor=99,reason='Confirm the project with customer emails')=>db.query('select public.xero_record_deposit_review_note($1,$2,$3,$4,$5,$6,$7)',[id(40),id(actor),id(98),id(10),id(1),'INVESTIGATE',reason]);
    await expect(write(96)).rejects.toThrow(/permission is required/);
    await write();await write();
    expect((await db.query<{count:number}>('select count(*)::int count from public.xero_deposit_review_notes')).rows[0].count).toBe(1);
    await expect(write(99,'Different note')).rejects.toThrow(/different evidence/);
    expect(await balance()).toEqual({net:0,entries:0,allocated:0,status:'OPEN'});
    await db.exec('set role service_role');
    await expect(db.exec('delete from public.xero_deposit_review_notes')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
  it('records a partial deposit once, then settles from two existing receipts without a third payment',async()=>{
    const snapshot=await context(); const first=await approve(10,10,4000,1,99,snapshot);
    expect(await balance()).toEqual({net:4000,entries:1,allocated:0,status:'OPEN'});
    expect((await context()).customerWon).toBe(true);
    expect((await approve(10,10,4000,1,99,snapshot)).replayed).toBe(true);
    const second=await approve(11,11,6000);
    expect(second.paymentEntryId).not.toBe(first.paymentEntryId);
    expect(await balance()).toEqual({net:10000,entries:2,allocated:10000,status:'PAID'});
    const audit=await db.query<{count:number}>("select count(*)::int count from public.audit_events where type='payment.xero_match_approved'");
    expect(audit.rows[0].count).toBe(2);
  });
  it('records one cent as a deposit without claiming the whole invoice paid',async()=>{
    await approve(10,10,1); expect(await balance()).toEqual({net:1,entries:1,allocated:0,status:'OPEN'});
    expect((await context()).customerWon).toBe(true);
  });
  it('blocks cross-project duplicate sources and changed approval identities',async()=>{
    await approve(); await expect(approve(11,10,4000,2)).rejects.toThrow(/already recorded/);
    await expect(approve(10,10,5000)).rejects.toThrow(/different evidence/);
    expect((await balance()).net).toBe(4000);
  });
  it('fails stale review or excess coverage before recording money',async()=>{
    const stale=await context(); await approve();
    await expect(approve(11,11,6000,1,99,stale)).rejects.toThrow(/evidence changed/);
    await expect(approve(11,11,6001)).rejects.toThrow(/exceed/);
    expect((await balance()).entries).toBe(1);
  });
  it('requires separate approval permission and respects revocation',async()=>{
    await expect(approve(10,10,4000,1,96)).rejects.toThrow(/permission/);
    await db.exec('update public.xero_payment_approvers set revoked_at=now()');
    await expect(approve()).rejects.toThrow(/permission/); expect((await balance()).entries).toBe(0);
  });
  it('reverses a match through the existing reversal owner, reopens invoice and can correct the receipt ownership',async()=>{
    const first=await approve(); await approve(11,11,6000);
    await expect(reverse(first.paymentEntryId,96)).rejects.toThrow(/permission/);
    await reverse(first.paymentEntryId);
    expect(await balance()).toEqual({net:6000,entries:3,allocated:0,status:'OPEN'});
    expect((await context()).customerWon).toBe(true);
    await expect(approve(10,10,4000)).rejects.toThrow(/reversed/);
    await approve(12,10,4000,2);
    expect((await context(2)).customerWon).toBe(true);
    expect((await db.query<{count:number}>('select count(*)::int count from public.xero_deposit_matches')).rows[0].count).toBe(3);
  });
  it('does not let manual mark-paid double count partially or fully matched invoices',async()=>{
    const mark=()=>db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,now(),null,null,null)',[id(1),id(99)]);
    await approve(); await expect(mark()).rejects.toThrow(/Only part/);
    await approve(11,11,6000); await expect(mark()).rejects.toThrow(/another whole payment/);
    expect(await balance()).toEqual({net:10000,entries:2,allocated:10000,status:'PAID'});
  });
  it('rolls back money, match and invoice settlement together when the final audit write fails',async()=>{
    await db.exec(`create function public.test_refuse_match_audit() returns trigger language plpgsql as $$ begin
      if new.type='payment.xero_match_approved' then raise exception 'Injected audit outage'; end if; return new; end $$;
      create trigger test_refuse_match_audit before insert on public.audit_events for each row execute function public.test_refuse_match_audit();`);
    try {
      await expect(approve(10,10,10000)).rejects.toThrow(/audit outage/);
      expect(await balance()).toEqual({net:0,entries:0,allocated:0,status:'OPEN'});
      expect((await context()).customerWon).toBe(false);
    } finally { await db.exec('drop trigger test_refuse_match_audit on public.audit_events; drop function public.test_refuse_match_audit()'); }
  });
  it('a complete reversal clears the active deposit outcome and a newly reviewed repayment can settle again',async()=>{
    const first=await approve(10,10,10000); await reverse(first.paymentEntryId);
    expect((await context()).customerWon).toBe(false);
    expect(await balance()).toEqual({net:0,entries:2,allocated:0,status:'OPEN'});
    await approve(11,10,10000);
    expect(await balance()).toEqual({net:10000,entries:3,allocated:10000,status:'PAID'});
  });
  async function bindInvoice() {
    await db.exec(`insert into private.xero_invoice_transfer_control values(true,'${id(98)}');
      insert into private.xero_invoice_transfers values('${id(80)}','${id(1)}','${id(1)}','${id(98)}','${id(81)}');
      insert into private.xero_invoice_requests values('${id(80)}','{"Invoices":[{"Contact":{"ContactID":"${id(97)}"}}]}');`);
  }
  async function invoicePayment(approval=20,source=20,amount=4000,providerInvoice=81,contact=97) {
    const evidence=await context();
    return (await db.query<{ result:{matchId:string;paymentEntryId:string;replayed:boolean} }>(
      'select public.xero_approve_invoice_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) result',
      [id(approval),id(99),id(98),id(source),id(contact),id(1),id(1),amount,'2026-09-13',evidence.invoiceFingerprint,evidence.ledgerFingerprint,'b'.repeat(64),'Invoice payment',id(providerInvoice)])).rows[0].result;
  }
  it('supports later quote stages using the same receipt ledger and reversal command',async()=>{
    await bindInvoice();
    await db.exec(`update public.deposit_invoices set payment_term_position=2 where id='${id(1)}'`);
    await expect(approve()).rejects.toThrow(/not an open NZD deposit/);
    const first=await invoicePayment();
    expect((await invoicePayment()).replayed).toBe(true);
    await invoicePayment(21,21,6000);
    expect(await balance()).toEqual({net:10000,entries:2,allocated:10000,status:'PAID'});
    expect((await db.query<{source_kind:string;provider_invoice_id:string}>('select source_kind,provider_invoice_id from public.xero_deposit_matches where id=$1',[id(20)])).rows[0]).toEqual({source_kind:'INVOICE_PAYMENT',provider_invoice_id:id(81)});
    await reverse(first.paymentEntryId);
    expect(await balance()).toEqual({net:6000,entries:3,allocated:0,status:'OPEN'});
  });
  it('refuses a payment with the wrong bound Xero invoice or customer before writing money',async()=>{
    await bindInvoice();
    await expect(invoicePayment(20,20,4000,82)).rejects.toThrow(/binding changed/);
    await expect(invoicePayment(20,20,4000,81,96)).rejects.toThrow(/binding changed/);
    expect((await balance()).entries).toBe(0);
  });
  it('blocks mixed source history in both directions instead of duplicating a bank receipt',async()=>{
    await bindInvoice(); const bank=await approve();
    await expect(invoicePayment()).rejects.toThrow(/another Xero source/);
    await reverse(bank.paymentEntryId);
    await invoicePayment();
    await expect(approve(12,12,4000)).rejects.toThrow(/another Xero source/);
    expect((await balance()).net).toBe(4000);
  });
  it('prevents an old approval identity being replayed through another source API',async()=>{
    await bindInvoice(); await approve(20,20,4000);
    await expect(invoicePayment()).rejects.toThrow(/different evidence/);
  });
  it('settles standalone instalments once and prevents moving their money into quoted scope',async()=>{
    await bindInvoice();
    await db.exec(`update public.deposit_invoices set invoice_kind='STANDALONE',quote_id=null,quote_version_id=null,
      quote_ref=null,quote_version_number=null where id='${id(1)}'`);
    const first=await invoicePayment();
    expect(await balance()).toEqual({net:4000,entries:1,allocated:0,status:'OPEN'});
    await invoicePayment(21,21,6000);
    expect(await balance()).toEqual({net:10000,entries:2,allocated:10000,status:'PAID'});
    const allocations=await db.query<{standalone_invoice_id:string;quote_version_id:null}>('select standalone_invoice_id,quote_version_id from public.project_payment_allocations where reversed_at is null');
    expect(allocations.rows).toEqual([{standalone_invoice_id:id(1),quote_version_id:null},{standalone_invoice_id:id(1),quote_version_id:null}]);
    await expect(db.query('select public.commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',
      [first.paymentEntryId,'[]','Move to quoted work',id(99)])).rejects.toThrow(/Reverse the standalone/);
    await expect(db.query(`insert into public.project_payment_allocations(project_id,payment_entry_id,quote_version_id,
      payment_term_id,amount_inc_gst_cents,change_reason,created_by) values($1,$2,$1,'deposit',4000,'Wrong target',$3)`,
      [id(1),first.paymentEntryId,id(99)])).rejects.toThrow(/Standalone instalments/);
    await reverse(first.paymentEntryId);
    expect(await balance()).toEqual({net:6000,entries:3,allocated:0,status:'OPEN'});
    await invoicePayment(22,22,4000);
    expect(await balance()).toEqual({net:10000,entries:4,allocated:10000,status:'PAID'});
  });
  it('keeps the shared ledger command private and the new invoice approval service-only',async()=>{
    const signature='uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text';
    for(const role of ['anon','authenticated','service_role']) {
      const access=(await db.query<{internal:boolean;approval:boolean}>(`select
        has_function_privilege($1,$2,'EXECUTE') internal,has_function_privilege($1,$3,'EXECUTE') approval`,
      [role,`private.xero_commit_payment_match(${signature},text,uuid)`,`public.xero_approve_invoice_payment(${signature},uuid)`])).rows[0];
      expect(access).toEqual({internal:false,approval:role==='service_role'});
    }
  });
  it('loads bound review context only for the current finance approver and pinned tenant',async()=>{
    await bindInvoice();
    const load=(actor=99,tenant=98)=>db.query<{context:{providerInvoiceId:string;hasOtherSourceHistory:boolean}}>(
      'select public.xero_invoice_payment_review_context($1,$2,$3) context',[id(actor),id(1),id(tenant)]);
    expect((await load()).rows[0].context).toMatchObject({providerInvoiceId:id(81),hasOtherSourceHistory:false});
    await approve(); expect((await load()).rows[0].context.hasOtherSourceHistory).toBe(true);
    await expect(load(96)).rejects.toThrow(/permission/);
    await expect(load(99,97)).rejects.toThrow(/UNAVAILABLE/);
    await db.exec('update public.xero_payment_approvers set revoked_at=now()');
    await expect(load()).rejects.toThrow(/permission/);
  });
  it('reads approval and reversal history without provider access, preserving the recorded actor and reason',async()=>{
    await bindInvoice(); await db.query('update auth.users set email=$1 where id=$2',['finance@example.test',id(99)]);
    const payment=await invoicePayment(); await reverse(payment.paymentEntryId);
    const load=(actor=99)=>db.query<{history:{recordedCents:number;matches:Array<{approvedBy:string;reversedBy:string;reversalReason:string;sourceKind:string}>}}>(
      'select public.xero_invoice_payment_history($1,$2,$3,0) history',[id(actor),id(1),id(98)]);
    const history=(await load()).rows[0].history;
    expect(history.recordedCents).toBe(0);
    expect(history.matches[0]).toMatchObject({approvedBy:'finance@example.test',reversedBy:'finance@example.test',sourceKind:'INVOICE_PAYMENT',reversalReason:'Correct mistaken deposit match'});
    await expect(load(96)).rejects.toThrow(/permission/);
  });
  it('bounds history pages while retaining the whole-invoice recorded amount',async()=>{
    await bindInvoice();
    for(let index=0;index<51;index++) await invoicePayment(100+index,100+index,1);
    const load=async(offset:number)=>(await db.query<{history:{recordedCents:number;matches:Array<{id:string}>}}>(
      'select public.xero_invoice_payment_history($1,$2,$3,$4) history',[id(99),id(1),id(98),offset])).rows[0].history;
    const first=await load(0),last=await load(50);
    expect(first.matches).toHaveLength(51);expect(last.matches).toHaveLength(1);
    expect(first.recordedCents).toBe(51);expect(last.recordedCents).toBe(51);
    expect(first.matches[50].id).toBe(last.matches[0].id);
    await expect(load(-1)).rejects.toThrow(/Invalid history/);
  });
  it('deducts a matched instalment from outstanding exposure without counting it twice',async()=>{
    await bindInvoice(); const first=await invoicePayment();
    const truth=async()=>(await db.query<{paid_inc_gst_cents:number;open_invoice_inc_gst_cents:number;remaining_to_invoice_inc_gst_cents:number;over_committed_inc_gst_cents:number}>(
      'select * from public.commercial_project_financial_truth($1)',[id(1)])).rows[0];
    expect(await truth()).toMatchObject({paid_inc_gst_cents:4000,open_invoice_inc_gst_cents:6000,remaining_to_invoice_inc_gst_cents:10000,over_committed_inc_gst_cents:0});
    await expect(db.query('select public.commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',
      [first.paymentEntryId,'[]','Release as general credit',id(99)])).rejects.toThrow(/reserved for its invoice/);
    await invoicePayment(21,21,6000);
    expect(await truth()).toMatchObject({paid_inc_gst_cents:10000,open_invoice_inc_gst_cents:0,remaining_to_invoice_inc_gst_cents:10000});
    await reverse(first.paymentEntryId);
    expect(await truth()).toMatchObject({paid_inc_gst_cents:6000,open_invoice_inc_gst_cents:4000,remaining_to_invoice_inc_gst_cents:10000});
  });
});
