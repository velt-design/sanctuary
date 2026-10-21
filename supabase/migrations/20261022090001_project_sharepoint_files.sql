-- Dark by default. Explicit Jobs-only bindings; no historic-project auto-backfill.
create table private.project_files_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 provision_enabled boolean not null default false, binding text check(binding ~ '^[a-f0-9]{64}$'),
 drive_id text, enquiries_item_id text
);
insert into private.project_files_control(singleton) values(true);
create table private.project_file_roots (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 drive_id text not null, item_id text not null, label text not null check(length(label) between 1 and 200),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(), unique(drive_id,item_id)
);
create index project_file_roots_project on private.project_file_roots(project_id);
create table private.project_folder_provisions (
 project_id uuid primary key references public.projects(id) on delete cascade, binding text not null,
 folder_name text not null, folder_year text not null,
 status text not null default 'pending' check(status in ('pending','running','ready','needs_attention')),
 attempts integer not null default 0, next_attempt timestamptz not null default clock_timestamp(),
 lease_token uuid, lease_until timestamptz, error_code text, root_item_id text,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create table private.project_file_events (
 -- Historical identity deliberately survives deletion of the live project.
 id bigint generated always as identity primary key, project_id uuid not null,
 event text not null, detail jsonb not null default '{}', created_at timestamptz not null default clock_timestamp()
);
alter table private.project_files_control enable row level security;
alter table private.project_file_roots enable row level security;
alter table private.project_folder_provisions enable row level security;
alter table private.project_file_events enable row level security;
revoke all on private.project_files_control,private.project_file_roots,private.project_folder_provisions,private.project_file_events from public,anon,authenticated,service_role;

-- Retire Portal relationships only. This trigger never calls Microsoft or deletes source files.
create function private.project_files_retire_project() returns trigger language plpgsql security definer set search_path='' as $$
declare roots jsonb; job jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('rootId',id,'driveId',drive_id,'itemId',item_id,'label',label,'evidenceSha256',evidence_sha256)),'[]')
 into roots from private.project_file_roots where project_id=old.id;
 select jsonb_build_object('binding',binding,'folderName',folder_name,'year',folder_year,'status',status,'attempts',attempts,'rootItemId',root_item_id,
  'driveId',(select drive_id from private.project_files_control where singleton),'enquiriesItemId',(select enquiries_item_id from private.project_files_control where singleton))
 into job from private.project_folder_provisions where project_id=old.id;
 if jsonb_array_length(roots)>0 or job is not null or exists(select 1 from private.project_file_events where project_id=old.id) then
  insert into private.project_file_events(project_id,event,detail)
  values(old.id,'project_deleted',jsonb_build_object('projectName',old.name,'roots',roots,'provision',job));
 end if;
 return old;
end $$;
create trigger project_files_retire_project before delete on public.projects for each row execute function private.project_files_retire_project();

create function private.project_files_actor() returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users u join public.portal_users p on p.user_id=u.id
 where u.id=auth.uid() and p.role::text in ('staff','admin') and u.email_confirmed_at is not null
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share of u,p;
 if not found then raise exception using errcode='42501',message='Access denied'; end if;
end $$;

create function public.project_files_read(p_project_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.project_files_control; state text; roots jsonb;
begin
 perform private.project_files_actor();
 if not exists(select 1 from public.projects where id=p_project_id) then raise exception using errcode='P0002',message='Project not found'; end if;
 select * into c from private.project_files_control where singleton for share;
 if not c.enabled then return jsonb_build_object('state','disabled','roots','[]'::jsonb); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'itemId',item_id) order by created_at,id),'[]') into roots
 from private.project_file_roots where project_id=p_project_id and drive_id=c.drive_id;
 if jsonb_array_length(roots)>0 then state:='ready';
 else select case when status='needs_attention' then 'needs_attention' else 'pending' end into state from private.project_folder_provisions where project_id=p_project_id;
 end if;
 return jsonb_build_object('state',coalesce(state,'unlinked'),'roots',roots,'binding',c.binding);
end $$;

