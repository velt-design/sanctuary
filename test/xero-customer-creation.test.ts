// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../apps/portal/lib/supabaseClient', () => ({ supabaseServiceRole: { rpc: mocks.rpc } }));
import { customerCreationRepository } from '../apps/portal/lib/invoices/financeMappingRepository';
import { executeCustomerCreation } from '../apps/portal/lib/xero/customerCreation';
const read = (name: string) => readFileSync(`supabase/${name}`, 'utf8');
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const body = JSON.stringify({ Contacts: [{ Name: 'Example', ContactNumber: `SP-${id}` }] });
let db: PGlite;
async function command(action = 'prepare', contact: string | null = null, payload = body, actor = id, tenant = id) {
  const result = await db.query<{ request: { body: string; bodyHash: string; idempotencyKey: string; preparedAt: number;
    expiresAt: number; dispatchStarted: boolean; providerContactId: string | null } }>(
    'select public.xero_customer_creation_command($1,$2,$3,$4,$5,$6,$7) request', [actor, id, tenant, id, action, payload, contact]);
  return result.rows[0].request;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema private; create schema auth; create role anon; create role authenticated; create role service_role;
    create table auth.users(id uuid primary key); create table public.projects(id uuid primary key);
    create table private.xero_invoice_transfer_control(singleton boolean primary key,enabled boolean default false,tenant_id uuid,account_code text,tax_type text,mapping_verified_at timestamptz);
    insert into private.xero_invoice_transfer_control(singleton,tenant_id) values(true,'${id}');
    create table private.xero_invoice_transfers(id uuid,invoice_id uuid,source_contact_id uuid);
    create table private.xero_invoice_requests(transfer_id uuid);
    create table private.xero_customer_mappings(tenant_id uuid,portal_contact_id uuid,xero_contact_id uuid,verified_at timestamptz,verified_by uuid,revoked_at timestamptz,primary key(tenant_id,portal_contact_id));`);
  await db.exec(read('tests/xero_invoice_bootstrap.sql'));
  await db.exec(`alter table public.deposit_invoices add column customer_name text;
    insert into auth.users values('${id}'),('${other}'); insert into public.contacts values('${id}');
    insert into public.projects(id,contact_id) values('${id}','${id}');
    insert into public.deposit_invoices(id,project_id,status,invoice_ref) values('${id}','${id}','OPEN','INV-TEST');
    insert into public.xero_payment_approvers(user_id,granted_by) values('${id}','Synthetic');`);
  const commands = read('migrations/20260914000003_xero_deposit_commands.sql');
  await db.exec(commands.slice(commands.indexOf('create function public.xero_require_payment_approver'), commands.indexOf('create function public.xero_approve_deposit_match')));
  await db.exec(read('migrations/20260914000011_xero_finance_mapping_commands.sql'));
  await db.exec(read('migrations/20260914000019_xero_customer_creation_intents.sql'));
}, 20000);
beforeEach(async () => {
  await db.exec(`truncate private.xero_customer_creation_events,private.xero_customer_creation_intents,private.xero_customer_mappings;
    update public.xero_payment_approvers set revoked_at=null; update public.deposit_invoices set status='OPEN';`);
  mocks.rpc.mockImplementation(async (name, args) => {
    if (name !== 'xero_customer_creation_command') throw new Error('Unexpected RPC');
    try {
      const result = await db.query<{ request: unknown }>('select public.xero_customer_creation_command($1,$2,$3,$4,$5,$6,$7) request',
        [args.p_actor, args.p_invoice_id, args.p_tenant_id, args.p_source_contact_id, args.p_action, args.p_body, args.p_provider_contact_id]);
      return { data: result.rows[0].request, error: null };
    } catch (error) { return { data: null, error: { message: (error as Error).message } }; }
  });
});
afterAll(async () => { await db?.close(); });
it('stores one exact request and key across preparation/dispatch/reload, then maps once after verification', async () => {
  const first = await command(); expect(first.dispatchStarted).toBe(false);
  expect(first.body).toBe(body); expect(first.bodyHash).toMatch(/^[a-f0-9]{64}$/);
  expect(first.expiresAt - first.preparedAt).toBe(300000);
  expect(await command()).toEqual(first);
  const dispatched = await command('dispatch'); expect(dispatched).toEqual({ ...first, dispatchStarted: true });
  expect(await command('dispatch')).toEqual(dispatched);
  const finished = await command('finalise', other); expect(finished.providerContactId).toBe(other);
  expect(await command()).toEqual(finished); expect(await command('finalise', other)).toEqual(finished);
  expect((await db.query('select event from private.xero_customer_creation_events order by recorded_at')).rows).toEqual([
    { event: 'prepared' }, { event: 'dispatch_started' }, { event: 'verified' },
  ]);
  expect((await db.query('select xero_contact_id from private.xero_customer_mappings')).rows).toEqual([{ xero_contact_id: other }]);
  expect((await db.query('select enabled,account_code from private.xero_invoice_transfer_control')).rows[0]).toEqual({ enabled: false, account_code: null });
});
it('refuses changed request bytes and shape, or finalisation before dispatch', async () => {
  await command();
  await expect(command('prepare', null, body.replace('Example', 'Changed'))).rejects.toThrow('XERO_CUSTOMER_INTENT_CONFLICT');
  await expect(command('prepare', null, JSON.stringify({ Contacts: [{ Name: 'Example', ContactNumber: `SP-${id}`, BankAccountDetails: 'forbidden' }] }))).rejects.toThrow('INVALID_FROZEN_CUSTOMER_REQUEST');
  await expect(command('finalise', other)).rejects.toThrow('INVALID_CUSTOMER_COMMAND');
  await expect(command('prepare', other)).rejects.toThrow('INVALID_CUSTOMER_COMMAND');
});
it('rechecks current finance permission, issued state and pinned tenant on every command', async () => {
  await expect(command('prepare', null, body, other)).rejects.toThrow(/permission is required/);
  await expect(command('prepare', null, body, id, other)).rejects.toThrow('XERO_TENANT_MISMATCH');
  await command(); await db.exec('update public.xero_payment_approvers set revoked_at=now()');
  await expect(command('dispatch')).rejects.toThrow(/permission is required/);
  await db.exec("update public.xero_payment_approvers set revoked_at=null; update public.deposit_invoices set status='VOID'");
  await expect(command('dispatch')).rejects.toThrow('XERO_MAPPING_CONTEXT_UNAVAILABLE');
});
it('does not overwrite an existing customer mapping or persist a rejected intent', async () => {
  await db.exec(`insert into private.xero_customer_mappings values('${id}','${id}','${other}',now(),'${id}',null)`);
  await expect(command()).rejects.toThrow('XERO_EXISTING_CUSTOMER_REVIEW');
  expect((await db.query('select * from private.xero_customer_creation_intents')).rows).toHaveLength(0);
});
it('refuses a mapping saved during provider work and preserves both the mapping and unresolved intent', async () => {
  await command(); await command('dispatch');
  await db.exec(`insert into private.xero_customer_mappings values('${id}','${id}','${id}',now(),'${id}',null)`);
  await expect(command('finalise', other)).rejects.toThrow('XERO_EXISTING_CUSTOMER_REVIEW');
  expect((await db.query('select provider_contact_id from private.xero_customer_creation_intents')).rows[0]).toEqual({ provider_contact_id: null });
});
it('allows verified read recovery after expiry but forbids another dispatch or replacement window', async () => {
  await command(); await command('dispatch');
  // Rebuild an owner-only fixture with an originally expired window; the live command cannot extend it.
  const stored = (await db.query<{ request: object }>('select request from private.xero_customer_creation_intents')).rows[0].request;
  await db.exec('truncate private.xero_customer_creation_events,private.xero_customer_creation_intents');
  await db.query(`insert into private.xero_customer_creation_intents(tenant_id,source_contact_id,invoice_id,prepared_by,request,dispatch_started)
    values($1,$1,$1,$1,$2,true)`, [id, JSON.stringify({ ...stored, preparedAt: Date.now() - 600000, expiresAt: Date.now() - 300000 })]);
  const expired = await command(); await expect(command('dispatch')).rejects.toThrow('CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED');
  expect(await command()).toEqual(expired); expect((await command('finalise', other)).providerContactId).toBe(other);
});
it('protects private intents and append-only history from staff and service direct mutation', async () => {
  await command();
  await expect(db.exec("update private.xero_customer_creation_intents set request=request||'{\"expiresAt\":9999999999999}'::jsonb")).rejects.toThrow('immutable');
  await expect(db.exec('delete from private.xero_customer_creation_events')).rejects.toThrow('append-only');
  await db.exec('set role authenticated');
  await expect(command()).rejects.toThrow(/permission denied/); await db.exec('reset role');
  await db.exec('set role service_role');
  await expect(db.exec('update private.xero_customer_creation_intents set dispatch_started=true')).rejects.toThrow(/permission denied/);
  await db.exec('reset role');
});
it('runs the SQL request through the real repository/orchestrator and recovers a lost provider response', async () => {
  const provider = { findByNumber: vi.fn().mockResolvedValue([]), findByName: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockRejectedValue(new Error('lost response')), read: vi.fn() };
  const input = { tenantId: id, sourceContactId: id, name: 'Example' };
  const repository = customerCreationRepository(id, id);
  await expect(executeCustomerCreation(input, repository, provider)).rejects.toThrow('XERO_CUSTOMER_OUTCOME_UNCERTAIN');
  expect((await command()).dispatchStarted).toBe(true);
  provider.findByNumber.mockResolvedValue([{ ContactID: other, ContactStatus: 'ACTIVE', Name: 'Example', ContactNumber: `SP-${id}` }]);
  expect(await executeCustomerCreation(input, customerCreationRepository(id, id), provider)).toEqual({ contactId: other });
  expect(provider.create).toHaveBeenCalledTimes(1);
  expect((await command()).providerContactId).toBe(other);
});
