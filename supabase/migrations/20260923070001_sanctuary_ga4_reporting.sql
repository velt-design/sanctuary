begin;
-- Source-owned refresh lifecycle. No credential or enabled grant is provisioned.
create table private.sanctuary_ga4_control (
 singleton boolean primary key default true check(singleton), actor_id uuid not null references auth.users(id),
 property_id text not null check(property_id~'^[1-9][0-9]{0,19}$'), binding_hash text not null check(binding_hash~'^[a-f0-9]{64}$'),
 vault_id text not null check(vault_id~'^[a-z2-7]{26}$'), item_id text not null check(item_id~'^[a-z2-7]{26}$'),
 enabled boolean not null default false, generation bigint not null default 1 check(generation>0),
 deletion_epoch bigint not null default 0 check(deletion_epoch>=0), expires_at timestamptz not null,
 source_key text not null, connection_id uuid not null, environment text not null
);
create table private.sanctuary_ga4_operations (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null, generation bigint not null, deletion_epoch bigint not null,
 binding_hash text not null, query jsonb not null,
 status text not null default 'working' check(status in ('working','report_ready','completed','report_failed','uncertain')),
 pending_step text, last_step text, calls integer not null default 0 check(calls between 0 and 6),
 vault_version bigint, requires_write boolean not null default false, report_intent jsonb, report_result jsonb, report_outcome text,
 result_hash text, created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 check(pending_step in ('vault_auth','vault_read','token_refresh','property_read','vault_write','report_read')),
 check(last_step in ('vault_auth','vault_read','token_refresh','property_read','vault_write','report_read')),
 check(report_outcome in ('complete','unavailable'))
);
create table private.sanctuary_ga4_snapshot (
 singleton boolean primary key default true check(singleton), operation_id uuid not null references private.sanctuary_ga4_operations(id),
 generation bigint not null, binding_hash text not null, payload text not null check(octet_length(payload) between 2 and 262144),
 result_hash text not null, fetched_at timestamptz not null, expires_at timestamptz not null,
 check(expires_at=fetched_at+interval '168 hours')
);
create table private.sanctuary_ga4_events (
 id bigint generated always as identity primary key, actor_id uuid not null, operation_id uuid,
 event text not null check(event in ('claim','before','after','finish','complete','read','delete','deliver','invalidated','expired')),
 step text, evidence jsonb, occurred_at timestamptz not null default clock_timestamp()
);
alter table private.sanctuary_ga4_control enable row level security;
alter table private.sanctuary_ga4_operations enable row level security;
alter table private.sanctuary_ga4_snapshot enable row level security;
alter table private.sanctuary_ga4_events enable row level security;
revoke all on private.sanctuary_ga4_control,private.sanctuary_ga4_operations,private.sanctuary_ga4_snapshot,private.sanctuary_ga4_events from public,anon,authenticated,service_role;
create function private.sanctuary_ga4_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'GA4 audit is append only';end $$;
create trigger sanctuary_ga4_audit_immutable before update or delete on private.sanctuary_ga4_events for each row execute function private.sanctuary_ga4_immutable();

