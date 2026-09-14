-- Pilot approval is separate from portal roles and from the Xero connection login.
-- Leave grants empty until the reviewed environment-specific provisioning step.
begin;

create table public.xero_payment_approvers (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_at timestamptz not null default clock_timestamp(),
  granted_by text not null check (length(trim(granted_by)) >= 3),
  revoked_at timestamptz
);

create table public.xero_deposit_matches (
  id uuid primary key,
  tenant_id uuid not null,
  receipt_id uuid not null,
  contact_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  invoice_id uuid not null references public.deposit_invoices(id) on delete restrict,
  payment_entry_id uuid not null unique references public.project_payment_entries(id) on delete restrict,
  amount_inc_gst_cents integer not null check (amount_inc_gst_cents > 0),
  receipt_date date not null,
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[a-f0-9]{64}$'),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default clock_timestamp(),
  reversed_at timestamptz,
  reversal_entry_id uuid unique references public.project_payment_entries(id) on delete restrict,
  check ((reversed_at is null) = (reversal_entry_id is null))
);

-- A receipt can fund only one active match across every project. Historical
-- reversed matches remain evidence; a new reviewed match may correct ownership.
create unique index xero_deposit_matches_active_source_unique
  on public.xero_deposit_matches(tenant_id,receipt_id) where reversed_at is null;
create index xero_deposit_matches_invoice_idx on public.xero_deposit_matches(invoice_id);
create index xero_deposit_matches_project_idx on public.xero_deposit_matches(project_id);

alter table public.xero_payment_approvers enable row level security;
alter table public.xero_deposit_matches enable row level security;
revoke all on public.xero_payment_approvers, public.xero_deposit_matches from public, anon, authenticated, service_role;
grant select on public.xero_payment_approvers, public.xero_deposit_matches to service_role;

create function public.xero_deposit_match_guard()
returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.project_payment_entries e join public.deposit_invoices i on i.id=new.invoice_id
      where e.id=new.payment_entry_id and e.project_id=new.project_id and i.project_id=new.project_id
        and e.entry_type='PAYMENT' and e.amount_inc_gst_cents=new.amount_inc_gst_cents) then
      raise exception 'Deposit match must reference its exact project payment' using errcode='55000';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'Deposit match history cannot be deleted' using errcode='55000'; end if;
  if (to_jsonb(new) - 'reversed_at' - 'reversal_entry_id') is distinct from
    (to_jsonb(old) - 'reversed_at' - 'reversal_entry_id')
    or old.reversed_at is not null or new.reversed_at is null or new.reversal_entry_id is null then
    raise exception 'Deposit matches are immutable; use a payment reversal' using errcode='55000';
  end if;
  if not exists (select 1 from public.project_payment_entries e
    where e.id=new.reversal_entry_id and e.reverses_entry_id=old.payment_entry_id
      and e.entry_type='REVERSAL' and e.amount_inc_gst_cents=-old.amount_inc_gst_cents
      and e.project_id=old.project_id) then
    raise exception 'A matching ledger reversal is required' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger xero_deposit_matches_immutable before insert or update or delete on public.xero_deposit_matches
for each row execute function public.xero_deposit_match_guard();
revoke all on function public.xero_deposit_match_guard() from public,anon,authenticated;

-- The approval command will re-read these same database-owned fingerprints
-- under the canonical project lock. They are not browser-authored balance claims.
create function public.xero_deposit_review_context(p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_invoice public.deposit_invoices%rowtype; v_invoice_snapshot jsonb; v_ledger jsonb; v_project_id uuid;
begin
  select project_id into strict v_project_id from public.deposit_invoices where id=p_invoice_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||v_project_id::text,0));
  select * into strict v_invoice from public.deposit_invoices where id=p_invoice_id;
  v_invoice_snapshot := to_jsonb(v_invoice);
  v_ledger := jsonb_build_object(
    'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)
      from public.project_payment_entries e where e.project_id=v_invoice.project_id),
    'allocations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)
      from public.project_payment_allocations a where a.project_id=v_invoice.project_id));
  return jsonb_build_object(
    'invoice',jsonb_build_object('id',v_invoice.id,'projectId',v_invoice.project_id,'invoiceRef',v_invoice.invoice_ref,
      'status',v_invoice.status,'invoiceKind',v_invoice.invoice_kind,'paymentTermPosition',v_invoice.payment_term_position,
      'customerName',v_invoice.customer_name,'projectName',v_invoice.project_name,'totalIncGstCents',v_invoice.total_inc_gst_cents,
      'currency',v_invoice.currency,'reference',v_invoice.reference),
    'invoiceFingerprint',encode(sha256(convert_to(v_invoice_snapshot::text,'UTF8')),'hex'),
    'ledgerFingerprint',encode(sha256(convert_to(v_ledger::text,'UTF8')),'hex'),
    'matchedCents',coalesce((select sum(m.amount_inc_gst_cents) from public.xero_deposit_matches m
      where m.invoice_id=p_invoice_id and m.reversed_at is null),0),
    'customerWon',exists(select 1 from public.xero_deposit_matches m
      where m.project_id=v_invoice.project_id and m.reversed_at is null),
    'hasUnmatchedPaymentHistory',exists(select 1 from public.project_payment_entries e
      where e.project_id=v_invoice.project_id and not exists(select 1 from public.xero_deposit_matches m
        where m.payment_entry_id=e.id or m.reversal_entry_id=e.id))
  );
end;
$$;
revoke all on function public.xero_deposit_review_context(uuid) from public,anon,authenticated;
grant execute on function public.xero_deposit_review_context(uuid) to service_role;

commit;
