-- Request-bound correlation only. No producer, retry, webhook or delivery authority.
create schema if not exists private;

create table private.marketing_enquiry_email_intents (
  reference uuid primary key check (reference::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]'),
  enquiry_request_id uuid not null unique references public.enquiry_requests(id) on delete restrict,
  submission_id uuid not null,
  purpose text not null default 'website_autoresponder' check (purpose = 'website_autoresponder'),
  provider_name text not null default 'resend' check (provider_name = 'resend'),
  provider_idempotency_key text not null unique,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  dispatch_started_at timestamptz not null default clock_timestamp()
);

create table private.marketing_enquiry_email_receipts (
  reference uuid primary key references private.marketing_enquiry_email_intents(reference) on delete restrict,
  outcome text not null check (outcome in ('accepted', 'failed', 'unknown')),
  provider_api_message_id text unique,
  code text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  check (
    (outcome = 'accepted' and code = 'RESEND_ACCEPTED' and provider_api_message_id is not null
      and length(provider_api_message_id) between 1 and 256
      and provider_api_message_id ~ '^[A-Za-z0-9._:-]+$')
    or (outcome = 'failed' and provider_api_message_id is null and code in (
      'RESEND_AUTH_REJECTED', 'RESEND_VALIDATION_REJECTED', 'RESEND_QUOTA_REJECTED',
      'RESEND_REQUEST_REJECTED', 'RESEND_RATE_LIMITED', 'RESEND_ABORTED_BEFORE_DISPATCH',
      'RESEND_IDEMPOTENCY_EXPIRED', 'EMAIL_PROVIDER_CONFIGURATION_MISSING',
      'EMAIL_PROVIDER_CONFIGURATION_INVALID'))
    or (outcome = 'unknown' and provider_api_message_id is null and code in (
      'RESEND_TIMEOUT', 'RESEND_ABORTED', 'RESEND_NETWORK_ERROR', 'RESEND_SERVER_ERROR',
      'RESEND_RESPONSE_INVALID', 'RESEND_IDEMPOTENCY_IN_PROGRESS',
      'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT', 'EMAIL_DELIVERY_UNEXPECTED',
      'EMAIL_PROVIDER_ADAPTER_FAILED'))
  )
);

alter table private.marketing_enquiry_email_intents enable row level security;
alter table private.marketing_enquiry_email_receipts enable row level security;
revoke all on private.marketing_enquiry_email_intents, private.marketing_enquiry_email_receipts
  from public, anon, authenticated, service_role;

create function private.marketing_enquiry_email_immutable() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'ENQUIRY_EMAIL_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function private.marketing_enquiry_email_immutable() from public, anon, authenticated, service_role;
create trigger marketing_enquiry_email_intent_immutable before update or delete
  on private.marketing_enquiry_email_intents for each row execute function private.marketing_enquiry_email_immutable();
create trigger marketing_enquiry_email_receipt_immutable before update or delete
  on private.marketing_enquiry_email_receipts for each row execute function private.marketing_enquiry_email_immutable();

-- Only a newly inserted intent commissions one dispatch. Even an exact replay returns false.
-- A lost RPC response or process crash leaves unknown evidence and never permits redispatch.
create function public.marketing_enquiry_email_begin(
  p_reference uuid, p_enquiry_request_id uuid, p_submission_id uuid, p_payload_hash text
) returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare v_inserted uuid;
begin
  if p_reference is null or p_payload_hash is null or not exists (
    select 1 from public.enquiry_requests e
    where e.id = p_enquiry_request_id and e.submission_id = p_submission_id
  ) then
    raise exception 'ENQUIRY_EMAIL_IDENTITY_INVALID' using errcode = '22023';
  end if;
  insert into private.marketing_enquiry_email_intents (
    reference, enquiry_request_id, submission_id, provider_idempotency_key, payload_hash
  ) values (
    p_reference, p_enquiry_request_id, p_submission_id,
    'website:autoresponder:' || p_enquiry_request_id::text, p_payload_hash
  ) on conflict (enquiry_request_id) do nothing returning reference into v_inserted;
  return v_inserted is not null;
end;
$$;

create function public.marketing_enquiry_email_record(
  p_reference uuid, p_payload_hash text, p_outcome text, p_provider_api_message_id text, p_code text
) returns void language plpgsql security definer set search_path = pg_catalog as $$
declare v_existing private.marketing_enquiry_email_receipts%rowtype;
begin
  -- Serialize receipt races without modifying the immutable intent.
  perform 1 from private.marketing_enquiry_email_intents i
    where i.reference = p_reference and i.payload_hash = p_payload_hash for update;
  if not found then
    raise exception 'ENQUIRY_EMAIL_INTENT_MISSING' using errcode = '22023';
  end if;
  select * into v_existing from private.marketing_enquiry_email_receipts r where r.reference = p_reference;
  if found then
    if v_existing.outcome is not distinct from p_outcome
      and v_existing.provider_api_message_id is not distinct from p_provider_api_message_id
      and v_existing.code is not distinct from p_code then return; end if;
    raise exception 'ENQUIRY_EMAIL_RECEIPT_CONFLICT' using errcode = '22023';
  end if;
  insert into private.marketing_enquiry_email_receipts (reference, outcome, provider_api_message_id, code)
    values (p_reference, p_outcome, p_provider_api_message_id, p_code);
end;
$$;

-- Service-side lookup evidence only; callers must separately authenticate any mailbox evidence.
-- Resend's API identifier is not the RFC Message-ID. No RFC identifier has been observed here.
create function public.marketing_enquiry_email_read(p_reference uuid)
returns table (
  reference uuid, enquiry_request_id uuid, submission_id uuid, purpose text,
  provider_name text, provider_idempotency_key text, payload_hash text,
  outcome text, provider_api_message_id text, rfc_message_id text,
  code text, dispatch_started_at timestamptz, recorded_at timestamptz
) language sql stable security definer set search_path = pg_catalog as $$
  select i.reference, i.enquiry_request_id, i.submission_id, i.purpose,
    i.provider_name, i.provider_idempotency_key, i.payload_hash,
    coalesce(r.outcome, 'unknown'), r.provider_api_message_id, null::text,
    coalesce(r.code, 'ENQUIRY_EMAIL_RECEIPT_MISSING'), i.dispatch_started_at, r.recorded_at
  from private.marketing_enquiry_email_intents i
  left join private.marketing_enquiry_email_receipts r using (reference)
  where i.reference = p_reference;
$$;

revoke all on function public.marketing_enquiry_email_begin(uuid,uuid,uuid,text),
  public.marketing_enquiry_email_record(uuid,text,text,text,text),
  public.marketing_enquiry_email_read(uuid) from public, anon, authenticated, service_role;
grant execute on function public.marketing_enquiry_email_begin(uuid,uuid,uuid,text),
  public.marketing_enquiry_email_record(uuid,text,text,text,text),
  public.marketing_enquiry_email_read(uuid) to service_role;

select pg_notify('pgrst', 'reload schema');