create function public.sanctuary_ga4_command(p_actor uuid,p_property text,p_binding text,p_source text,p_connection uuid,p_environment text,
 p_action text,p_operation uuid default null,p_query jsonb default null,p_step text default null,p_evidence jsonb default null,p_payload text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sanctuary_ga4_control; o private.sanctuary_ga4_operations; s private.sanctuary_ga4_snapshot;
 expected text[]; k text; q jsonb; b jsonb; stamp timestamptz; h text; outcome text; days integer;
begin
 if p_actor is null or p_property is null or p_binding is null or p_source is null or p_connection is null or p_environment is null
 or p_action is null or p_action not in ('claim','before','after','finish','complete','read','delete','deliver') then raise exception 'Invalid GA4 command';end if;
 if (p_action<>'claim' and p_query is not null) or (p_action not in ('before','after') and p_step is not null)
 or (p_action not in ('before','after','finish') and p_evidence is not null) or (p_action<>'complete' and p_payload is not null)
 then raise exception 'Unexpected GA4 input';end if;
 perform pg_advisory_xact_lock(726230601);
 select * into c from private.sanctuary_ga4_control where singleton=true for update;
 if c.actor_id is distinct from p_actor or c.property_id is distinct from p_property
 or c.source_key is distinct from p_source or c.connection_id is distinct from p_connection or c.environment is distinct from p_environment
 or not exists(select 1 from praxis_reporting.source_identity_v1 i where i.singleton and i.source_key=p_source and i.connection_id=p_connection and i.environment=p_environment)
 or not exists(select 1 from auth.users u join public.portal_users pu on pu.user_id=u.id where u.id=p_actor and pu.role in ('admin','staff') and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()))
 then raise exception 'GA4 actor or source unavailable';end if;
 if p_action in ('read','delete','claim') and p_operation is not null then raise exception 'Unexpected GA4 operation';end if;
 if p_action='delete' then
  delete from private.sanctuary_ga4_snapshot where singleton=true;
  update private.sanctuary_ga4_control set deletion_epoch=deletion_epoch+1 where singleton=true;
  insert into private.sanctuary_ga4_events(actor_id,event)values(p_actor,'delete');return '{"status":"deleted"}';
 end if;
 -- Failure bookkeeping cannot create authority. Even revoked/expired work can
 -- be quarantined; only proven settled credential effects can be released.
 if p_action='finish' then
  if jsonb_typeof(p_evidence) is distinct from 'object' or p_evidence-'outcome'<>'{}'::jsonb
   or p_evidence->>'outcome' is null or p_evidence->>'outcome' not in ('connected','report_failed','uncertain') then raise exception 'Invalid GA4 outcome';end if;
  outcome:=p_evidence->>'outcome';
 end if;
 select * into o from private.sanctuary_ga4_operations where id=p_operation for update;
 if p_action not in ('claim','read') and (o.id is null or o.actor_id is distinct from p_actor or o.binding_hash is distinct from p_binding) then raise exception 'GA4 operation unavailable';end if;
 if p_action='finish' and outcome in ('report_failed','uncertain') then
  if o.status='uncertain' and outcome='uncertain' then return '{}';end if;
  if o.status not in ('working','report_ready') then raise exception 'GA4 operation already final';end if;
  if outcome='report_failed' and (o.pending_step is not null or o.requires_write or o.last_step is null or o.last_step not in ('property_read','vault_write','report_read')) then raise exception 'GA4 credential outcome unresolved';end if;
  update private.sanctuary_ga4_operations set status=outcome where id=o.id;
  insert into private.sanctuary_ga4_events(actor_id,operation_id,event,evidence)values(p_actor,o.id,'finish',p_evidence);return '{}';
 end if;
 if not c.enabled or c.binding_hash is distinct from p_binding or c.expires_at<=clock_timestamp()+interval '1 minute' then raise exception 'GA4 authority unavailable';end if;
 if p_action not in ('claim','read') and (o.generation<>c.generation or (p_action<>'deliver' and o.expires_at<=clock_timestamp())) then raise exception 'GA4 operation authority expired';end if;
 select * into s from private.sanctuary_ga4_snapshot where singleton=true for update;
 if s.singleton and (s.generation<>c.generation or s.binding_hash<>c.binding_hash or s.expires_at<=clock_timestamp()) then
  delete from private.sanctuary_ga4_snapshot where singleton=true;
  insert into private.sanctuary_ga4_events(actor_id,operation_id,event)values(p_actor,s.operation_id,'invalidated');s:=null;
 end if;
 if p_action in ('read','deliver') then
  if exists(select 1 from private.sanctuary_ga4_operations where status='uncertain' or (status in ('working','report_ready') and expires_at<=clock_timestamp())) then raise exception 'GA4 credentials quarantined';end if;
 end if;
 if p_action='read' then
  insert into private.sanctuary_ga4_events(actor_id,event)values(p_actor,'read');
  if s.singleton is null then return '{"status":"missing"}';end if;
  return jsonb_build_object('status','available','operation',s.operation_id,'generation',s.generation,'payload',s.payload,'resultHash',s.result_hash,'expiresAt',s.expires_at);
 end if;
 if p_action='claim' then
  q:=p_query;
  if q is null or octet_length(q::text)>512 or jsonb_typeof(q) is distinct from 'object' or q-ARRAY['period','comparison']<>'{}'::jsonb or not(q?'period' and q?'comparison')
   or jsonb_typeof(q->'period') is distinct from 'object' or (q->'period')-ARRAY['start','end']<>'{}'::jsonb then raise exception 'Invalid GA4 query';end if;
  if (q->'period'->>'start') is null or (q->'period'->>'end') is null or (q->'period'->>'start')!~'^\d{4}-\d{2}-\d{2}$' or (q->'period'->>'end')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid GA4 dates';end if;
  days:=(q->'period'->>'end')::date-(q->'period'->>'start')::date+1;
  if days not between 1 and 90 or (q->'period'->>'end')::date>=(clock_timestamp() at time zone 'UTC')::date then raise exception 'Invalid GA4 period';end if;
  if q->'comparison'<>'null'::jsonb then
   if jsonb_typeof(q->'comparison') is distinct from 'object' or (q->'comparison')-ARRAY['start','end']<>'{}'::jsonb
    or (q->'comparison'->>'start') is null or (q->'comparison'->>'end') is null
    or (q->'comparison'->>'start')!~'^\d{4}-\d{2}-\d{2}$' or (q->'comparison'->>'end')!~'^\d{4}-\d{2}-\d{2}$'
    or (q->'comparison'->>'end')::date-(q->'comparison'->>'start')::date+1<>days
    or (q->'comparison'->>'end')::date>=(q->'period'->>'start')::date then raise exception 'Invalid GA4 comparison';end if;
  end if;
  -- Lease expiry never authorizes another credential writer. Recovery is operator work.
  if exists(select 1 from private.sanctuary_ga4_operations where status in ('working','report_ready','uncertain')) then raise exception 'GA4 credential writer unresolved';end if;
  if (select count(*) from private.sanctuary_ga4_operations where created_at>clock_timestamp()-interval '1 hour')>=6 then raise exception 'GA4 read limit';end if;
  insert into private.sanctuary_ga4_operations(actor_id,generation,deletion_epoch,binding_hash,query,expires_at)
   values(p_actor,c.generation,c.deletion_epoch,p_binding,q,clock_timestamp()+interval '120 seconds')returning * into o;
  insert into private.sanctuary_ga4_events(actor_id,operation_id,event)values(p_actor,o.id,'claim');
  return jsonb_build_object('operation',o.id,'generation',o.generation);
 end if;
 if p_action='deliver' then
  if o.status<>'completed' or o.deletion_epoch<>c.deletion_epoch or s.operation_id is distinct from o.id or s.result_hash is distinct from o.result_hash then raise exception 'GA4 delivery unavailable';end if;
  insert into private.sanctuary_ga4_events(actor_id,operation_id,event)values(p_actor,o.id,'deliver');return '{}';
 end if;
 if p_action='complete' then
  if o.status<>'report_ready' or o.deletion_epoch<>c.deletion_epoch or p_payload is null or octet_length(p_payload) not between 2 and 262144 then raise exception 'GA4 report not ready';end if;
  b:=p_payload::jsonb;stamp:=(b->>'fetchedAt')::timestamptz;h:=encode(sha256(convert_to(p_payload,'UTF8')),'hex');
  if jsonb_typeof(b) is distinct from 'object'
   or b-ARRAY['source','property','timezone','fetchedAt','query','traffic','channels','landing','events','sessions','previousSessions','warnings','journey','business']<>'{}'::jsonb
   or not(b?&ARRAY['source','property','timezone','fetchedAt','query','traffic','channels','landing','events','sessions','previousSessions','warnings'])
   or jsonb_typeof(b->'traffic') is distinct from 'array' or jsonb_typeof(b->'channels') is distinct from 'array'
   or jsonb_typeof(b->'landing') is distinct from 'array' or jsonb_typeof(b->'events') is distinct from 'array'
   or jsonb_typeof(b->'warnings') is distinct from 'array' then raise exception 'Invalid GA4 report shape';end if;
  if b->>'source' is distinct from 'ga4' or b->>'property' is distinct from p_property or b->'query' is distinct from o.query
   or h is distinct from o.result_hash or stamp is null or stamp<o.created_at-interval '5 seconds' or stamp>clock_timestamp()+interval '5 seconds'
   or b->>'timezone' is distinct from o.report_result->>'timezone'
   or jsonb_array_length(b->'traffic')>90 or jsonb_array_length(b->'channels')>200 or jsonb_array_length(b->'landing')>200 or jsonb_array_length(b->'events')>200
   or jsonb_array_length(b->'warnings')>10
   or jsonb_array_length(b->'traffic')+jsonb_array_length(b->'channels')+jsonb_array_length(b->'landing')+jsonb_array_length(b->'events')<>(o.report_result->>'rowCount')::bigint
   or jsonb_array_length(b->'warnings')<>(o.report_result->>'warningCount')::bigint
   or b->>'timezone' is null or not exists(select 1 from pg_timezone_names where name=b->>'timezone') then raise exception 'GA4 report association unavailable';end if;
  delete from private.sanctuary_ga4_snapshot where singleton=true;
  insert into private.sanctuary_ga4_snapshot(operation_id,generation,binding_hash,payload,result_hash,fetched_at,expires_at)
   values(o.id,c.generation,c.binding_hash,p_payload,h,stamp,stamp+interval '168 hours');
  update private.sanctuary_ga4_operations set status='completed' where id=o.id;
  insert into private.sanctuary_ga4_events(actor_id,operation_id,event)values(p_actor,o.id,'complete');
  return jsonb_build_object('status','completed','operation',o.id);
 end if;
 if p_action='finish' then
  if o.status<>'working' or o.pending_step is not null or o.last_step is distinct from 'report_read' or o.report_outcome is distinct from 'complete' or o.requires_write then raise exception 'GA4 report evidence incomplete';end if;
  update private.sanctuary_ga4_operations set status='report_ready' where id=o.id;
  insert into private.sanctuary_ga4_events(actor_id,operation_id,event,evidence)values(p_actor,o.id,'finish',p_evidence);return '{}';
 end if;
 if o.status<>'working' or p_step is null or p_step not in ('vault_auth','vault_read','token_refresh','property_read','vault_write','report_read')
  or jsonb_typeof(p_evidence) is distinct from 'object' or octet_length(p_evidence::text)>2048 then raise exception 'Invalid GA4 boundary';end if;
 expected:=case p_step
  when 'vault_auth' then ARRAY[]::text[]
  when 'vault_read' then case when p_action='before' then ARRAY['itemId','vaultId'] else ARRAY['afterVersion','itemId','vaultId'] end
  when 'token_refresh' then case when p_action='before' then ARRAY[]::text[] else ARRAY['expiresIn','refreshRotated','scope'] end
  when 'property_read' then ARRAY['property']
  when 'vault_write' then case when p_action='before' then ARRAY['beforeVersion','itemId','vaultId'] else ARRAY['afterVersion','beforeVersion','itemId','vaultId'] end
  else ARRAY['comparisonEnd','comparisonStart','endDate','property','queryHash','reportVersion','startDate'] end;
 if p_step='report_read' and p_action='after' then
  expected:=expected||case when p_evidence->>'reportOutcome'='complete' then ARRAY['reportOutcome','resultHash','rowCount','timezone','warningCount'] else ARRAY['reportOutcome'] end;
 end if;
 if (select array_agg(key order by key) from jsonb_object_keys(p_evidence)key) is distinct from (select array_agg(key order by key) from unnest(expected)key) then raise exception 'Unexpected GA4 evidence';end if;
 foreach k in array expected loop
  if k in ('beforeVersion','afterVersion','expiresIn','rowCount','warningCount') then
   if jsonb_typeof(p_evidence->k) is distinct from 'number' or (p_evidence->>k)!~'^(0|[1-9][0-9]*)$' or (p_evidence->>k)::numeric>9007199254740991
    or (k in ('beforeVersion','afterVersion','expiresIn') and (p_evidence->>k)::numeric<1)
    or (k='expiresIn' and (p_evidence->>k)::numeric>86400) then raise exception 'Invalid GA4 numeric evidence';end if;
  elsif k='refreshRotated' then
   if jsonb_typeof(p_evidence->k) is distinct from 'boolean' then raise exception 'Invalid GA4 rotation evidence';end if;
  elsif k in ('comparisonStart','comparisonEnd') and o.query->'comparison'='null'::jsonb then
   if p_evidence->k is distinct from 'null'::jsonb then raise exception 'Invalid GA4 comparison evidence';end if;
  elsif jsonb_typeof(p_evidence->k) is distinct from 'string' then raise exception 'Invalid GA4 text evidence';end if;
 end loop;
 if p_evidence?'vaultId' and (p_evidence->>'vaultId' is distinct from c.vault_id or p_evidence->>'itemId' is distinct from c.item_id) then raise exception 'GA4 vault mismatch';end if;
 if p_evidence?'property' and p_evidence->>'property' is distinct from p_property then raise exception 'GA4 property mismatch';end if;
 if p_evidence?'scope' and p_evidence->>'scope'<>'https://www.googleapis.com/auth/analytics.readonly' then raise exception 'GA4 scope mismatch';end if;
 if p_step='vault_write' and ((p_evidence->>'beforeVersion')::bigint is distinct from o.vault_version or (p_action='after' and (p_evidence->>'afterVersion')::bigint<=o.vault_version)) then raise exception 'GA4 vault version mismatch';end if;
 if p_step='report_read' then
  if p_evidence->>'reportVersion'<>'sanctuary-ga4-v2' or (p_evidence->>'queryHash')!~'^[a-f0-9]{64}$'
   or p_evidence->>'startDate' is distinct from o.query->'period'->>'start' or p_evidence->>'endDate' is distinct from o.query->'period'->>'end'
   or p_evidence->>'comparisonStart' is distinct from o.query->'comparison'->>'start' or p_evidence->>'comparisonEnd' is distinct from o.query->'comparison'->>'end'
   or (p_action='after' and (p_evidence-ARRAY['reportOutcome','resultHash','rowCount','timezone','warningCount']) is distinct from o.report_intent)
   or (p_action='after' and p_evidence->>'reportOutcome' not in ('complete','unavailable')) then raise exception 'GA4 report intent mismatch';end if;
  if p_action='after' and p_evidence->>'reportOutcome'='complete' and ((p_evidence->>'resultHash')!~'^[a-f0-9]{64}$' or not exists(select 1 from pg_timezone_names where name=p_evidence->>'timezone')) then raise exception 'GA4 report result mismatch';end if;
 end if;
 if p_action='before' then
  if o.pending_step is not null or o.calls>=6 or (
   (o.last_step is null and p_step='vault_auth') or (o.last_step='vault_auth' and p_step='vault_read')
   or (o.last_step='vault_read' and p_step='token_refresh') or (o.last_step='token_refresh' and p_step='property_read')
   or (o.last_step='property_read' and o.requires_write and p_step='vault_write')
   or (o.last_step in ('property_read','vault_write') and not o.requires_write and p_step='report_read')
  ) is not true then raise exception 'GA4 step out of order';end if;
  update private.sanctuary_ga4_operations set pending_step=p_step,calls=calls+1,
   report_intent=case when p_step='report_read' then p_evidence else report_intent end where id=o.id;
 else
  if o.pending_step is distinct from p_step then raise exception 'GA4 result has no intent';end if;
  update private.sanctuary_ga4_operations set pending_step=null,last_step=p_step,
   vault_version=case when p_step in ('vault_read','vault_write') then (p_evidence->>'afterVersion')::bigint else vault_version end,
   requires_write=case when p_step='token_refresh' then (p_evidence->>'refreshRotated')::boolean when p_step='vault_write' then false else requires_write end,
   report_outcome=case when p_step='report_read' then p_evidence->>'reportOutcome' else report_outcome end,
   report_result=case when p_step='report_read' then p_evidence else report_result end,
   result_hash=case when p_step='report_read' then p_evidence->>'resultHash' else result_hash end where id=o.id;
 end if;
 insert into private.sanctuary_ga4_events(actor_id,operation_id,event,step,evidence)values(p_actor,o.id,p_action,p_step,p_evidence);return '{}';
