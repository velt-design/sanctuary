-- Private human review records. This migration has no enqueue/provider/send capability.
create table private.email_review_batches (
 id uuid primary key default gen_random_uuid(), source_key text not null unique,
 title text not null, reviewer_id uuid not null references auth.users(id), import_hash text not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create table private.email_review_items (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references private.email_review_batches(id),
 source_id text not null, project_id uuid not null references public.projects(id),
 to_email text not null, subject text not null, body text not null,
 prerequisites jsonb not null, evidence jsonb not null, context text not null, threads jsonb not null default '[]',
 thread_message_id text, saved_project_context jsonb not null,
 status text not null default 'draft' check(status in ('draft','approved','skipped')),
 revision bigint not null default 1 check(revision>0), approved_at timestamptz, approved_by uuid references auth.users(id),
 approval_hash text, dispatch_id uuid, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(), unique(batch_id,source_id),
 check ((status='approved')=(approved_at is not null and approved_by is not null and approval_hash is not null))
);
create index email_review_items_batch_order on private.email_review_items(batch_id,created_at,id);
create table private.email_review_events (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references private.email_review_items(id),
 actor_id uuid not null references auth.users(id), action text not null, revision bigint not null,
 note text, content_hash text not null, created_at timestamptz not null default clock_timestamp()
);
create table private.email_review_receipts (
 command_id uuid primary key, actor_id uuid not null references auth.users(id), request_hash text not null,
 response jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table private.email_review_batches enable row level security;
alter table private.email_review_items enable row level security;
alter table private.email_review_events enable row level security;
alter table private.email_review_receipts enable row level security;
revoke all on private.email_review_batches,private.email_review_items,private.email_review_events,private.email_review_receipts from public,anon,authenticated,service_role;

create function private.email_review_hash(v jsonb) returns text language sql immutable set search_path=pg_catalog as $$
 select encode(sha256(convert_to(v::text,'UTF8')),'hex')
$$;
create function private.email_review_actor() returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r text;
begin
 perform 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception using errcode='42501',message='Access denied'; end if;
 select role::text into r from public.portal_users where user_id=auth.uid() for share;
 if r is null or r not in ('admin','staff') then raise exception using errcode='42501',message='Access denied'; end if;
 return r='admin';
end $$;
create function private.email_review_project_context(p_id uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('projectId',p.id,'name',p.name,'stage',p.pipeline_stage,'archivedAt',p.archived_at,
 'contactId',p.contact_id,'contactName',c.name,'contactEmail',c.email,'state',s.state,'stateVersion',s.row_version)
 from public.projects p left join public.contacts c on c.id=p.contact_id
 left join public.project_operational_states s on s.project_id=p.id where p.id=p_id
$$;
create function private.email_review_approval_content(i private.email_review_items) returns jsonb language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('itemId',i.id,'projectId',i.project_id,'revision',i.revision,'to',i.to_email,'subject',i.subject,'body',i.body,
 'prerequisites',i.prerequisites,'evidence',i.evidence,'context',i.context,'projectContext',i.saved_project_context,
 'thread',(select t from jsonb_array_elements(i.threads) t where t->>'messageId'=i.thread_message_id),'cc','[]'::jsonb,'bcc','[]'::jsonb)
$$;
create function private.email_review_item_json(i private.email_review_items,p_detail boolean) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c jsonb:=private.email_review_project_context(i.project_id); result jsonb;
begin
 result:=jsonb_build_object('id',i.id,'batchId',i.batch_id,'sourceId',i.source_id,'projectId',i.project_id,
 'projectName',c->>'name','to',i.to_email,'subject',i.subject,'status',i.status,'revision',i.revision,
 'updatedAt',i.updated_at,'contextChanged',c is distinct from i.saved_project_context);
 if p_detail then result:=result||jsonb_build_object('body',i.body,'prerequisites',i.prerequisites,'evidence',i.evidence,'context',i.context,
 'savedProjectContext',i.saved_project_context,'currentProjectContext',c,'currentContextHash',private.email_review_hash(c),
 'threads',i.threads,'threadMessageId',i.thread_message_id,'dispatchId',i.dispatch_id,
 'approvedAt',i.approved_at,'approvedBy',i.approved_by,'approvalHash',i.approval_hash,
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'actorId',e.actor_id,
 'revision',e.revision,'note',e.note,'createdAt',e.created_at) order by e.created_at,e.id),'[]') from private.email_review_events e where e.item_id=i.id)); end if;
 return result;
