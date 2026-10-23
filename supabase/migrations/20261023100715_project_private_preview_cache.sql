-- Private, replaceable Portal previews. SharePoint remains the original authority.
-- No authenticated/public Storage capability is granted by this migration.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-file-previews','project-file-previews',false,5242880,array['image/jpeg','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table private.project_file_previews (
 cache_key text primary key check(cache_key ~ '^[a-f0-9]{64}$'),
 project_id uuid not null references public.projects(id) on delete cascade,
 root_id uuid not null references private.project_file_roots(id) on delete cascade,
 binding text not null check(binding ~ '^[a-f0-9]{64}$'), folder_id text not null, item_id text not null,
 source_version text not null check(length(source_version) between 3 and 1024),
 profile text not null check(profile in ('photo-v1','pdf-v1')),
 mime text not null check(mime in ('image/jpeg','application/pdf')),
 byte_size integer not null check(byte_size>0 and byte_size<=5242880),
 body_hash text not null check(body_hash ~ '^[a-f0-9]{64}$'), storage_path text not null unique,
 seen_generation uuid, created_at timestamptz not null default clock_timestamp(),
 last_used_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default(clock_timestamp()+interval '24 hours'),
 unique(root_id,item_id,profile),
 check((profile='photo-v1' and mime='image/jpeg' and byte_size<=524288) or (profile='pdf-v1' and mime='application/pdf'))
);
create index project_file_previews_folder on private.project_file_previews(root_id,folder_id);
create table private.project_file_preview_folders (
 root_id uuid not null references private.project_file_roots(id) on delete cascade,
 folder_id text not null check(folder_id ~ '^[a-zA-Z0-9_!.-]{1,240}$'),
 active_until timestamptz not null default(clock_timestamp()+interval '15 minutes'),
 next_sync timestamptz not null default clock_timestamp(), cursor text,
 generation uuid not null default gen_random_uuid(), scan_started_at timestamptz not null default clock_timestamp(),
 lease uuid, lease_until timestamptz, failures integer not null default 0, preparation_offset integer not null default 0 check(preparation_offset>=0),
 primary key(root_id,folder_id), check(cursor is null or length(cursor)<=8000)
);
create table private.project_file_preview_gc(storage_path text primary key,reserved_bytes integer not null default 5242880,created_at timestamptz not null default clock_timestamp(),ready_at timestamptz not null default(clock_timestamp()+interval '2 minutes'));
create table private.project_file_preview_builds(
 cache_key text primary key,root_id uuid not null references private.project_file_roots(id) on delete cascade,
 lease uuid not null,lease_until timestamptz not null
);
alter table private.project_file_previews enable row level security;
alter table private.project_file_preview_folders enable row level security;
alter table private.project_file_preview_gc enable row level security;
alter table private.project_file_preview_builds enable row level security;
revoke all on private.project_file_previews,private.project_file_preview_folders,private.project_file_preview_gc from public,anon,authenticated,service_role;
revoke all on private.project_file_preview_builds from public,anon,authenticated,service_role;
create function private.project_file_preview_retire() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.project_file_preview_gc(storage_path,reserved_bytes,ready_at) values(old.storage_path,old.byte_size,clock_timestamp()) on conflict do nothing; return old; end $$;
create trigger project_file_preview_retire before delete on private.project_file_previews for each row execute function private.project_file_preview_retire();

