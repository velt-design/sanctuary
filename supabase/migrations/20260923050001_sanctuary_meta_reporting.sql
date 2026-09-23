begin;
-- Source-owned, default-disabled control. Provisioning is a separate operation.
create table private.sanctuary_meta_control (
 singleton boolean primary key default true check(singleton), actor_id uuid not null references auth.users(id),
 account_id text not null check(account_id~'^[1-9][0-9]{0,19}$'), binding_hash text not null check(binding_hash~'^[a-f0-9]{64}$'),
 enabled boolean not null default false, generation bigint not null default 1 check(generation>0),
 expires_at timestamptz not null, source_key text not null, connection_id uuid not null, environment text not null
);
create table private.sanctuary_meta_operations (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null, generation bigint not null, binding_hash text not null,
 query text not null, stage text not null check(stage in ('claimed','before','after','completed','failed')),
 step text, calls integer not null default 0, created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 result_hash text
);
create table private.sanctuary_meta_snapshot (
 singleton boolean primary key default true check(singleton), operation_id uuid not null references private.sanctuary_meta_operations(id),
 generation bigint not null, binding_hash text not null, payload text not null check(octet_length(payload) between 2 and 262144),
 result_hash text not null, fetched_at timestamptz not null, expires_at timestamptz not null,
 check(expires_at=fetched_at+interval '168 hours')
);
create table private.sanctuary_meta_events (
 id bigint generated always as identity primary key, actor_id uuid not null, operation_id uuid,
 event text not null check(event in ('claim','before','after','complete','failed','read','delete','expired','invalidated','deliver')),
 step text check(step in ('identity_check','account_read','report_read')), result_hash text,
 occurred_at timestamptz not null default clock_timestamp()
);
alter table private.sanctuary_meta_control enable row level security;
alter table private.sanctuary_meta_operations enable row level security;
alter table private.sanctuary_meta_snapshot enable row level security;
alter table private.sanctuary_meta_events enable row level security;
revoke all on private.sanctuary_meta_control,private.sanctuary_meta_operations,private.sanctuary_meta_snapshot,private.sanctuary_meta_events from public,anon,authenticated,service_role;
create function private.sanctuary_meta_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Meta audit is append only';end $$;
create trigger sanctuary_meta_audit_immutable before update or delete on private.sanctuary_meta_events for each row execute function private.sanctuary_meta_immutable();
create function public.sanctuary_meta_command(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,
 p_action text,p_operation uuid default null,p_query text default null,p_step text default null,p_payload text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sanctuary_meta_control; o private.sanctuary_meta_operations; s private.sanctuary_meta_snapshot;
 b jsonb; stamp timestamptz; h text; q jsonb;
begin
 if p_actor is null or p_account is null or p_binding is null or p_source is null or p_connection is null or p_environment is null
 or p_action is null or p_action not in ('claim','before','after','complete','failed','read','delete','deliver') then raise exception 'Invalid Meta command';end if;
 perform pg_advisory_xact_lock(726230501);
 select * into c from private.sanctuary_meta_control where singleton for update;
 if c.actor_id is distinct from p_actor or c.account_id is distinct from p_account
 or c.source_key is distinct from p_source or c.connection_id is distinct from p_connection or c.environment is distinct from p_environment
 or not exists(select 1 from praxis_reporting.source_identity_v1 i where i.singleton and i.source_key=p_source and i.connection_id=p_connection and i.environment=p_environment)
 or not exists(select 1 from auth.users u join public.portal_users pu on pu.user_id=u.id where u.id=p_actor and pu.role in ('admin','staff') and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()))
 then raise exception 'Meta actor or source unavailable';end if;
 if p_action in ('read','delete') and (p_operation is not null or p_query is not null or p_step is not null or p_payload is not null) then raise exception 'Unexpected Meta input';end if;
 if p_action='delete' then
 delete from private.sanctuary_meta_snapshot;
 insert into private.sanctuary_meta_events(actor_id,event)values(p_actor,'delete');return '{"status":"deleted"}';end if;
 if c.enabled is not true or c.binding_hash is distinct from p_binding or c.expires_at<=clock_timestamp()+interval '1 minute' then raise exception 'Meta authority unavailable';end if;
 select * into s from private.sanctuary_meta_snapshot where singleton for update;
 if s.singleton and (s.generation<>c.generation or s.binding_hash<>c.binding_hash or s.expires_at<=clock_timestamp()) then
 delete from private.sanctuary_meta_snapshot;
 insert into private.sanctuary_meta_events(actor_id,operation_id,event) values(p_actor,s.operation_id,'invalidated');s:=null;end if;
 if p_action='read' then
 insert into private.sanctuary_meta_events(actor_id,event) values(p_actor,'read');
 if s.singleton is null then return '{"status":"missing"}';end if;
 return jsonb_build_object('status','available','operation',s.operation_id,'generation',s.generation,'resultHash',s.result_hash,'payload',s.payload,'expiresAt',s.expires_at);end if;
 if p_action='claim' then
 if p_operation is not null or p_payload is not null or p_step is not null or p_query is null or octet_length(p_query)>128 then raise exception 'Invalid Meta claim';end if;
 q:=p_query::jsonb;
 if (select count(*) from jsonb_object_keys(q))<>3 or jsonb_typeof(q->'retain') is distinct from 'boolean' or q->>'start' is null or q->>'end' is null
 or (q->>'end')::date-(q->>'start')::date<>6 then raise exception 'Invalid Meta dates';end if;
 if exists(select 1 from private.sanctuary_meta_operations where expires_at>clock_timestamp() and stage not in ('completed','failed'))
 or (select count(*) from private.sanctuary_meta_operations where created_at>clock_timestamp()-interval '1 hour')>=6 then raise exception 'Meta read limit';end if;
 insert into private.sanctuary_meta_operations(actor_id,generation,binding_hash,query,stage,expires_at)
 values(p_actor,c.generation,c.binding_hash,p_query,'claimed',clock_timestamp()+interval '90 seconds') returning * into o;
 insert into private.sanctuary_meta_events(actor_id,operation_id,event)values(p_actor,o.id,'claim');
 return jsonb_build_object('operation',o.id,'generation',o.generation);end if;
 select * into o from private.sanctuary_meta_operations where id=p_operation for update;
 if p_action='deliver' then
 if o.id is null or o.actor_id<>p_actor or o.generation<>c.generation or o.binding_hash<>c.binding_hash or o.expires_at<=clock_timestamp()
 or o.stage<>'completed' or p_query is not null or p_step is not null or p_payload is not null
 or exists(select 1 from private.sanctuary_meta_events where event='delete' and occurred_at>=o.created_at)
 or ((o.query::jsonb->>'retain')::boolean and (s.operation_id is distinct from o.id or s.result_hash is distinct from o.result_hash))
 then raise exception 'Meta delivery authority unavailable';end if;
 insert into private.sanctuary_meta_events(actor_id,operation_id,event,result_hash)values(p_actor,o.id,'deliver',o.result_hash);return '{}';end if;
 if o.id is null or o.actor_id<>p_actor or o.generation<>c.generation or o.binding_hash<>c.binding_hash or o.expires_at<=clock_timestamp()
 or o.stage in ('completed','failed') then raise exception 'Meta operation unavailable';end if;
 if p_action in ('before','after') then
 if p_query is not null or p_payload is not null or p_step is null or p_step not in ('identity_check','account_read','report_read') then raise exception 'Invalid Meta boundary';end if;
 if p_action='before' then
 if o.calls>=5 or not ((o.stage='claimed' and p_step='identity_check') or (o.stage='after' and o.step='identity_check' and p_step='account_read') or (o.stage='after' and o.step in ('account_read','report_read') and p_step='report_read')) then raise exception 'Invalid Meta step';end if;
 update private.sanctuary_meta_operations set stage='before',step=p_step,calls=calls+1 where id=o.id;
 else
 if o.stage<>'before' or o.step<>p_step then raise exception 'Invalid Meta completion';end if;
 update private.sanctuary_meta_operations set stage='after' where id=o.id;
 end if;
 insert into private.sanctuary_meta_events(actor_id,operation_id,event,step)values(p_actor,o.id,p_action,p_step);return '{}';end if;
 if p_step is not null or p_query is not null then raise exception 'Unexpected Meta completion input';end if;
 if p_action='failed' then
 if p_payload is not null then raise exception 'Unexpected failure payload';end if;
 update private.sanctuary_meta_operations set stage='failed' where id=o.id;
 insert into private.sanctuary_meta_events(actor_id,operation_id,event)values(p_actor,o.id,'failed');return '{}';end if;
 if o.stage<>'after' or o.step<>'report_read' or p_payload is null or octet_length(p_payload) not between 2 and 262144 then raise exception 'Meta report incomplete';end if;
 b:=p_payload::jsonb;stamp:=(b->>'fetchedAt')::timestamptz;h:=encode(sha256(convert_to(p_payload,'UTF8')),'hex');
 if b->>'version' is distinct from 'sanctuary-meta-campaigns-v1' or b->>'source' is distinct from 'meta' or b->>'complete' is distinct from 'true'
 or b->'period' is distinct from (o.query::jsonb-'retain') or stamp is null or stamp<o.created_at-interval '5 seconds' or stamp>clock_timestamp()+interval '5 seconds'
 or exists(select 1 from private.sanctuary_meta_events where event='delete' and occurred_at>=o.created_at)
 then raise exception 'Meta report association unavailable';end if;
 if (o.query::jsonb->>'retain')::boolean then
 delete from private.sanctuary_meta_snapshot;
 insert into private.sanctuary_meta_snapshot(operation_id,generation,binding_hash,payload,result_hash,fetched_at,expires_at)
 values(o.id,c.generation,c.binding_hash,p_payload,h,stamp,stamp+interval '168 hours');
 end if;
 update private.sanctuary_meta_operations set stage='completed',result_hash=h where id=o.id;
 insert into private.sanctuary_meta_events(actor_id,operation_id,event,result_hash)values(p_actor,o.id,'complete',h);
 return jsonb_build_object('status','completed','operation',o.id,'retained',(o.query::jsonb->>'retain')::boolean);