end $$;
create function private.email_review_counts(p_batch uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('all',count(*),'draft',count(*) filter(where status='draft'),
 'approved',count(*) filter(where status='approved'),'skipped',count(*) filter(where status='skipped')) from private.email_review_items where batch_id=p_batch
$$;
create function private.email_review_batch_json(b private.email_review_batches) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('id',b.id,'sourceKey',b.source_key,'title',b.title,'reviewerId',b.reviewer_id,'createdAt',b.created_at,'counts',private.email_review_counts(b.id))
$$;

-- SQL validates inputs as well: authenticated users may call RPC without the route parser.
create function private.email_review_validate_message(p_to text,p_subject text,p_body text) returns void language plpgsql set search_path=pg_catalog as $$
begin
 if p_to is null or length(p_to)>254 or p_to !~ '^[^[:space:]@<>,;]+@[^[:space:]@<>,;]+\.[^[:space:]@<>,;]+$'
 or p_subject is null or length(btrim(p_subject))=0 or length(p_subject)>300 or p_subject ~ E'[\r\n]'
 or p_body is null or length(btrim(p_body))=0 or length(p_body)>20000 then raise exception using errcode='22023',message='Invalid message'; end if;
end $$;
create function public.email_review_import(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare admin boolean:=private.email_review_actor(); actor uuid:=auth.uid(); cmd uuid; h text; b private.email_review_batches;
 r private.email_review_receipts; x jsonb; t jsonb; c jsonb; it private.email_review_items; response jsonb;
begin
 if not admin then raise exception using errcode='42501',message='Admin required'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>2097152
 or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('commandId','sourceKey','title','reviewerId','items'))
 or jsonb_typeof(p_input->'items') is distinct from 'array' then raise exception using errcode='22023',message='Invalid import'; end if;
 if jsonb_array_length(p_input->'items') not between 1 and 500 or length(btrim(coalesce(p_input->>'sourceKey',''))) not between 1 and 200
 or length(btrim(coalesce(p_input->>'title',''))) not between 1 and 300 then raise exception using errcode='22023',message='Invalid import'; end if;
 cmd:=(p_input->>'commandId')::uuid;
 if cmd is null then raise exception using errcode='22023',message='Command required'; end if;
 perform 1 from public.portal_users u join auth.users a on a.id=u.user_id where u.user_id=(p_input->>'reviewerId')::uuid and u.role::text in ('staff','admin') and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=clock_timestamp()) for share;
 if not found then raise exception using errcode='22023',message='Reviewer unavailable'; end if;
 h:=private.email_review_hash(p_input-'commandId');
 perform pg_advisory_xact_lock(hashtextextended('email-review-command:'||cmd,0));
 select * into r from private.email_review_receipts where command_id=cmd;
 if found then
  if r.actor_id<>actor or r.request_hash<>h then raise exception using errcode='PT409',message='Command conflict'; end if;
  return r.response;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('email-review-source:'||(p_input->>'sourceKey'),0));
 select * into b from private.email_review_batches where source_key=p_input->>'sourceKey';
 if found then
  if b.import_hash<>h then raise exception using errcode='PT409',message='Source already imported'; end if;
  response:=jsonb_build_object('batchId',b.id,'imported',(select count(*) from private.email_review_items where batch_id=b.id),'existing',true);
 else
  insert into private.email_review_batches(source_key,title,reviewer_id,import_hash,created_by)
  values(p_input->>'sourceKey',p_input->>'title',(p_input->>'reviewerId')::uuid,h,actor) returning * into b;
  for x in select value from jsonb_array_elements(p_input->'items') loop
   if jsonb_typeof(x)<>'object' or exists(select 1 from jsonb_object_keys(x) k where k not in ('sourceId','projectId','to','subject','body','prerequisites','evidence','context','threads'))
   or length(btrim(coalesce(x->>'sourceId',''))) not between 1 and 200 or jsonb_typeof(x->'prerequisites') is distinct from 'array'
   or jsonb_typeof(x->'evidence') is distinct from 'array' or jsonb_typeof(x->'context') is distinct from 'string'
   or length(x->>'context')>10000 or jsonb_typeof(coalesce(x->'threads','[]')) is distinct from 'array'
   or exists(select 1 from unnest(array['sourceId','projectId','to','subject','body']) field where jsonb_typeof(x->field) is distinct from 'string')
   then raise exception using errcode='22023',message='Invalid item'; end if;
   perform private.email_review_validate_message(x->>'to',x->>'subject',x->>'body');
   if jsonb_array_length(x->'prerequisites')>30 or jsonb_array_length(x->'evidence')>30 or jsonb_array_length(coalesce(x->'threads','[]'))>20 then raise exception using errcode='22023',message='Too many references'; end if;
   for t in select value from jsonb_array_elements(x->'prerequisites') loop
    if jsonb_typeof(t)<>'string' or length(btrim(t#>>'{}')) not between 1 and 2000 then raise exception using errcode='22023',message='Invalid prerequisite'; end if;
   end loop;
   for t in select value from jsonb_array_elements(x->'evidence') loop
    if jsonb_typeof(t)<>'object' or exists(select 1 from jsonb_object_keys(t) k where k not in ('label','url'))
    or jsonb_typeof(t->'label') is distinct from 'string' or jsonb_typeof(t->'url') is distinct from 'string' or length(btrim(coalesce(t->>'label',''))) not between 1 and 300
    or length(coalesce(t->>'url',''))>4000 or (t->>'url') !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception using errcode='22023',message='Invalid evidence'; end if;
   end loop;
   for t in select value from jsonb_array_elements(coalesce(x->'threads','[]')) loop
    if jsonb_typeof(t)<>'object' or exists(select 1 from jsonb_object_keys(t) k where k not in ('messageId','webLink','subject','matchedRecipient'))
    or exists(select 1 from unnest(array['messageId','webLink','subject','matchedRecipient']) field where jsonb_typeof(t->field) is distinct from 'string')
    or length(btrim(coalesce(t->>'messageId',''))) not between 1 and 2000
    or length(coalesce(t->>'webLink',''))>4000 or coalesce(t->>'webLink','') !~ '^https://outlook\.(office|office365)\.com/' then raise exception using errcode='22023',message='Invalid thread'; end if;
    perform private.email_review_validate_message(t->>'matchedRecipient',t->>'subject','thread');
   end loop;
   if (select count(*)<>count(distinct element->>'messageId') from jsonb_array_elements(coalesce(x->'threads','[]')) as candidate(element)) then raise exception using errcode='22023',message='Duplicate thread'; end if;
   c:=private.email_review_project_context((x->>'projectId')::uuid);
   if c is null then raise exception using errcode='22023',message='Project unavailable'; end if;
   insert into private.email_review_items(batch_id,source_id,project_id,to_email,subject,body,prerequisites,evidence,context,threads,saved_project_context)
   values(b.id,x->>'sourceId',(x->>'projectId')::uuid,x->>'to',x->>'subject',x->>'body',x->'prerequisites',x->'evidence',x->>'context',coalesce(x->'threads','[]'),c) returning * into it;
   insert into private.email_review_events(item_id,actor_id,action,revision,content_hash) values(it.id,actor,'import',1,private.email_review_hash(private.email_review_approval_content(it)));
  end loop;
  response:=jsonb_build_object('batchId',b.id,'imported',jsonb_array_length(p_input->'items'),'existing',false);
 end if;
 insert into private.email_review_receipts values(cmd,actor,h,response,clock_timestamp());
 return response;
end $$;

create function public.email_review_read(p_batch_id uuid default null,p_item_id uuid default null,p_page integer default 1,p_limit integer default 50,p_status text default 'all',p_query text default '')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare admin boolean:=private.email_review_actor(); b private.email_review_batches; i private.email_review_items; result jsonb; total bigint;
begin
 if p_page is null or p_page not between 1 and 10000 or p_limit is null or p_limit not between 1 and 100 or p_status is null or p_status not in ('all','draft','approved','skipped') or p_query is null or length(p_query)>200 then raise exception using errcode='22023',message='Invalid query'; end if;
 if p_batch_id is null then
  if p_item_id is not null then raise exception using errcode='22023',message='Batch required'; end if;
  return jsonb_build_object('batches',(select coalesce(jsonb_agg(private.email_review_batch_json(x) order by x.created_at desc,x.id),'[]') from private.email_review_batches x where admin or x.reviewer_id=auth.uid()),'actorId',auth.uid(),'isAdmin',admin);
 end if;
 select * into b from private.email_review_batches where id=p_batch_id and (admin or reviewer_id=auth.uid());
 if not found then raise exception using errcode='42501',message='Access denied'; end if;
 if p_item_id is not null then
  select * into i from private.email_review_items where id=p_item_id and batch_id=b.id;
  if not found then raise exception using errcode='PT404',message='Item unavailable'; end if;
  return jsonb_build_object('item',private.email_review_item_json(i,true));
 end if;
 select count(*) into total from private.email_review_items x join public.projects p on p.id=x.project_id
 where x.batch_id=b.id and (p_status='all' or x.status=p_status) and (p_query='' or strpos(lower(concat_ws(' ',p.name,x.to_email,x.subject)),lower(p_query))>0);
 select coalesce(jsonb_agg(private.email_review_item_json(x,false) order by x.created_at,x.id),'[]') into result from
 (select list_item.* from private.email_review_items list_item join public.projects p on p.id=list_item.project_id where list_item.batch_id=b.id
 and (p_status='all' or list_item.status=p_status) and (p_query='' or strpos(lower(concat_ws(' ',p.name,list_item.to_email,list_item.subject)),lower(p_query))>0)
 order by list_item.created_at,list_item.id limit p_limit offset (p_page-1)*p_limit) x;
 return jsonb_build_object('batch',private.email_review_batch_json(b),'items',result,'page',p_page,'limit',p_limit,'total',total,'counts',private.email_review_counts(b.id));
end $$;

create function public.email_review_command(p_batch_id uuid,p_item_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare admin boolean:=private.email_review_actor(); actor uuid:=auth.uid(); b private.email_review_batches; i private.email_review_items;
 r private.email_review_receipts; cmd uuid; h text; action text; c jsonb; result jsonb; selected jsonb;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>65536
 or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('commandId','expectedRevision','action','to','subject','body','note','prerequisitesConfirmed','threadConfirmed','acknowledgeContextChange','expectedContextHash','threadMessageId'))
 then raise exception using errcode='22023',message='Invalid command'; end if;
 select * into b from private.email_review_batches where id=p_batch_id and (admin or reviewer_id=actor) for share;
 if not found then raise exception using errcode='42501',message='Access denied'; end if;
 action:=p_input->>'action'; cmd:=(p_input->>'commandId')::uuid;
 if cmd is null or action is null or action not in ('save','approve','skip','unapprove') or coalesce(p_input->>'expectedRevision','') !~ '^[1-9][0-9]{0,14}$'
 or (p_input ? 'note' and (jsonb_typeof(p_input->'note')<>'string' or length(p_input->>'note')>2000)) then raise exception using errcode='22023',message='Invalid command'; end if;
 if action='skip' and coalesce(p_input->>'note','') !~ '\S' then raise exception using errcode='22023',message='Skip reason required'; end if;
 if action<>'save' and (p_input ?| array['to','subject','body','acknowledgeContextChange','threadMessageId']) then raise exception using errcode='22023',message='Save required'; end if;
 if action='save' and not(p_input ?| array['to','subject','body','threadMessageId']) and p_input->'acknowledgeContextChange' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='Empty save'; end if;
 if exists(select 1 from unnest(array['to','subject','body','expectedContextHash']) field where p_input ? field and jsonb_typeof(p_input->field) is distinct from 'string')
 or exists(select 1 from unnest(array['prerequisitesConfirmed','threadConfirmed','acknowledgeContextChange']) field where p_input ? field and jsonb_typeof(p_input->field) is distinct from 'boolean')
 or (p_input ? 'threadMessageId' and jsonb_typeof(p_input->'threadMessageId') not in ('string','null')) then raise exception using errcode='22023',message='Invalid field type'; end if;
 h:=private.email_review_hash(jsonb_build_object('batch',p_batch_id,'item',p_item_id,'input',p_input-'commandId'));
 perform pg_advisory_xact_lock(hashtextextended('email-review-command:'||cmd,0));
 select * into r from private.email_review_receipts where command_id=cmd;
 if found then
  if r.actor_id<>actor or r.request_hash<>h then raise exception using errcode='PT409',message='Command conflict'; end if;
  return r.response;
 end if;
 select * into i from private.email_review_items where id=p_item_id and batch_id=b.id for update;
 if not found then raise exception using errcode='PT404',message='Item unavailable'; end if;
 if i.dispatch_id is not null or i.revision<>(p_input->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Review changed'; end if;
 -- Fence project/contact/state changes until this command commits.
 perform 1 from public.projects where id=i.project_id for share;
 perform 1 from public.contacts where id=(select contact_id from public.projects where id=i.project_id) for share;
 perform 1 from public.project_operational_states where project_id=i.project_id for share;
 c:=private.email_review_project_context(i.project_id);
 if action='save' then
  if p_input ? 'to' then i.to_email:=p_input->>'to'; end if;
  if p_input ? 'subject' then i.subject:=p_input->>'subject'; end if;
  if p_input ? 'body' then i.body:=p_input->>'body'; end if;
  perform private.email_review_validate_message(i.to_email,i.subject,i.body);
  if p_input ? 'threadMessageId' then i.thread_message_id:=p_input->>'threadMessageId'; end if;
  if i.thread_message_id is not null and not exists(select 1 from jsonb_array_elements(i.threads) t where t->>'messageId'=i.thread_message_id) then raise exception using errcode='22023',message='Unknown thread'; end if;
  if p_input->'acknowledgeContextChange'='true'::jsonb then
   if private.email_review_hash(c) is distinct from p_input->>'expectedContextHash' then raise exception using errcode='PT409',message='Context changed'; end if;
   i.saved_project_context:=c;
  end if;
  i.status:='draft';
 elsif action='approve' then
  if p_input->'prerequisitesConfirmed' is distinct from 'true'::jsonb or p_input->'threadConfirmed' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='Review confirmation required'; end if;
  if c is distinct from i.saved_project_context or c->>'archivedAt' is not null or c->>'state' is distinct from 'ACTIVE' or coalesce(c->>'stage','') not in ('CONTACTED','SENT') then raise exception using errcode='PT409',message='Project context changed or unavailable'; end if;
  select t into selected from jsonb_array_elements(i.threads) t where t->>'messageId'=i.thread_message_id;
  if selected is null or lower(selected->>'matchedRecipient')<>lower(i.to_email) then raise exception using errcode='PT409',message='Matched thread required'; end if;
  if i.subject is distinct from (case when selected->>'subject' ~* '^re:' then selected->>'subject' else 'Re: '||(selected->>'subject') end) then raise exception using errcode='PT409',message='Reply subject must match thread'; end if;
  i.status:='approved';
 elsif action='skip' then i.status:='skipped'; else i.status:='draft'; end if;
 i.revision:=i.revision+1; i.updated_at:=clock_timestamp();
 i.approved_at:=case when action='approve' then i.updated_at else null end;
 i.approved_by:=case when action='approve' then actor else null end;
 i.approval_hash:=case when action='approve' then private.email_review_hash(private.email_review_approval_content(i)) else null end;
 update private.email_review_items set to_email=i.to_email,subject=i.subject,body=i.body,thread_message_id=i.thread_message_id,
 saved_project_context=i.saved_project_context,status=i.status,revision=i.revision,updated_at=i.updated_at,
 approved_at=i.approved_at,approved_by=i.approved_by,approval_hash=i.approval_hash where id=i.id;
 insert into private.email_review_events(item_id,actor_id,action,revision,note,content_hash)
 values(i.id,actor,action,i.revision,p_input->>'note',private.email_review_hash(private.email_review_approval_content(i)));
 result:=jsonb_build_object('item',private.email_review_item_json(i,true));
 insert into private.email_review_receipts values(cmd,actor,h,result,clock_timestamp());
 return result;
end $$;

create function public.email_review_reviewers() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not private.email_review_actor() then raise exception using errcode='42501',message='Admin required'; end if;
 return jsonb_build_object('reviewers',(select coalesce(jsonb_agg(jsonb_build_object('id',u.user_id,'name',coalesce(a.raw_user_meta_data->>'name',a.email),'email',a.email,'role',u.role) order by a.email),'[]')
 from public.portal_users u join auth.users a on a.id=u.user_id where u.role::text in ('staff','admin') and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=clock_timestamp())));
end $$;

revoke all on function private.email_review_hash(jsonb),private.email_review_actor(),private.email_review_project_context(uuid),
 private.email_review_approval_content(private.email_review_items),private.email_review_item_json(private.email_review_items,boolean),
 private.email_review_counts(uuid),private.email_review_batch_json(private.email_review_batches),private.email_review_validate_message(text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.email_review_import(jsonb),public.email_review_read(uuid,uuid,integer,integer,text,text),public.email_review_command(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.email_review_import(jsonb),public.email_review_read(uuid,uuid,integer,integer,text,text),public.email_review_command(uuid,uuid,jsonb) to authenticated;
revoke all on function public.email_review_reviewers() from public,anon,service_role;
grant execute on function public.email_review_reviewers() to authenticated;
