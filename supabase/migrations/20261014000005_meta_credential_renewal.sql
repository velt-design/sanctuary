-- Default-off credential authority. No seed, token, permission or expiry extension.
alter table private.meta_sale_control add column credential_mode text not null default 'legacy' check(credential_mode in('legacy','vault'));
do $$ declare row record; total int:=0;
begin
  for row in select conname,pg_get_constraintdef(oid) definition from pg_constraint
    where conrelid='private.meta_sale_control'::regclass and contype='c' and pg_get_constraintdef(oid) like '%credential_expires_at IS NOT NULL%' loop
    total:=total+1;
    execute format('alter table private.meta_sale_control drop constraint %I',row.conname);
    execute format('alter table private.meta_sale_control add constraint %I %s',row.conname,
      replace(row.definition,'(credential_expires_at IS NOT NULL)','((credential_expires_at IS NOT NULL) OR (credential_mode = ''vault''::text))'));
  end loop;
  if total<>1 then raise exception 'Meta sale expiry constraint baseline changed'; end if;
end $$;
create table private.meta_credentials (
  capability text primary key check(capability in('reports','sales')),
  actor_id uuid not null references auth.users(id), binding text not null check(binding ~ '^[a-f0-9]{64}$'),
  identity jsonb not null check(jsonb_typeof(identity)='object' and octet_length(identity::text)<4000),
  enabled boolean not null default false, renewal_enabled boolean not null default false,
  approval_expires_at timestamptz, ongoing_approved_at timestamptz, approval_ref text,
  asset_verified_at timestamptz, asset_evidence_ref text, asset_revoked_at timestamptz,
  generation bigint not null default 1, revision bigint not null default 1,
  token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'), vault_version bigint not null check(vault_version>0),
  token_expires_at timestamptz, data_access_expires_at timestamptz,
  state text not null default 'READY' check(state in('READY','EXCHANGE_PENDING','VAULT_PENDING','REVIEW_REQUIRED')),
  candidate_hash text, candidate_expires_at timestamptz, candidate_data_access_expires_at timestamptz,
  candidate_vault_version bigint, checked_at timestamptz, next_renewal_at timestamptz,
  last_error text check(last_error is null or last_error in('CREDENTIAL_OPERATION_FAILED','EXCHANGE_RECONCILED')),
  check(not enabled or (approval_ref is not null and length(approval_ref) between 1 and 200
    and (approval_expires_at is not null or ongoing_approved_at is not null)
    and asset_verified_at is not null and asset_evidence_ref is not null and length(asset_evidence_ref) between 1 and 200)),
  check(identity->>'capability'=capability and identity->>'actorId'=actor_id::text),
  check(candidate_hash is null or candidate_hash ~ '^[a-f0-9]{64}$')
);
create table private.meta_credential_operations (
  id uuid primary key default gen_random_uuid(), capability text not null references private.meta_credentials(capability),
  generation bigint not null, purpose text not null check(purpose in('use','renew','reconcile')),
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  finished_at timestamptz, result text
);
create unique index meta_credential_one_active on private.meta_credential_operations(capability) where finished_at is null;
create table private.meta_credential_events (
  id bigint generated always as identity primary key, capability text not null, operation_id uuid,
  event text not null, revision bigint not null, vault_version bigint not null,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table private.meta_credentials enable row level security;
alter table private.meta_credential_operations enable row level security;
alter table private.meta_credential_events enable row level security;
revoke all on private.meta_credentials,private.meta_credential_operations,private.meta_credential_events from public,anon,authenticated,service_role;
create function private.meta_credential_audit_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Meta credential audit is append only'; end $$;
create trigger meta_credential_audit_immutable before update or delete on private.meta_credential_events
  for each row execute function private.meta_credential_audit_immutable();
revoke all on function private.meta_credential_audit_immutable() from public,anon,authenticated,service_role;

create function private.meta_credential_policy_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if row(new.actor_id,new.binding,new.identity,new.enabled,new.renewal_enabled,new.approval_expires_at,new.ongoing_approved_at,new.approval_ref,
    new.asset_verified_at,new.asset_evidence_ref,new.asset_revoked_at) is distinct from
    row(old.actor_id,old.binding,old.identity,old.enabled,old.renewal_enabled,old.approval_expires_at,old.ongoing_approved_at,old.approval_ref,
    old.asset_verified_at,old.asset_evidence_ref,old.asset_revoked_at) then
    new.generation:=old.generation+1;
    update private.meta_credential_operations set finished_at=clock_timestamp(),result='AUTHORITY_CHANGED'
      where capability=old.capability and finished_at is null;
    -- Uncertain effects and their candidate fingerprint are never erased by policy changes.
  end if;
  return new;
end $$;
create trigger meta_credential_policy_changed before update on private.meta_credentials for each row execute function private.meta_credential_policy_changed();
revoke all on function private.meta_credential_policy_changed() from public,anon,authenticated,service_role;

create function private.meta_credential_approved(c private.meta_credentials) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select coalesce(c.enabled and c.asset_revoked_at is null and c.asset_verified_at<=now() and c.asset_evidence_ref is not null
    and c.approval_ref is not null and (c.ongoing_approved_at<=now() or c.approval_expires_at>now()+interval '1 minute')
    and exists(select 1 from auth.users u join public.portal_users p on p.user_id=u.id where u.id=c.actor_id
      and p.role in('admin','staff') and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()))
    and case when c.capability='reports' then exists(select 1 from private.sanctuary_meta_control s where s.singleton=true
      and s.actor_id=c.actor_id and s.binding_hash=c.binding and s.account_id=c.identity->>'targetId')
      else exists(select 1 from private.meta_sale_control s where s.singleton=true and s.actor_id=c.actor_id
        and s.binding_sha256=c.binding and s.dataset_id=c.identity->>'targetId' and s.credential_mode='vault' and s.assignment_verified_at is not null) end,false)
