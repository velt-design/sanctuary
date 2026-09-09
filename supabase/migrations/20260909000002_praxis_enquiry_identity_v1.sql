-- Requires the immutable marketing enquiry email correlation migration.
-- Owner-rights view exposes only identity/evidence; the reader gets no base/private grants.
create or replace view praxis_reporting.enquiry_identities_v1
with (security_barrier = true) as
select e.id as enquiry_request_id, e.submission_id, e.created_at as submitted_at,
  i.reference, i.submission_id as dispatch_submission_id, i.dispatch_started_at,
  case when i.reference is null then 'no_intent'
       when r.reference is null then 'missing' else 'recorded' end as receipt_state,
  case when i.reference is null then null else coalesce(r.outcome, 'unknown') end as outcome,
  case when i.reference is null then null else coalesce(r.code, 'ENQUIRY_EMAIL_RECEIPT_MISSING') end as code,
  r.provider_api_message_id, r.recorded_at, null::text as verified_rfc_message_id
from public.enquiry_requests e
left join private.marketing_enquiry_email_intents i on i.enquiry_request_id = e.id
left join private.marketing_enquiry_email_receipts r on r.reference = i.reference;

revoke all on praxis_reporting.enquiry_identities_v1 from public, anon, authenticated, service_role;
grant select on praxis_reporting.enquiry_identities_v1 to sanctuary_praxis_reader;

create index if not exists enquiry_requests_praxis_submitted_id_idx
  on public.enquiry_requests(created_at, id);

create or replace function praxis_reporting.enquiry_identity_snapshot_v1(
  p_submitted_from timestamptz, p_submitted_before timestamptz, p_references uuid[]
) returns table (
  enquiry_request_id uuid, submission_id uuid, submitted_at text, in_window boolean,
  reference uuid, dispatch_submission_id uuid, dispatch_started_at text,
  receipt_state text, outcome text, code text, provider_api_message_id text,
  recorded_at text, verified_rfc_message_id text
) language plpgsql stable security invoker set search_path = pg_catalog as $$
begin
  if p_submitted_from is null or p_submitted_before is null
     or not isfinite(p_submitted_from) or not isfinite(p_submitted_before)
     or p_submitted_before <= p_submitted_from
     or p_submitted_before - p_submitted_from > interval '31 days'
     or p_submitted_before > transaction_timestamp()
     or p_references is null or cardinality(p_references) > 100
     or coalesce(array_ndims(p_references), 1) <> 1
     or exists (select 1 from unnest(p_references) ref where ref is null or ref::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]') then
    raise exception 'ENQUIRY_IDENTITY_QUERY_INVALID' using errcode = '22023';
  end if;

  -- UNION deduplicates canonical rows reached by both the interval and point references.
  -- The 101st row is a sentinel: HTTP must reject the entire oversized snapshot.
  return query
  with window_identities as (
    select v.* from praxis_reporting.enquiry_identities_v1 v
    where v.submitted_at >= p_submitted_from and v.submitted_at < p_submitted_before
    order by v.submitted_at, v.enquiry_request_id limit 101
  ), identities as (
    select * from window_identities
    union
    select v.* from praxis_reporting.enquiry_identities_v1 v where v.reference = any(p_references)
  )
  select v.enquiry_request_id, v.submission_id,
    to_char(v.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    v.submitted_at >= p_submitted_from and v.submitted_at < p_submitted_before,
    v.reference, v.dispatch_submission_id,
    to_char(v.dispatch_started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    v.receipt_state, v.outcome, v.code, v.provider_api_message_id,
    to_char(v.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    v.verified_rfc_message_id
  from identities v order by v.submitted_at, v.enquiry_request_id limit 101;
end;
$$;

revoke all on function praxis_reporting.enquiry_identity_snapshot_v1(timestamptz,timestamptz,uuid[])
  from public, anon, authenticated, service_role;
grant execute on function praxis_reporting.enquiry_identity_snapshot_v1(timestamptz,timestamptz,uuid[])
  to sanctuary_praxis_reader;

comment on view praxis_reporting.enquiry_identities_v1 is
  'Canonical intake-record time is enquiry_requests.created_at. Provider acceptance is not delivery; RFC Message-ID remains unverified/null.';
comment on function praxis_reporting.enquiry_identity_snapshot_v1(timestamptz,timestamptz,uuid[]) is
  'Bounded single-snapshot identity evidence; 101 rows signals overflow, never a complete partial page.';