-- New projects only, atomically with intake; failed transactions leave no orphan work.
create function private.project_files_enqueue_new() returns trigger language plpgsql security definer set search_path='' as $$
declare c private.project_files_control; label text;
begin
 select * into c from private.project_files_control where singleton for share;
 if not c.enabled or not c.provision_enabled or c.binding is null then return new; end if;
 label:=btrim(regexp_replace(left(coalesce(new.name,'Enquiry'),80),'[^[:alnum:] _-]',' ','g'));
 if length(label)=0 then label:='Enquiry'; end if;
 insert into private.project_folder_provisions(project_id,binding,folder_name,folder_year)
 values(new.id,c.binding,label||' - '||new.id::text,to_char(clock_timestamp() at time zone 'Pacific/Auckland','YYYY')) on conflict do nothing;
 insert into private.project_file_events(project_id,event) values(new.id,'folder_queued');
 return new;
end $$;
create trigger project_files_enqueue_new after insert on public.projects for each row execute function private.project_files_enqueue_new();

-- Separate operator activation/import boundary. Does not grant Microsoft access.
create function public.project_files_admin(p_action text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.project_files_control; r private.project_file_roots; project uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Access denied'; end if;
 select * into c from private.project_files_control where singleton for update;
 if p_action='configure' then
  if coalesce(p_input->>'binding','') !~ '^[a-f0-9]{64}$' or coalesce(p_input->>'driveId','') !~ '^[a-zA-Z0-9_!.-]{1,240}$' or coalesce(p_input->>'enquiriesItemId','') !~ '^[a-zA-Z0-9_!.-]{1,240}$' then raise exception 'Invalid configuration'; end if;
  if exists(select 1 from private.project_file_roots where drive_id<>p_input->>'driveId') or exists(select 1 from private.project_folder_provisions where binding<>p_input->>'binding') then raise exception 'Existing source binding cannot be replaced'; end if;
  update private.project_files_control set binding=p_input->>'binding',drive_id=p_input->>'driveId',enquiries_item_id=p_input->>'enquiriesItemId',enabled=coalesce((p_input->>'enabled')::boolean,false),provision_enabled=coalesce((p_input->>'provisionEnabled')::boolean,false) where singleton;
  return jsonb_build_object('configured',true);
 end if;
 if c.binding is null or c.binding is distinct from p_input->>'binding' then raise exception using errcode='42501',message='Source binding unavailable'; end if;
 project:=(p_input->>'projectId')::uuid;
 if not exists(select 1 from public.projects where id=project) then raise exception 'Project not found'; end if;
 if p_action='import' then
  if length(coalesce(p_input->>'itemId','')) not between 1 and 240 or length(coalesce(p_input->>'label','')) not between 1 and 200 or coalesce(p_input->>'evidenceSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid mapping'; end if;
  select * into r from private.project_file_roots where drive_id=c.drive_id and item_id=p_input->>'itemId';
  if found then
   if r.project_id<>project or r.evidence_sha256<>p_input->>'evidenceSha256' then raise exception 'Mapping conflict'; end if;
   return jsonb_build_object('id',r.id,'replayed',true);
  end if;
  if exists(select 1 from private.project_folder_provisions where project_id=project and status='running') then raise exception 'Provision in progress'; end if;
  insert into private.project_file_roots(project_id,drive_id,item_id,label,evidence_sha256) values(project,c.drive_id,p_input->>'itemId',p_input->>'label',p_input->>'evidenceSha256') returning * into r;
  update private.project_folder_provisions set status='ready',root_item_id=r.item_id,lease_token=null,lease_until=null where project_id=project;
  insert into private.project_file_events(project_id,event,detail) values(project,'root_imported',jsonb_build_object('rootId',r.id,'evidenceSha256',r.evidence_sha256));
  return jsonb_build_object('id',r.id,'replayed',false);
 elsif p_action='retry' then
  update private.project_folder_provisions set status='pending',attempts=0,next_attempt=clock_timestamp(),error_code=null where project_id=project and status='needs_attention';
  insert into private.project_file_events(project_id,event) values(project,'retry_requested');
  return jsonb_build_object('retried',true);
 end if;
 raise exception 'Invalid action';
end $$;

create function public.project_files_provision(p_action text,p_binding text,p_lease uuid,p_project_id uuid default null,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.project_files_control; r private.project_folder_provisions; root uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_lease is null then raise exception using errcode='42501',message='Access denied'; end if;
 select * into c from private.project_files_control where singleton for share;
 if not c.enabled or not c.provision_enabled or c.binding is distinct from p_binding then return jsonb_build_object('claimed',false,'reason','disabled'); end if;
 if p_action='claim' then
  update private.project_folder_provisions set status='needs_attention',error_code='retry_limit',lease_token=null,lease_until=null where attempts>=6 and status in ('pending','running') and (lease_until is null or lease_until<clock_timestamp());
  select * into r from private.project_folder_provisions where binding=p_binding and attempts<6 and next_attempt<=clock_timestamp() and (status='pending' or status='running' and lease_until<clock_timestamp()) order by created_at for update skip locked limit 1;
  if not found then return jsonb_build_object('claimed',false,'reason','empty'); end if;
  if exists(select 1 from private.project_file_roots where project_id=r.project_id) then
   update private.project_folder_provisions set status='ready' where project_id=r.project_id;
   return jsonb_build_object('claimed',false,'reason','already_linked');
  end if;
  update private.project_folder_provisions set status='running',attempts=attempts+1,lease_token=p_lease,lease_until=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp() where project_id=r.project_id;
  return jsonb_build_object('claimed',true,'projectId',r.project_id,'folderName',r.folder_name,'year',r.folder_year,'parentId',c.enquiries_item_id);
 end if;
 -- Lock the parent before the job, matching project deletion's parent/cascade order.
 -- A worker that finishes after deletion cannot recreate a binding or queue row.
 perform 1 from public.projects where id=p_project_id for key share;
 if not found then raise exception using errcode='42501',message='Lease expired'; end if;
 select * into r from private.project_folder_provisions where project_id=p_project_id for update;
 if not found or r.binding<>p_binding or r.status<>'running' or r.lease_token is distinct from p_lease or r.lease_until<clock_timestamp() then raise exception using errcode='42501',message='Lease expired'; end if;
 if p_action='complete' then
  if length(coalesce(p_input->>'itemId','')) not between 1 and 240 or coalesce(p_input->>'evidenceSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid result'; end if;
  insert into private.project_file_roots(project_id,drive_id,item_id,label,evidence_sha256) values(r.project_id,c.drive_id,p_input->>'itemId',r.folder_name,p_input->>'evidenceSha256') returning id into root;
  update private.project_folder_provisions set status='ready',root_item_id=p_input->>'itemId',lease_token=null,lease_until=null,error_code=null,updated_at=clock_timestamp() where project_id=r.project_id;
  insert into private.project_file_events(project_id,event,detail) values(r.project_id,'folder_ready',jsonb_build_object('rootId',root));
  return jsonb_build_object('completed',true);
 elsif p_action='fail' then
  if coalesce(p_input->>'code','') not in ('access_required','not_configured','source_unavailable','source_invalid','not_found','invalid_request','busy') then raise exception 'Invalid error'; end if;
  update private.project_folder_provisions set status=case when attempts>=6 then 'needs_attention' else 'pending' end,next_attempt=clock_timestamp()+interval '1 minute'*least(60,power(2,attempts)::integer),lease_token=null,lease_until=null,error_code=p_input->>'code',updated_at=clock_timestamp() where project_id=r.project_id;
  insert into private.project_file_events(project_id,event,detail) values(r.project_id,'folder_attempt_failed',jsonb_build_object('code',p_input->>'code'));
  return jsonb_build_object('recorded',true);
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function private.project_files_actor(),private.project_files_enqueue_new(),private.project_files_retire_project() from public,anon,authenticated,service_role;
revoke all on function public.project_files_read(uuid),public.project_files_admin(text,jsonb),public.project_files_provision(text,text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.project_files_read(uuid) to authenticated;
grant execute on function public.project_files_admin(text,jsonb),public.project_files_provision(text,text,uuid,uuid,jsonb) to service_role;
