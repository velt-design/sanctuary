// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
let db: PGlite;
const insert = (match=1, project=1, invoice=1, payment=1, source=1, amount=100) => db.query(`insert into public.xero_deposit_matches
  (id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by)
  values($1,$2,$3,$2,$4,$5,$6,$7,'2026-09-13',repeat('a',64),$2)`,[id(match),id(99),id(source),id(project),id(invoice),id(payment),amount]);
describe('Xero deposit identity storage against migration SQL', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.projects(id uuid primary key);
      create table public.deposit_invoices(id uuid primary key,project_id uuid,status text,total_inc_gst_cents integer,
        invoice_ref text,invoice_kind text,payment_term_position int,customer_name text,project_name text,currency text,reference text);
      create table public.project_payment_entries(id uuid primary key,project_id uuid,entry_type text,amount_inc_gst_cents integer,reverses_entry_id uuid);
      create table public.project_payment_allocations(id uuid primary key,project_id uuid,reversed_at timestamptz);
    `);
    await db.exec(readFileSync('supabase/migrations/20260914000002_xero_deposit_matching.sql','utf8'));
  },20000);
  beforeEach(async () => {
    await db.exec(`truncate public.xero_deposit_matches,public.xero_payment_approvers,public.project_payment_entries,public.project_payment_allocations,public.deposit_invoices,public.projects,auth.users cascade;
      insert into auth.users values('${id(99)}');
      insert into public.projects values('${id(1)}'),('${id(2)}');
      insert into public.deposit_invoices(id,project_id,status,total_inc_gst_cents) values('${id(1)}','${id(1)}','OPEN',10000),('${id(2)}','${id(2)}','OPEN',10000);
      insert into public.project_payment_entries values('${id(1)}','${id(1)}','PAYMENT',100,null),('${id(2)}','${id(2)}','PAYMENT',100,null);`);
  });
  afterAll(async () => { await db?.close(); });
  it('denies browser access and even direct service-role writes', async () => {
    for (const role of ['anon','authenticated','service_role']) {
      const result = await db.query<{ allowed: boolean }>('select has_table_privilege($1,\'public.xero_deposit_matches\',\'INSERT\') as allowed',[role]);
      expect(result.rows[0].allowed).toBe(false);
    }
    const grants = await db.query<{ count: number }>('select count(*)::int count from public.xero_payment_approvers');
    expect(grants.rows[0].count).toBe(0);
  });
  it('prevents one receipt being counted in two projects', async () => {
    await insert(); await expect(insert(2,2,2,2)).rejects.toThrow(/unique/);
  });
  it('requires the exact project and amount from the canonical ledger', async () => {
    await expect(insert(1,2,2,1)).rejects.toThrow(/exact project payment/);
    await expect(insert(1,1,1,1,1,99)).rejects.toThrow(/exact project payment/);
  });
  it('retains immutable evidence and requires a real opposite ledger entry for reversal', async () => {
    await insert();
    await expect(db.exec('delete from public.xero_deposit_matches')).rejects.toThrow(/cannot be deleted/);
    await expect(db.exec('update public.xero_deposit_matches set amount_inc_gst_cents=200')).rejects.toThrow(/immutable/);
    await expect(db.exec(`update public.xero_deposit_matches set reversed_at=now(),reversal_entry_id='${id(2)}'`)).rejects.toThrow(/matching ledger reversal/);
    await db.exec(`insert into public.project_payment_entries values('${id(3)}','${id(1)}','REVERSAL',-100,'${id(1)}');
      update public.xero_deposit_matches set reversed_at=now(),reversal_entry_id='${id(3)}';`);
    await insert(2,2,2,2);
    expect((await db.query<{ count: number }>('select count(*)::int count from public.xero_deposit_matches')).rows[0].count).toBe(2);
  });
  it('changes review fingerprints for invoice, ledger and allocation changes', async () => {
    const context = async () => (await db.query<{ context: { invoiceFingerprint: string; ledgerFingerprint: string } }>('select public.xero_deposit_review_context($1) context',[id(1)])).rows[0].context;
    const first = await context(); expect(first.invoiceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    await db.exec(`update public.deposit_invoices set status='PAID' where id='${id(1)}'`);
    expect((await context()).invoiceFingerprint).not.toBe(first.invoiceFingerprint);
    await db.exec(`insert into public.project_payment_allocations values('${id(1)}','${id(1)}',null)`);
    expect((await context()).ledgerFingerprint).not.toBe(first.ledgerFingerprint);
  });
});
