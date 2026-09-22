// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { customerHistoryBinding } from '../apps/portal/lib/xero/customerHistoryContract';
it('executes exact mapping migration with current grants, confirmed identity and no reporting/private escalation', async () => {
  const db = new PGlite();
  const actor = '10000000-0000-4000-8000-000000000001', project = '20000000-0000-4000-8000-000000000001', tenant = '30000000-0000-4000-8000-000000000001';
  const contact = '40000000-0000-4000-8000-000000000001', external = '50000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create role praxis_reporting;
      create schema auth;create schema private;create schema praxis_reporting;
      create table praxis_reporting.source_identity_v1(singleton boolean,source_key text,connection_id uuid,environment text,projection_version text);
      insert into praxis_reporting.source_identity_v1 values(true,'synthetic','${project}','test','sanctuary.praxis.core.v1');
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
      create table public.portal_users(user_id uuid primary key,role text);
      create table public.xero_payment_approvers(user_id uuid primary key,revoked_at timestamptz);
      create table public.projects(id uuid primary key,contact_id uuid);
      create table private.xero_invoice_transfer_control(singleton boolean,tenant_id uuid);
      create table private.xero_customer_mappings(tenant_id uuid,portal_contact_id uuid,xero_contact_id uuid,verified_at timestamptz,revoked_at timestamptz);
      insert into auth.users values('${actor}','synthetic@example.test',now(),null,null);
      insert into public.portal_users values('${actor}','staff');
      insert into public.xero_payment_approvers values('${actor}',null);
      insert into public.projects values('${project}','${contact}');
      insert into private.xero_invoice_transfer_control values(true,'${tenant}');
      insert into private.xero_customer_mappings values('${tenant}','${contact}','${external}',now(),null);`);
    const existing = await readFile('supabase/migrations/20260914000003_xero_deposit_commands.sql', 'utf8');
    await db.exec(existing.slice(0, existing.indexOf('create function public.xero_approve_deposit_match')) + '\ncommit;');
    const migration = await readFile('supabase/migrations/20260922053002_praxis_finance_history_binding.sql', 'utf8');
    await db.exec(migration);
    const sql = `select public.xero_customer_history_binding('${actor}','${project}','${tenant}','synthetic','${project}','test') as binding`;
    await db.exec('set role service_role');
    const wire = (await db.query<{ binding: unknown }>(sql)).rows[0]?.binding;
    expect(customerHistoryBinding.parse(wire).xeroContactId).toBe(external);
    for (const role of ['anon', 'authenticated', 'praxis_reporting']) {
      await db.exec(`reset role;set role ${role}`); await expect(db.query(sql)).rejects.toThrow();
      await expect(db.query('select * from private.xero_customer_mappings')).rejects.toThrow();
    }
    await db.exec('reset role');
    for (const change of [`update public.xero_payment_approvers set revoked_at=now()`, `update auth.users set email_confirmed_at=null`,
      `delete from public.portal_users`, `update public.portal_users set role='unsupported'`, `update auth.users set deleted_at=now()`, `update auth.users set banned_until=now()+interval '1 day'`,
      `delete from praxis_reporting.source_identity_v1`, `update praxis_reporting.source_identity_v1 set environment='production'`,
      `update praxis_reporting.source_identity_v1 set connection_id='${tenant}'`, `update praxis_reporting.source_identity_v1 set source_key='other'`,
      `update private.xero_customer_mappings set revoked_at=now()`, `update private.xero_invoice_transfer_control set tenant_id=null`]) {
      await db.exec('begin'); await db.exec(change); await db.exec('set local role service_role'); await expect(db.query(sql)).rejects.toThrow(); await db.exec('rollback');
    }
    await db.exec('begin'); await db.exec('drop function public.xero_customer_history_binding(uuid,uuid,uuid,text,uuid,text)'); await db.exec('rollback');
    expect((await db.query(sql)).rows).toHaveLength(1);
  } finally { await db.close(); }
}, 30000);
