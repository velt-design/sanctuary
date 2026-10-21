-- Website Studio V1: immutable design and image bytes, explicit commercial handoff.
-- Depends on current commercial RPCs and studio_authored_save/create foundations.
create table private.studio_website_quote_snapshots (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  estimate_id uuid not null references public.estimates(id),
  commercial_scope_id uuid,
  actor_user_id uuid not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  authored jsonb not null,
  spatial jsonb not null,
  publication_id uuid not null,
  handoff jsonb not null,
  private_evidence jsonb not null,
  customer_view jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table private.studio_website_quote_bindings (
  quote_version_id uuid primary key references public.quote_versions(id) on delete cascade,
  snapshot_id uuid not null references private.studio_website_quote_snapshots(id),
  bound_at timestamptz not null default clock_timestamp()
);
revoke all on private.studio_website_quote_snapshots, private.studio_website_quote_bindings from public,anon,authenticated,service_role;

create function private.studio_snapshot_immutable() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $$ begin raise exception 'studio_snapshot_immutable' using errcode='55000'; end $$;
create trigger studio_snapshot_immutable before update or delete on private.studio_website_quote_snapshots
for each row execute function private.studio_snapshot_immutable();
revoke all on function private.studio_snapshot_immutable() from public,anon,authenticated,service_role;

create function public.studio_website_quote_prepare(
 p_project_id uuid,p_estimate_id uuid,p_actor_user_id uuid,p_snapshot_id uuid,
 p_expected_updated_at timestamptz,p_authored jsonb,p_spatial jsonb,p_publication_id uuid,
 p_content_hash text,p_handoff jsonb,p_private_evidence jsonb,p_customer_view jsonb
) returns table(snapshot_id uuid,prepared_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare e public.estimates%rowtype; previous text; saved_at timestamptz; replay private.studio_website_quote_snapshots%rowtype; item jsonb; kind text;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then
  raise exception 'studio_staff_required' using errcode='42501'; end if;
 select * into e from public.estimates where id=p_estimate_id and project_id=p_project_id for update;
 if not found or e.status<>'draft' then raise exception 'studio_estimate_unavailable'; end if;
 select * into replay from private.studio_website_quote_snapshots where id=p_snapshot_id;
 if found then
  if replay.estimate_id is distinct from e.id or replay.actor_user_id is distinct from p_actor_user_id or replay.content_hash is distinct from p_content_hash or replay.customer_view is distinct from p_customer_view or replay.handoff is distinct from p_handoff or replay.authored is distinct from p_authored or replay.spatial is distinct from p_spatial or replay.publication_id is distinct from p_publication_id or replay.private_evidence is distinct from p_private_evidence then raise exception 'studio_prepare_intent_conflict'; end if;
  return query select replay.id,replay.created_at; return;
 end if;
 if exists(select 1 from public.quote_versions where source_estimate_version_id=e.id) then raise exception 'studio_estimate_referenced'; end if;
 if e.updated_at is distinct from p_expected_updated_at or e.outputs->'studio_authored' is distinct from p_authored
  or e.outputs->'drawing_object_first' is distinct from p_spatial then raise exception 'studio_stale' using errcode='PT409'; end if;
 perform 1 from public.costing_configuration_publication where singleton and current_version_id=p_publication_id for share;
 if not found then raise exception 'studio_publication_changed' using errcode='PT409'; end if;
 if p_snapshot_id is null or p_publication_id is null or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$'
  or jsonb_typeof(p_authored) is distinct from 'object' or jsonb_typeof(p_spatial) is distinct from 'object'
  or jsonb_typeof(p_private_evidence) is distinct from 'object' or jsonb_typeof(p_customer_view) is distinct from 'object'
  or jsonb_typeof(p_handoff) is distinct from 'object'
  or p_authored->>'schemaVersion' is distinct from 'studio_authored.v1'
  or p_customer_view->>'schemaVersion' is distinct from 'studio_quote_snapshot.v1'
  or p_handoff->>'schemaVersion' is distinct from 'studio_quote_snapshot.v1'
  or p_customer_view->>'snapshotId' is distinct from p_snapshot_id::text
  or p_handoff->>'snapshotId' is distinct from p_snapshot_id::text
  or p_customer_view->>'contentHash' is distinct from p_content_hash
  or p_handoff->>'contentHash' is distinct from p_content_hash
  or jsonb_typeof(p_customer_view->'images') is distinct from 'array'
  or jsonb_typeof(p_customer_view->'selections') is distinct from 'array'
  or jsonb_typeof(p_handoff->'lines') is distinct from 'array'
  or jsonb_typeof(p_handoff->'totalIncGstCents') is distinct from 'number'
  or jsonb_typeof(p_handoff->'source') is distinct from 'object'
  or octet_length(p_customer_view::text)>8388608 then raise exception 'studio_snapshot_invalid'; end if;
 if jsonb_array_length(p_customer_view->'images')<>2 or jsonb_array_length(p_handoff->'lines')<1
  or (p_handoff->>'totalIncGstCents')::bigint<=0 then raise exception 'studio_snapshot_invalid'; end if;
 for item in select value from jsonb_array_elements(p_customer_view->'images') loop
  if jsonb_typeof(item) is distinct from 'object' or item->>'kind' is null or item->>'kind' not in ('plan','perspective')
   or item->>'sha256' is null or item->>'sha256' !~ '^[0-9a-f]{64}$'
   or item->>'dataUrl' is null or item->>'dataUrl' !~ '^data:image/png;base64,[A-Za-z0-9+/]+=*$'
   or length(item->>'dataUrl')<100 or length(item->>'dataUrl')>3800000
   or jsonb_typeof(item->'width') is distinct from 'number' or jsonb_typeof(item->'height') is distinct from 'number'
   then raise exception 'studio_snapshot_images_invalid'; end if;
  if (item->>'width')::numeric not between 640 and 2400 or (item->>'height')::numeric not between 400 and 1800 then raise exception 'studio_snapshot_images_invalid'; end if;
 end loop;
 if (select count(distinct value->>'kind') from jsonb_array_elements(p_customer_view->'images'))<>2 then raise exception 'studio_snapshot_images_invalid'; end if;
 for item in select value from jsonb_array_elements(p_handoff->'lines') loop
  if jsonb_typeof(item) is distinct from 'object' or coalesce(trim(item->>'description'),'')=''
   or item->'qty' is distinct from '1'::jsonb or jsonb_typeof(item->'sortOrder') is distinct from 'number'
   or jsonb_typeof(item->'unitPriceIncGstCents') is distinct from 'number'
   or item->'lineTotalIncGstCents' is distinct from item->'unitPriceIncGstCents'
   then raise exception 'studio_snapshot_lines_invalid'; end if;
  if (item->>'unitPriceIncGstCents')::numeric<0 or (item->>'unitPriceIncGstCents')::numeric<>trunc((item->>'unitPriceIncGstCents')::numeric)
   then raise exception 'studio_snapshot_lines_invalid'; end if;
 end loop;
 if (select sum((value->>'lineTotalIncGstCents')::bigint) from jsonb_array_elements(p_handoff->'lines')) is distinct from (p_handoff->>'totalIncGstCents')::bigint
  or exists(select 1 from jsonb_array_elements(p_handoff->'lines') with ordinality line(value,n) where (value->>'sortOrder')::numeric<>n-1)
  then raise exception 'studio_snapshot_lines_invalid'; end if;
 insert into private.studio_website_quote_snapshots(id,project_id,estimate_id,commercial_scope_id,actor_user_id,content_hash,
  authored,spatial,publication_id,handoff,private_evidence,customer_view)
 values(p_snapshot_id,e.project_id,e.id,e.commercial_scope_id,p_actor_user_id,p_content_hash,p_authored,p_spatial,p_publication_id,p_handoff,p_private_evidence,p_customer_view);
 previous:=current_setting('sanctuary.studio_command',true);
 perform set_config('sanctuary.studio_command','save',true);
 update public.estimates set outputs=outputs||jsonb_build_object('studio_quote_handoff',p_handoff),
  pricing_source='workbench_solved',pricing_source_metadata=jsonb_build_object('studioSnapshotId',p_snapshot_id,'studioSnapshotHash',p_content_hash),
  updated_at=clock_timestamp() where id=e.id returning updated_at into saved_at;
 perform set_config('sanctuary.studio_command',coalesce(previous,''),true);
 return query select id,created_at from private.studio_website_quote_snapshots where id=p_snapshot_id;
end $$;
revoke all on function public.studio_website_quote_prepare(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.studio_website_quote_prepare(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb,uuid,text,jsonb,jsonb,jsonb) to service_role;

-- Current commercial owners continue to take the quote lock first, then the estimate.
-- This trigger is an invariant backstop. Binding is performed by the wrapper only.
create or replace function private.studio_quote_source_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare e public.estimates%rowtype; s private.studio_website_quote_snapshots%rowtype;
begin
 if tg_op='UPDATE' and new.source_estimate_version_id is not distinct from old.source_estimate_version_id then return new; end if;
 if new.source_estimate_version_id is null then return new; end if;
 select * into e from public.estimates where id=new.source_estimate_version_id for update;
 if e.outputs ? 'studio_authored' then
  select * into s from private.studio_website_quote_snapshots where id=nullif(current_setting('sanctuary.studio_quote_snapshot',true),'')::uuid;
  if not found or s.estimate_id<>e.id or s.project_id<>(select project_id from public.quotes where id=new.quote_id)
   or s.commercial_scope_id is distinct from (select commercial_scope_id from public.quotes where id=new.quote_id) then
   raise exception 'studio_costing_required' using errcode='23514'; end if;
 end if;
 return new;
end $$;

create function public.studio_website_quote_commit(p_operation text,p_snapshot_id uuid,p_content_hash text,p_command jsonb)
returns public.quote_versions language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s private.studio_website_quote_snapshots%rowtype; q public.quote_versions%rowtype;
 existing public.quote_versions%rowtype; source public.quote_versions%rowtype; e public.estimates%rowtype;
 previous text; v_quote_id uuid; command_lines jsonb; actual_lines jsonb; prior_snapshot uuid;
begin
 if p_operation is null or p_operation not in ('create','refresh','revise') or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'studio_quote_command_invalid'; end if;
 select * into s from private.studio_website_quote_snapshots where id=p_snapshot_id and content_hash=p_content_hash;
 if not found then raise exception 'studio_snapshot_unavailable'; end if;
 if p_operation='refresh' then
  select * into strict existing from public.quote_versions where id=(p_command->>'p_quote_version_id')::uuid for update;
  v_quote_id:=existing.quote_id;
 else
  v_quote_id:=(p_command->>'p_quote_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('commercial-quote:'||v_quote_id::text,0));
  if exists(select 1 from public.quote_versions qv where qv.quote_id=v_quote_id and qv.status='DRAFT' and qv.is_current_draft and (qv.pricing_source_metadata ? 'studioQuoteDraft')) then raise exception 'Historical Studio quote drafts are review-only. Create the new Studio quote in a separate scope.'; end if;
  select * into existing from public.quote_versions where quote_id=v_quote_id and client_intent_id=trim(p_command->>'p_client_intent_id') for update;
  if found then
   select snapshot_id into prior_snapshot from private.studio_website_quote_bindings where quote_version_id=existing.id;
   if prior_snapshot is distinct from p_snapshot_id or existing.source_estimate_version_id is distinct from s.estimate_id then raise exception 'studio_quote_intent_conflict' using errcode='23505'; end if;
   return existing;
  end if;
 end if;
 if s.project_id is distinct from (select project_id from public.quotes where id=v_quote_id)
  or s.commercial_scope_id is distinct from (select commercial_scope_id from public.quotes where id=v_quote_id)
  or (p_command->>'p_source_estimate_version_id')::uuid is distinct from s.estimate_id then raise exception 'studio_snapshot_scope_mismatch'; end if;
 if p_operation='revise' then
  select * into strict source from public.quote_versions where id=(p_command->>'p_revised_from_quote_version_id')::uuid;
  if source.quote_id<>v_quote_id or source.status='DRAFT' or not exists(select 1 from private.studio_website_quote_bindings where quote_version_id=source.id and snapshot_id=s.id) then raise exception 'studio_revision_binding_missing'; end if;
 end if;
 command_lines:=p_command->'p_line_items';
 if p_operation='create' and command_lines is distinct from (select jsonb_agg(jsonb_build_object(
  'description',item->'description','qty',item->'qty','unit_price_inc_gst_cents',item->'unitPriceIncGstCents',
  'line_total_inc_gst_cents',item->'lineTotalIncGstCents','sort_order',item->'sortOrder') order by (item->>'sortOrder')::integer)
  from jsonb_array_elements(s.handoff->'lines') item) then raise exception 'studio_quote_lines_changed'; end if;
 previous:=current_setting('sanctuary.studio_quote_snapshot',true);
 perform set_config('sanctuary.studio_quote_snapshot',s.id::text,true);
 if p_operation='refresh' then
  q:=public.commercial_quote_update_draft((p_command->>'p_quote_version_id')::uuid,(p_command->>'p_expected_commercial_revision')::bigint,
   p_command->>'p_reference',p_command->>'p_intro_text',p_command->>'p_terms_text',(p_command->>'p_deposit_percent')::numeric,p_command->'p_payment_terms',
   (p_command->>'p_expires_at')::date,s.estimate_id,(p_command->>'p_total_inc_gst_cents')::integer,(p_command->>'p_total_ex_gst_cents')::integer,
   (p_command->>'p_gst_cents')::integer,p_command->>'p_pricing_source',p_command->'p_pricing_source_metadata',command_lines);
 else
  q:=public.commercial_quote_create_draft(v_quote_id,s.estimate_id,(p_command->>'p_revised_from_quote_version_id')::uuid,
   p_command->>'p_client_intent_id',p_command->>'p_actor',p_command->>'p_customer_name',p_command->>'p_reference',p_command->>'p_intro_text',
   p_command->>'p_terms_text',(p_command->>'p_deposit_percent')::numeric,p_command->'p_payment_terms',(p_command->>'p_expires_at')::date,
   (p_command->>'p_total_inc_gst_cents')::integer,(p_command->>'p_total_ex_gst_cents')::integer,(p_command->>'p_gst_cents')::integer,
   p_command->>'p_pricing_source',p_command->'p_pricing_source_metadata',command_lines);
 end if;
 -- The delegated owner has locked prior draft rows before its INSERT source guard locks the estimate.
 -- Validate within this same transaction, rolling back all quote changes on a stale source.
 if p_operation<>'revise' then
  select * into strict e from public.estimates where id=s.estimate_id for update;
  if e.outputs->'studio_authored' is distinct from s.authored or e.outputs->'drawing_object_first' is distinct from s.spatial
   or e.outputs->'studio_quote_handoff' is distinct from s.handoff then raise exception 'studio_snapshot_stale' using errcode='PT409'; end if;
  perform 1 from public.costing_configuration_publication where singleton and current_version_id=s.publication_id for share;
  if not found then raise exception 'studio_publication_changed' using errcode='PT409'; end if;
 end if;
 select jsonb_agg(jsonb_build_object('description',description,'qty',qty,'unit_price_inc_gst_cents',unit_price_inc_gst_cents,
  'line_total_inc_gst_cents',line_total_inc_gst_cents,'sort_order',sort_order) order by sort_order) into actual_lines
 from public.quote_line_items where quote_version_id=q.id;
 if actual_lines is distinct from command_lines or q.total_inc_gst_cents<>(select sum(line_total_inc_gst_cents) from public.quote_line_items where quote_version_id=q.id)
  then raise exception 'studio_quote_reconciliation_failed'; end if;
 insert into private.studio_website_quote_bindings(quote_version_id,snapshot_id) values(q.id,s.id)
 on conflict(quote_version_id) do update set snapshot_id=excluded.snapshot_id,bound_at=clock_timestamp();
 perform set_config('sanctuary.studio_quote_snapshot',coalesce(previous,''),true);
 return q;
end $$;
revoke all on function public.studio_website_quote_commit(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.studio_website_quote_commit(text,uuid,text,jsonb) to service_role;

create function public.studio_website_quote_view(p_quote_version_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select s.customer_view from private.studio_website_quote_bindings b
 join private.studio_website_quote_snapshots s on s.id=b.snapshot_id where b.quote_version_id=p_quote_version_id
$$;
revoke all on function public.studio_website_quote_view(uuid) from public,anon,authenticated;
grant execute on function public.studio_website_quote_view(uuid) to service_role;
-- Deferred check runs after line insertion and binding in the same transaction.
create function private.studio_quote_binding_required() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare current_quote public.quote_versions%rowtype; binding private.studio_website_quote_snapshots%rowtype; marked boolean;
begin
 select * into current_quote from public.quote_versions where id=new.id;
 if not found then return null; end if;
 select s.* into binding from private.studio_website_quote_bindings b join private.studio_website_quote_snapshots s on s.id=b.snapshot_id where b.quote_version_id=current_quote.id;
 select coalesce(outputs ? 'studio_authored',false) into marked from public.estimates where id=current_quote.source_estimate_version_id;
 if marked and binding.id is null then raise exception 'studio_quote_binding_required'; end if;
 if binding.id is not null and (binding.estimate_id is distinct from current_quote.source_estimate_version_id
  or binding.project_id is distinct from (select project_id from public.quotes where id=current_quote.quote_id)) then raise exception 'studio_quote_binding_mismatch'; end if;
 return null;
end $$;
revoke all on function private.studio_quote_binding_required() from public,anon,authenticated,service_role;
create constraint trigger studio_quote_binding_required after insert or update of source_estimate_version_id on public.quote_versions
 deferrable initially deferred for each row execute function private.studio_quote_binding_required();
notify pgrst,'reload schema';