end $$;
revoke all on function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text) to service_role;
create function private.sanctuary_meta_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if row(new.enabled,new.binding_hash,new.actor_id,new.account_id,new.source_key,new.connection_id,new.environment,new.expires_at)
 is distinct from row(old.enabled,old.binding_hash,old.actor_id,old.account_id,old.source_key,old.connection_id,old.environment,old.expires_at) then
 new.generation:=old.generation+1;delete from private.sanctuary_meta_snapshot;
 insert into private.sanctuary_meta_events(actor_id,event)values(old.actor_id,'invalidated');
 elsif new.generation is distinct from old.generation then raise exception 'Meta generation is managed';end if;return new;
end $$;
create trigger sanctuary_meta_control_change before update on private.sanctuary_meta_control for each row execute function private.sanctuary_meta_changed();
revoke all on function private.sanctuary_meta_changed(),private.sanctuary_meta_immutable() from public,anon,authenticated,service_role;
create function public.sanctuary_meta_purge() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(726230501);
 with removed as (delete from private.sanctuary_meta_snapshot s where s.expires_at<=clock_timestamp()
 or not exists(select 1 from private.sanctuary_meta_control c where c.singleton and c.enabled and c.expires_at>clock_timestamp()
 and c.binding_hash=s.binding_hash and c.generation=s.generation) returning operation_id)
 insert into private.sanctuary_meta_events(actor_id,operation_id,event)
 select o.actor_id,r.operation_id,'expired' from removed r join private.sanctuary_meta_operations o on o.id=r.operation_id;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.sanctuary_meta_purge() from public,anon,authenticated;
grant execute on function public.sanctuary_meta_purge() to service_role;
select cron.schedule('sanctuary-meta-retention-hourly','37 * * * *','SET statement_timeout = ''30s''; SELECT public.sanctuary_meta_purge();');
commit;
