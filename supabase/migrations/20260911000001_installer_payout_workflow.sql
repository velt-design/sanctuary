-- Installer agreements are append-only. Customer invoices and payments are separate.
create table public.project_installer_payout_events (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  kind text not null check (kind in ('agreement', 'variation', 'invoice')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (project_id, sequence)
);
alter table public.project_installer_payout_events enable row level security;
revoke all on public.project_installer_payout_events from anon, authenticated;
grant select on public.project_installer_payout_events to authenticated;
create policy installer_payout_admin_read on public.project_installer_payout_events
  for select to authenticated using ((select public.is_portal_admin()));

create function public.installer_payout_read(p_project_id uuid)
returns table(id uuid, sequence integer, kind text, payload jsonb, created_at timestamptz, created_by uuid)
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if auth.uid() is null or not public.has_portal_access() then raise exception 'Forbidden'; end if;
  return query select e.id, e.sequence, e.kind,
    case when public.is_portal_admin() then e.payload else e.payload - 'internal' end,
    e.created_at, e.created_by
    from public.project_installer_payout_events e where e.project_id = p_project_id order by e.sequence;
end;
$$;

create function public.installer_payout_append(p_project_id uuid, p_id uuid, p_expected_sequence integer, p_kind text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare existing public.project_installer_payout_events; latest integer; accepted_count integer; registered boolean;
begin
  if auth.uid() is null or not public.is_portal_admin() then raise exception 'Admin required'; end if;
  -- Same project lock as commercial acceptance; prevents an agreement racing quote acceptance.
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  select * into existing from public.project_installer_payout_events where id = p_id;
  if found then
    if existing.project_id = p_project_id and existing.kind = p_kind and existing.payload = p_payload then return p_id; end if;
    raise exception 'Command already used';
  end if;
  select coalesce(max(sequence), 0) into latest from public.project_installer_payout_events where project_id = p_project_id;
  if p_expected_sequence is null or latest <> p_expected_sequence then raise exception 'Stale payout'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_kind is null or p_kind not in ('agreement', 'variation', 'invoice') then raise exception 'Invalid event'; end if;
  if (latest = 0) <> (p_kind = 'agreement') then raise exception 'Agreement must be first and cannot be replaced'; end if;
  if p_kind = 'agreement' then
    select count(*) into accepted_count from public.commercial_current_accepted_quote_versions(p_project_id);
    if accepted_count <> 1 or not exists (
      select 1 from public.commercial_current_accepted_quote_versions(p_project_id) q
      join public.quote_versions v on v.id = q.quote_version_id
      where q.quote_version_id = (p_payload->>'sourceQuoteId')::uuid
      and v.source_estimate_version_id = (p_payload->>'sourceEstimateId')::uuid
    ) then raise exception 'Accepted quote changed'; end if;
    if nullif(trim(p_payload->>'installer'), '') is null or nullif(trim(p_payload->>'acceptanceReference'), '') is null
      or nullif(trim(p_payload->>'scope'), '') is null or nullif(trim(p_payload->>'paymentTerms'), '') is null
      or jsonb_typeof(p_payload->'gstRegistered') is distinct from 'boolean' then raise exception 'Agreement details required'; end if;
    registered := (p_payload->>'gstRegistered')::boolean;
  else
    if nullif(trim(p_payload->>'reference'), '') is null then raise exception 'Reference required'; end if;
    if exists(select 1 from public.project_installer_payout_events where project_id = p_project_id and kind = p_kind
      and lower(trim(payload->>'reference')) = lower(trim(p_payload->>'reference'))) then raise exception 'Duplicate reference'; end if;
    select (payload->>'gstRegistered')::boolean into registered from public.project_installer_payout_events where project_id = p_project_id and kind = 'agreement';
  end if;
  if p_kind = 'invoice' then
    if jsonb_typeof(p_payload->'amount') is distinct from 'number' or (p_payload->>'amount')::numeric < 0
      or (p_payload->>'amount')::numeric > 1000000 or round((p_payload->>'amount')::numeric,2) <> (p_payload->>'amount')::numeric then raise exception 'Invalid invoice'; end if;
  else
    if jsonb_typeof(p_payload->'payoutExGst') is distinct from 'number' or jsonb_typeof(p_payload->'gst') is distinct from 'number'
      or jsonb_typeof(p_payload->'totalPayable') is distinct from 'number'
      or (p_payload->>'payoutExGst')::numeric < 0 or (p_payload->>'gst')::numeric < 0
      or (p_payload->>'totalPayable')::numeric <> (p_payload->>'payoutExGst')::numeric + (p_payload->>'gst')::numeric then raise exception 'Invalid payout'; end if;
    if (p_payload->>'payoutExGst')::numeric > 1000000 or round((p_payload->>'payoutExGst')::numeric,2) <> (p_payload->>'payoutExGst')::numeric
      or (p_payload->>'gst')::numeric <> (case when registered then round((p_payload->>'payoutExGst')::numeric * 0.15,2) else 0 end) then raise exception 'Invalid GST or precision'; end if;
    if p_kind = 'variation' and ((p_payload->>'payoutExGst')::numeric <= 0 or nullif(trim(p_payload->>'reason'),'') is null) then raise exception 'Positive agreed addition required'; end if;
  end if;
  insert into public.project_installer_payout_events(id,project_id,sequence,kind,payload,created_by)
    values(p_id,p_project_id,latest+1,p_kind,p_payload,auth.uid());
  return p_id;
end;
$$;
revoke all on function public.installer_payout_read(uuid) from public, anon;
revoke all on function public.installer_payout_append(uuid,uuid,integer,text,jsonb) from public, anon;
grant execute on function public.installer_payout_read(uuid) to authenticated;
grant execute on function public.installer_payout_append(uuid,uuid,integer,text,jsonb) to authenticated;