end $$;
revoke all on function public.sanctuary_ga4_command(uuid,text,text,text,uuid,text,text,uuid,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.sanctuary_ga4_command(uuid,text,text,text,uuid,text,text,uuid,jsonb,text,jsonb,text) to service_role;

create function private.sanctuary_ga4_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if row(new.enabled,new.binding_hash,new.actor_id,new.property_id,new.vault_id,new.item_id,new.source_key,new.connection_id,new.environment,new.expires_at)
 is distinct from row(old.enabled,old.binding_hash,old.actor_id,old.property_id,old.vault_id,old.item_id,old.source_key,old.connection_id,old.environment,old.expires_at) then
  new.generation:=old.generation+1;delete from private.sanctuary_ga4_snapshot where singleton=true;
  insert into private.sanctuary_ga4_events(actor_id,event)values(old.actor_id,'invalidated');
 elsif new.generation is distinct from old.generation then raise exception 'GA4 generation is managed';end if;
 return new;
end $$;
create trigger sanctuary_ga4_control_change before update on private.sanctuary_ga4_control for each row execute function private.sanctuary_ga4_changed();
revoke all on function private.sanctuary_ga4_changed(),private.sanctuary_ga4_immutable() from public,anon,authenticated,service_role;
create function public.sanctuary_ga4_purge() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(726230601);
 with removed as(delete from private.sanctuary_ga4_snapshot s where s.singleton=true and (s.expires_at<=clock_timestamp()
  or not exists(select 1 from private.sanctuary_ga4_control c where c.singleton=true and c.enabled and c.expires_at>clock_timestamp() and c.binding_hash=s.binding_hash and c.generation=s.generation)) returning operation_id)
 insert into private.sanctuary_ga4_events(actor_id,operation_id,event)select o.actor_id,r.operation_id,'expired' from removed r join private.sanctuary_ga4_operations o on o.id=r.operation_id;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.sanctuary_ga4_purge() from public,anon,authenticated;
grant execute on function public.sanctuary_ga4_purge() to service_role;
select cron.schedule('sanctuary-ga4-retention-hourly','39 * * * *','SET statement_timeout = ''30s''; SELECT public.sanctuary_ga4_purge();');
commit;
