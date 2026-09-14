// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('records grant, revocation and regrant without changing current access or allowing audit edits', async () => {
  const db = new PGlite();
  const user = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
      create table auth.users(id uuid primary key); insert into auth.users values('${user}');
      create table public.xero_payment_approvers(user_id uuid primary key references auth.users(id),granted_at timestamptz default now(),granted_by text,revoked_at timestamptz);`);
    await db.exec(readFileSync('supabase/migrations/20260914000009_xero_finance_access_audit.sql', 'utf8'));
    expect((await db.query('select * from public.xero_payment_approvers')).rows).toHaveLength(0);
    await db.query('insert into public.xero_payment_approvers(user_id,granted_by) values($1,$2)', [user, 'Synthetic owner approval']);
    await db.query('update public.xero_payment_approvers set revoked_at=now() where user_id=$1', [user]);
    await db.query('update public.xero_payment_approvers set revoked_at=null,granted_by=$2 where user_id=$1', [user, 'Synthetic reapproval']);
    await db.query('update public.xero_payment_approvers set revoked_at=null where user_id=$1', [user]);
    expect((await db.query('select event from private.xero_finance_access_events order by recorded_at')).rows.map(row => row.event)).toEqual(['granted', 'revoked', 'granted']);
    await expect(db.exec('delete from private.xero_finance_access_events')).rejects.toThrow('append-only');
    await expect(db.exec("update private.xero_finance_access_events set grant_provenance='rewritten'")).rejects.toThrow('append-only');
    await db.exec('set role authenticated');
    await expect(db.exec('select * from private.xero_finance_access_events')).rejects.toThrow('permission denied');
  } finally { await db.close(); }
});