-- All calls are server-owned. Staff authorization and current Graph proof MUST
-- precede use by a byte-delivery route; the RPC cannot authorize SharePoint.
create function public.project_file_preview_cache(p_action text,p_binding text,p_project_id uuid default null,p_root_id uuid default null,p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.project_files_control; r private.project_file_roots; f private.project_file_preview_folders;
 cached private.project_file_previews; path text; paths jsonb; missing jsonb; candidates jsonb; amount bigint; objects bigint; lease_id uuid; folder text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Access denied'; end if;
 if p_action='cleanup' then
  delete from private.project_file_previews where cache_key in(select cache_key from private.project_file_previews where expires_at<=clock_timestamp() order by expires_at limit 32);
  delete from private.project_file_preview_folders where active_until<clock_timestamp()-interval '24 hours' and coalesce(lease_until,'-infinity')<clock_timestamp();
  delete from private.project_file_preview_builds where lease_until<clock_timestamp();
  select coalesce(jsonb_agg(storage_path),'[]') into paths from(select storage_path from private.project_file_preview_gc where ready_at<=clock_timestamp() order by created_at limit 64) q;
  return jsonb_build_object('paths',paths);
 elsif p_action='cleaned' then
  if jsonb_typeof(p_input->'paths')<>'array' or jsonb_array_length(p_input->'paths')>64 then raise exception 'Invalid input'; end if;
  delete from private.project_file_preview_gc where storage_path in(select jsonb_array_elements_text(p_input->'paths'));
  return jsonb_build_object('completed',true);
 end if;
 select * into c from private.project_files_control where singleton for share;
 if not c.enabled or c.binding is distinct from p_binding then raise exception using errcode='42501',message='Source unavailable'; end if;
 if p_action='claim' then
  select q.* into f from private.project_file_preview_folders q join private.project_file_roots x on x.id=q.root_id
  where x.drive_id=c.drive_id and q.active_until>=clock_timestamp() and q.next_sync<=clock_timestamp()
    and coalesce(q.lease_until,'-infinity')<clock_timestamp()
  order by q.next_sync for update of q skip locked limit 1;
  if not found then return jsonb_build_object('claimed',false); end if;
  lease_id:=gen_random_uuid();
  update private.project_file_preview_folders set lease=lease_id,lease_until=clock_timestamp()+interval '55 seconds',
    generation=case when cursor is null then gen_random_uuid() else generation end,
    scan_started_at=case when cursor is null then clock_timestamp() else scan_started_at end
    where root_id=f.root_id and folder_id=f.folder_id returning * into f;
  select * into r from private.project_file_roots where id=f.root_id;
  return jsonb_build_object('claimed',true,'projectId',r.project_id,'rootId',r.id,'itemId',r.item_id,'folderId',f.folder_id,'cursor',f.cursor,'lease',f.lease,'generation',f.generation);
 end if;
 -- Parent lock follows the existing project deletion/provisioning order.
 perform 1 from public.projects where id=p_project_id for share;
 if not found then raise exception using errcode='P0002',message='Project not found'; end if;
 select * into r from private.project_file_roots where id=p_root_id and project_id=p_project_id and drive_id=c.drive_id for share;
 if not found or r.item_id is distinct from p_input->>'rootItemId' then raise exception using errcode='42501',message='Root unavailable'; end if;
 folder:=p_input->>'folderId';
 if p_action='read' then
  select * into cached from private.project_file_previews where root_id=r.id and binding=p_binding and item_id=p_input->>'itemId'
    and source_version=p_input->>'version' and profile=p_input->>'profile' and expires_at>clock_timestamp();
  if not found then return jsonb_build_object('found',false); end if;
  update private.project_file_previews set last_used_at=clock_timestamp() where cache_key=cached.cache_key;
  return jsonb_build_object('found',true,'key',cached.cache_key,'path',cached.storage_path,'hash',cached.body_hash,'size',cached.byte_size,'mime',cached.mime,'profile',cached.profile);
 elsif p_action='touch' then
  if folder is null or folder !~ '^[a-zA-Z0-9_!.-]{1,240}$' then raise exception 'Invalid folder'; end if;
  insert into private.project_file_preview_folders(root_id,folder_id) values(r.id,folder)
  on conflict(root_id,folder_id) do update set active_until=clock_timestamp()+interval '15 minutes';
  return jsonb_build_object('completed',true);
 elsif p_action='build' then
  if p_input->>'key' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid key'; end if;
  perform pg_advisory_xact_lock(23810,1);
  select (select coalesce(sum(byte_size),0) from private.project_file_previews)+(select coalesce(sum(reserved_bytes),0) from private.project_file_preview_gc) into amount;
  select (select count(*) from private.project_file_previews)+(select count(*) from private.project_file_preview_gc) into objects;
  if amount+5242880>536870912 or objects>=4096 then
   delete from private.project_file_previews where cache_key in(select cache_key from private.project_file_previews order by last_used_at limit 16);
   return jsonb_build_object('claimed',false,'capacity',true);
  end if;
  lease_id:=gen_random_uuid();
  insert into private.project_file_preview_builds(cache_key,root_id,lease,lease_until)
  values(p_input->>'key',r.id,lease_id,clock_timestamp()+interval '50 seconds')
  on conflict(cache_key) do update set lease=excluded.lease,lease_until=excluded.lease_until
  where private.project_file_preview_builds.lease_until<clock_timestamp();
  if not found then return jsonb_build_object('claimed',false); end if;
  insert into private.project_file_preview_gc(storage_path) values(p_binding||'/'||p_project_id::text||'/'||r.id::text||'/'||(p_input->>'key')||'-'||lease_id::text) on conflict do nothing;
  return jsonb_build_object('claimed',true,'lease',lease_id);
 elsif p_action='abort' then
  delete from private.project_file_preview_builds where cache_key=p_input->>'key' and root_id=r.id and lease=(p_input->>'lease')::uuid;
  return jsonb_build_object('completed',true);
 elsif p_action='publish' then
  if p_input->>'key' !~ '^[a-f0-9]{64}$' or p_input->>'itemId' !~ '^[a-zA-Z0-9_!.-]{1,240}$' or folder !~ '^[a-zA-Z0-9_!.-]{1,240}$' then raise exception 'Invalid preview'; end if;
  perform pg_advisory_xact_lock(23810,1);
  perform 1 from private.project_file_preview_builds where cache_key=p_input->>'key' and root_id=r.id and lease=(p_input->>'lease')::uuid and lease_until>clock_timestamp() for update;
  if not found then raise exception 'Lease expired'; end if;
  path:=p_binding||'/'||p_project_id::text||'/'||r.id::text||'/'||(p_input->>'key')||'-'||(p_input->>'lease');
  delete from private.project_file_previews where root_id=r.id and item_id=p_input->>'itemId' and profile=p_input->>'profile';
  select coalesce(sum(byte_size),0) into amount from private.project_file_previews where cache_key<>p_input->>'key';
  if amount+(p_input->>'size')::integer>536870912 then raise exception 'Preview capacity reached'; end if;
  insert into private.project_file_previews(cache_key,project_id,root_id,binding,folder_id,item_id,source_version,profile,mime,byte_size,body_hash,storage_path)
  values(p_input->>'key',p_project_id,r.id,p_binding,folder,p_input->>'itemId',p_input->>'version',p_input->>'profile',p_input->>'mime',(p_input->>'size')::integer,p_input->>'hash',path)
  on conflict(cache_key) do update set last_used_at=clock_timestamp();
  delete from private.project_file_preview_gc where storage_path=path;
  delete from private.project_file_preview_builds where cache_key=p_input->>'key';
  return jsonb_build_object('completed',true);
 elsif p_action='invalidate' then
  delete from private.project_file_previews where root_id=r.id and (folder is null or folder_id=folder);
  return jsonb_build_object('completed',true);
 elsif p_action in ('reconcile','fail') then
  select * into f from private.project_file_preview_folders where root_id=r.id and folder_id=folder for update;
  if not found or f.lease is distinct from (p_input->>'lease')::uuid or f.lease_until<clock_timestamp() then raise exception 'Lease expired'; end if;
  if p_action='fail' then
   if coalesce((p_input->>'invalidate')::boolean,false) then delete from private.project_file_previews where root_id=r.id and folder_id=folder; end if;
   update private.project_file_preview_folders set lease=null,lease_until=null,failures=least(failures+1,10),next_sync=clock_timestamp()+interval '5 minutes' where root_id=r.id and folder_id=folder;
  else
   if jsonb_typeof(p_input->'items')<>'array' or jsonb_array_length(p_input->'items')>200 then raise exception 'Invalid page'; end if;
   delete from private.project_file_previews v where v.root_id=r.id and v.folder_id=folder and exists(select 1 from jsonb_array_elements(p_input->'items') j where j->>'id'=v.item_id and coalesce(j->>'version','')<>v.source_version);
   update private.project_file_previews v set seen_generation=f.generation where v.root_id=r.id and v.folder_id=folder and exists(select 1 from jsonb_array_elements(p_input->'items') j where j->>'id'=v.item_id and j->>'version'=v.source_version);
   if p_input->>'cursor' is null then
    delete from private.project_file_previews v where v.root_id=r.id and v.folder_id=folder and v.seen_generation is distinct from f.generation and v.created_at<f.scan_started_at;
   end if;
   update private.project_file_preview_folders set lease=null,lease_until=null,failures=0,cursor=p_input->>'cursor',
    next_sync=case when p_input->>'cursor' is null then clock_timestamp()+interval '5 minutes' else clock_timestamp() end
    where root_id=r.id and folder_id=folder;
   select coalesce(jsonb_agg(j->>'id'),'[]') into candidates from (
    select j from jsonb_array_elements(p_input->'items') j where coalesce(j->>'version','')<>''
     and not exists(select 1 from private.project_file_previews v where v.root_id=r.id and v.item_id=j->>'id' and v.source_version=j->>'version' and v.expires_at>clock_timestamp())
   ) q;
   select coalesce(jsonb_agg(value),'[]') into missing from(select value from jsonb_array_elements(candidates) offset(f.preparation_offset%greatest(jsonb_array_length(candidates),1)) limit 2) q;
   update private.project_file_preview_folders set preparation_offset=(f.preparation_offset+2)%greatest(jsonb_array_length(candidates),1) where root_id=r.id and folder_id=folder;
   return jsonb_build_object('completed',true,'prepare',missing);
  end if;
  return jsonb_build_object('completed',true);
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function private.project_file_preview_retire() from public,anon,authenticated,service_role;
revoke all on function public.project_file_preview_cache(text,text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.project_file_preview_cache(text,text,uuid,uuid,jsonb) to service_role;