$$;
-- Existing finite controls remain authoritative unless an explicit matching vault row is provisioned.
create function private.meta_credential_expiry(p_capability text,p_binding text,p_legacy timestamptz) returns timestamptz
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare c private.meta_credentials;
begin
  select * into c from private.meta_credentials where capability=p_capability;
  if not found then return p_legacy; end if;
  if c.binding is distinct from p_binding or not private.meta_credential_approved(c) or c.state<>'READY'
    or exists(select 1 from private.meta_credential_operations o where o.capability=p_capability and o.purpose<>'use' and o.finished_at is null and o.expires_at>now()) then return '-infinity'; end if;
  return least(coalesce(c.token_expires_at,'infinity'),coalesce(c.data_access_expires_at,'infinity'),
    case when c.ongoing_approved_at<=now() then 'infinity'::timestamptz else c.approval_expires_at end);
end $$;
revoke all on function private.meta_credential_approved(private.meta_credentials),private.meta_credential_expiry(text,text,timestamptz) from public,anon,authenticated,service_role;

create function private.meta_credential_retention_allowed(p_binding text,p_legacy timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare c private.meta_credentials;
begin
  select * into c from private.meta_credentials where capability='reports';
  if not found then return p_legacy>now(); end if;
  -- A short credential exchange or provider outage must not erase an authorized
  -- seven-day report. Its original fetched_at/expires_at remain unchanged.
  return c.binding=p_binding and private.meta_credential_approved(c);
end $$;
revoke all on function private.meta_credential_retention_allowed(text,timestamptz) from public,anon,authenticated,service_role;

create function public.meta_credential_command(p_actor uuid,p_capability text,p_binding text,p_action text,p_operation uuid default null,p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c private.meta_credentials; o private.meta_credential_operations; purpose text; v bigint;
begin
  if auth.role() is distinct from 'service_role' or p_capability is null or p_capability not in('reports','sales')
    or p_action is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>5000 then raise exception 'Credential service authority required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('meta-credential-'||p_capability,0));
  select * into strict c from private.meta_credentials where capability=p_capability for update;
  if c.actor_id is distinct from p_actor or c.binding is distinct from p_binding or not private.meta_credential_approved(c) then
    raise exception 'Credential authority unavailable' using errcode='42501'; end if;
  if p_action='status' and p_operation is null then return jsonb_build_object('state',c.state); end if;
  if p_action='begin' then
    purpose:=p_input->>'purpose';
    if p_input->'identity' is distinct from c.identity or purpose is null or purpose not in('use','renew','reconcile') then raise exception 'Credential identity changed'; end if;
    if exists(select 1 from private.meta_credential_operations where capability=p_capability and finished_at is null and expires_at>clock_timestamp()) then raise exception 'Credential lease busy' using errcode='55000'; end if;
    if (purpose<>'reconcile' and c.state<>'READY') or (purpose='reconcile' and c.state not in('EXCHANGE_PENDING','VAULT_PENDING')) then raise exception 'Credential reconciliation required'; end if;
    if (purpose<>'use' and not c.renewal_enabled) or (purpose='renew' and c.token_expires_at<=now()+interval '1 minute') then raise exception 'Credential renewal unavailable'; end if;
    if purpose='renew' and (c.token_expires_at is null or c.token_expires_at>now()+interval '14 days' or c.next_renewal_at>now()) then return '{"skip":true}'; end if;
    if purpose='use' and not (case when p_capability='reports' then (select enabled from private.sanctuary_meta_control where singleton=true)
      else (select uploads_enabled from private.meta_sale_control where singleton=true) end) then raise exception 'Source capability disabled'; end if;
    if purpose='use' and private.meta_credential_expiry(p_capability,p_binding,null)<=now()+interval '1 minute' then raise exception 'Credential expired'; end if;
    if purpose<>'use' and (case when p_capability='reports' then exists(select 1 from private.sanctuary_meta_operations where stage not in('completed','failed') and expires_at>now())
      else exists(select 1 from private.meta_sale_runs where finished_at is null and expires_at>now()) end) then raise exception 'Source operation active'; end if;
    update private.meta_credential_operations set finished_at=clock_timestamp(),result='LEASE_EXPIRED' where capability=p_capability and finished_at is null;
    insert into private.meta_credential_operations(capability,generation,purpose,expires_at) values(p_capability,c.generation,purpose,clock_timestamp()+interval '5 minutes') returning * into o;
    insert into private.meta_credential_events(capability,operation_id,event,revision,vault_version) values(p_capability,o.id,'begin_'||purpose,c.revision,c.vault_version);
    return jsonb_build_object('operation',o.id,'state',c.state,'tokenHash',c.token_hash,'vaultVersion',c.vault_version,'expiresAt',c.token_expires_at,
      'dataAccessExpiresAt',c.data_access_expires_at,'candidateHash',c.candidate_hash,'candidateExpiresAt',c.candidate_expires_at,
      'candidateDataAccessExpiresAt',c.candidate_data_access_expires_at,'candidateVaultVersion',c.candidate_vault_version);
  end if;
  select * into strict o from private.meta_credential_operations where id=p_operation and capability=p_capability for update;
  if o.generation<>c.generation or o.finished_at is not null or o.expires_at<=clock_timestamp() then raise exception 'Credential lease unavailable'; end if;
  if p_action='check' then
    if o.purpose='use' and private.meta_credential_expiry(p_capability,p_binding,null)<=now()+interval '1 minute' then raise exception 'Credential expired'; end if;
    return '{}';
  elsif p_action='exchange_pending' and o.purpose='renew' and c.state='READY' and c.renewal_enabled then
    update private.meta_credentials set state='EXCHANGE_PENDING' where capability=p_capability;
  elsif p_action='vault_pending' and o.purpose='renew' and c.state='EXCHANGE_PENDING' then
    if p_input->>'tokenHash' is null or p_input->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or (p_input->>'expiresAt')::timestamptz is null or (p_input->>'expiresAt')::timestamptz<=c.token_expires_at
      or (p_input->>'expiresAt')::timestamptz>now()+interval '61 days'
      or (p_input->>'dataAccessExpiresAt')::timestamptz<=now()+interval '1 minute' then raise exception 'Invalid replacement credential'; end if;
    update private.meta_credentials set state='VAULT_PENDING',candidate_hash=p_input->>'tokenHash',candidate_expires_at=(p_input->>'expiresAt')::timestamptz,
      candidate_data_access_expires_at=(p_input->>'dataAccessExpiresAt')::timestamptz,candidate_vault_version=c.vault_version where capability=p_capability;
  elsif p_action='activate' and o.purpose in('renew','reconcile') and c.state='VAULT_PENDING' then
    v:=(p_input->>'vaultVersion')::bigint;
    if v is null or v<=c.vault_version or c.candidate_hash is null or c.candidate_expires_at<=now()+interval '1 minute' then raise exception 'Credential version could not be confirmed'; end if;
    update private.meta_credentials set state='READY',token_hash=candidate_hash,token_expires_at=candidate_expires_at,data_access_expires_at=candidate_data_access_expires_at,
      vault_version=v,revision=revision+1,candidate_hash=null,candidate_expires_at=null,candidate_data_access_expires_at=null,candidate_vault_version=null,
      checked_at=now(),last_error=null,next_renewal_at=null where capability=p_capability;
  elsif p_action='exchange_reconciled' and o.purpose='reconcile' and c.state='EXCHANGE_PENDING' then
    if (p_input->>'vaultVersion')::bigint is distinct from c.vault_version or c.token_expires_at<=now()+interval '1 minute' then raise exception 'Previous credential unavailable'; end if;
    update private.meta_credentials set state='READY',checked_at=now(),last_error='EXCHANGE_RECONCILED',next_renewal_at=now()+interval '1 day' where capability=p_capability;
  elsif p_action='quarantine' and o.purpose='renew' and c.state='EXCHANGE_PENDING' then
    update private.meta_credentials set state='REVIEW_REQUIRED',last_error='CREDENTIAL_OPERATION_FAILED' where capability=p_capability;
  elsif p_action in('finish','failed') then
    if p_action='finish' and c.state<>'READY' then raise exception 'Credential effect remains uncertain'; end if;
    update private.meta_credential_operations set finished_at=clock_timestamp(),result=case when p_action='failed' then 'CREDENTIAL_OPERATION_FAILED' else 'COMPLETED' end where id=p_operation;
    if p_action='failed' then update private.meta_credentials set last_error='CREDENTIAL_OPERATION_FAILED' where capability=p_capability; end if;
    if p_action='finish' then update private.meta_credentials set last_error=null,checked_at=now() where capability=p_capability; end if;
  else raise exception 'Invalid credential transition'; end if;
  insert into private.meta_credential_events(capability,operation_id,event,revision,vault_version)
    select capability,p_operation,p_action,revision,vault_version from private.meta_credentials where capability=p_capability;
  return '{}';
end $$;
revoke all on function public.meta_credential_command(uuid,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.meta_credential_command(uuid,text,text,text,uuid,jsonb) to service_role;

create function private.meta_credential_health() returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select coalesce(jsonb_object_agg(capability,jsonb_build_object('state',case
    when not enabled then 'DISABLED' when not private.meta_credential_approved(c) then 'AUTHORITY_REQUIRED'
    when state='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when state<>'READY' then 'RECONCILIATION_REQUIRED'
    when least(coalesce(token_expires_at,'infinity'),coalesce(data_access_expires_at,'infinity'))<=now()+interval '1 minute' then 'EXPIRED'
    when last_error='CREDENTIAL_OPERATION_FAILED' then 'REVIEW_REQUIRED'
    when exists(select 1 from private.meta_credential_operations o where o.capability=c.capability and o.finished_at is null and o.expires_at<=now()) then 'REVIEW_REQUIRED'
    when not renewal_enabled and token_expires_at is not null then 'RENEWAL_DISABLED' else 'READY' end,
    'tokenExpiresAt',token_expires_at,'dataAccessExpiresAt',data_access_expires_at,
    'approvalEndsAt',case when ongoing_approved_at<=now() then null else approval_expires_at end,
    'assetVerifiedAt',asset_verified_at,'checkedAt',checked_at)),'{}') from private.meta_credentials c
$$;
revoke all on function private.meta_credential_health() from public,anon,authenticated,service_role;

-- Change only expiration authority and take the same lock as credential renewal.
-- No report generation, scope policy, event body, ID, attempt or receipt changes.
do $$ declare definition text; needle text; replacement text; target text; pair text[];
begin
  foreach pair slice 1 in array array[
    ['public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text)',
      'c.expires_at<=clock_timestamp()+interval ''1 minute''',
      'private.meta_credential_expiry(''reports'',c.binding_hash,c.expires_at)<=clock_timestamp()+interval ''1 minute'''],
    ['public.sanctuary_meta_purge()',
      'c.expires_at>clock_timestamp()',
      'private.meta_credential_retention_allowed(c.binding_hash,c.expires_at)'],
    ['private.meta_sale_authority(uuid,text,uuid)',
      'c.credential_expires_at<=clock_timestamp()+interval ''1 minute''',
      'private.meta_credential_expiry(''sales'',c.binding_sha256,c.credential_expires_at)<=clock_timestamp()+interval ''1 minute'''],
    ['public.meta_sale_command(uuid,text,text,uuid,jsonb)',
      'c.credential_expires_at is null or c.credential_expires_at<=now()+interval ''1 minute''',
      'private.meta_credential_expiry(''sales'',c.binding_sha256,c.credential_expires_at) is null or private.meta_credential_expiry(''sales'',c.binding_sha256,c.credential_expires_at)<=now()+interval ''1 minute'''],
    ['public.meta_sale_staff_read()',
      'c.credential_expires_at is null or c.credential_expires_at<=now()+interval ''1 minute''',
      'private.meta_credential_expiry(''sales'',c.binding_sha256,c.credential_expires_at) is null or private.meta_credential_expiry(''sales'',c.binding_sha256,c.credential_expires_at)<=now()+interval ''1 minute''']
  ] loop
    target:=pair[1];needle:=pair[2];replacement:=pair[3];
    select pg_get_functiondef(target::regprocedure) into definition;
    if length(definition)-length(replace(definition,needle,''))<>length(needle) then raise exception 'Meta expiry baseline changed: %',target;end if;
    definition:=replace(definition,needle,replacement);
    if target like 'public.sanctuary_meta_command%' then
      definition:=replace(definition,'perform pg_advisory_xact_lock(726230501);','perform pg_advisory_xact_lock(hashtextextended(''meta-credential-reports'',0)); perform pg_advisory_xact_lock(726230501);');
    elsif target like 'private.meta_sale_authority%' then
      definition:=replace(definition,'select * into strict c from private.meta_sale_control','perform pg_advisory_xact_lock(hashtextextended(''meta-credential-sales'',0)); select * into strict c from private.meta_sale_control');
    elsif target='public.meta_sale_staff_read()' then
      definition:=replace(definition,'return jsonb_build_object(''enabled''','return jsonb_build_object(''credentials'',private.meta_credential_health(),''enabled''');
    end if;
    execute definition;
  end loop;
end $$;
