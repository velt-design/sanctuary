-- Capture only future invoice issuance. Applying this migration enables no
-- provider writes, grants no finance capability, and queues no historical data.
insert into public.background_job_kinds (
  kind, contract_version, handler_owner, max_attempts, timeout_seconds,
  concurrency_class, has_external_side_effect, required_effect_kinds,
  cancellation_allowed, default_rollout_mode, active, allowed_effect_kinds
) values (
  'xero_invoice_draft_v1', 1, 'xero-invoice-workflow', 4, 60,
  'orchestration', true, array['xero_invoice_draft'], false, 'disabled', true,
  array['xero_invoice_draft']
);

create table private.xero_invoice_transfer_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  tenant_id uuid,
  check (not enabled or tenant_id is not null)
);
insert into private.xero_invoice_transfer_control(singleton) values (true);

create table private.xero_invoice_transfers (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.deposit_invoices(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  tenant_id uuid not null,
  job_id uuid not null unique references public.background_jobs(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table private.xero_invoice_transfer_control enable row level security;
alter table private.xero_invoice_transfers enable row level security;
revoke all on private.xero_invoice_transfer_control, private.xero_invoice_transfers from public, anon, authenticated, service_role;

create function private.xero_capture_issued_invoice()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
  v_control private.xero_invoice_transfer_control%rowtype;
  v_invoice public.deposit_invoices%rowtype;
  v_transfer_id uuid := gen_random_uuid();
  v_job public.background_jobs%rowtype;
begin
  -- This deferred event checks the completed invoice, not the intermediate
  -- DRAFT -> OPEN update before issue command identity and audit are persisted.
  if new.status not in ('OPEN','PAID') then return null; end if;
  if tg_op = 'UPDATE' then
    if old.status <> 'DRAFT' then return null; end if;
  end if;
  select * into v_control from private.xero_invoice_transfer_control where singleton for share;
  if not found or not v_control.enabled then return null; end if;
  select * into v_invoice from public.deposit_invoices where id = new.id for update;
  if not found or v_invoice.status not in ('OPEN','PAID') then return null; end if;
  if exists (select 1 from private.xero_invoice_transfers where invoice_id = new.id) then return null; end if;

  v_job := private.background_job_enqueue_core(
    'xero_invoice_draft_v1', 1, 'invoice', v_invoice.id::text, v_invoice.project_id,
    auth.uid(), case when auth.uid() is null then 'system' else 'staff' end, 100::smallint,
    'xero-invoice-draft:' || v_control.tenant_id::text || ':' || v_invoice.id::text,
    jsonb_build_object('contractVersion',1,'transferId',v_transfer_id,
      'invoiceId',v_invoice.id,'tenantId',v_control.tenant_id),
    null, 'worker_enabled', 'worker', 'xero-invoice-pilot'
  );
  insert into private.xero_invoice_transfers(id,invoice_id,project_id,tenant_id,job_id)
    values (v_transfer_id,v_invoice.id,v_invoice.project_id,v_control.tenant_id,v_job.id);
  return null;
end;
$$;
revoke all on function private.xero_capture_issued_invoice() from public, anon, authenticated, service_role;

create constraint trigger xero_capture_issued_invoice
after insert or update on public.deposit_invoices
deferrable initially deferred
for each row execute function private.xero_capture_issued_invoice();

comment on table private.xero_invoice_transfer_control is
  'Developer-operated issuance gate. Enable only after worker, scoped Xero consent and finance mapping are verified. No historical catch-up.';
comment on table private.xero_invoice_transfers is
  'One immutable invoice-to-job identity; job payload/effects own processing and request recovery. Provider mapping/finalisation is added separately.';
