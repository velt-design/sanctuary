-- Human-approved Outlook reply ledger. No provider calls, timers, or automatic retries.
create table private.email_review_dispatches (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references private.email_review_batches(id),
 item_id uuid not null references private.email_review_items(id), payload jsonb not null,
 state text not null default 'ready' check(state in ('ready','attempting','sent','uncertain','cancelled')),
 prepared_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(),
 attempt_id uuid, attempted_at timestamptz, sent_at timestamptz, outlook_message_id text unique, outlook_web_link text, note text,
 check ((state in ('attempting','sent','uncertain'))=(attempt_id is not null)),
 check ((state='sent')=(sent_at is not null and outlook_message_id is not null and outlook_web_link is not null))
);
create unique index email_review_dispatch_live_item on private.email_review_dispatches(item_id) where state<>'cancelled';
alter table private.email_review_dispatches enable row level security;
revoke all on private.email_review_dispatches from public,anon,authenticated,service_role;

create function private.email_review_dispatch_overview(p_batch uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('batchId',p_batch,'prepared',exists(select 1 from private.email_review_dispatches where batch_id=p_batch and state<>'cancelled'),
 'counts',jsonb_build_object('ready',count(*) filter(where state='ready'),'attempting',count(*) filter(where state='attempting'),
 'sent',count(*) filter(where state='sent'),'uncertain',count(*) filter(where state='uncertain'),'cancelled',count(*) filter(where state='cancelled')),
 'items',coalesce(jsonb_agg(jsonb_build_object('id',id,'itemId',item_id,'projectName',payload->'projectContext'->>'name',
 'to',payload->>'to','subject',payload->>'subject','state',state,'attemptId',attempt_id,'attemptedAt',attempted_at,'sentAt',sent_at,
 'outlookMessageId',outlook_message_id,'outlookWebLink',outlook_web_link) order by created_at,id),'[]'))
 from private.email_review_dispatches where batch_id=p_batch
$$;

create function private.email_review_dispatch_check(i private.email_review_items) returns void language plpgsql security definer set search_path=pg_catalog,private,public as $$
declare c jsonb;
begin
 perform 1 from public.projects where id=i.project_id for share;
 perform 1 from public.contacts where id=(select contact_id from public.projects where id=i.project_id) for share;
 perform 1 from public.project_operational_states where project_id=i.project_id for share;
 c:=private.email_review_project_context(i.project_id);
 if i.status<>'approved' or i.approval_hash is distinct from private.email_review_hash(private.email_review_approval_content(i))
 or c is distinct from i.saved_project_context or c->>'archivedAt' is not null or c->>'state' is distinct from 'ACTIVE'
 or coalesce(c->>'stage','') not in ('CONTACTED','SENT') then
 raise exception using errcode='PT409',message='Approval or project changed; review again'; end if;
end $$;

create function public.email_review_dispatch(p_batch_id uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare admin boolean:=private.email_review_actor(); actor uuid:=auth.uid(); b private.email_review_batches;
 i private.email_review_items; d private.email_review_dispatches; r private.email_review_receipts;
 cmd uuid; h text; result jsonb; replies jsonb:='[]'; n int; outcome text; payload jsonb;
begin
 if not admin then raise exception using errcode='42501',message='Admin required'; end if;
 if p_action not in ('read','prepare','claim','result','cancel') or p_action is null
 or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>16384 then
 raise exception using errcode='22023',message='Invalid dispatch command'; end if;
 -- The same batch lock serialises preparation, review mutations and claims.
 select * into b from private.email_review_batches where id=p_batch_id for update;
 if not found then raise exception using errcode='PT404',message='Batch unavailable'; end if;
 if p_action='read' then return private.email_review_dispatch_overview(b.id); end if;
 if p_action in ('prepare','claim','cancel') then
   if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('commandId','limit')) then raise exception using errcode='22023',message='Invalid command'; end if;
   cmd:=(p_input->>'commandId')::uuid;
   if cmd is null then raise exception using errcode='22023',message='Command required'; end if;
   h:=private.email_review_hash(jsonb_build_object('dispatch',p_action,'batch',b.id,'input',p_input-'commandId'));
   perform pg_advisory_xact_lock(hashtextextended('email-review-command:'||cmd,0));
   select * into r from private.email_review_receipts where command_id=cmd;
   if found then
     if r.actor_id<>actor or r.request_hash<>h then raise exception using errcode='PT409',message='Command conflict'; end if;
     if p_action='claim' then return jsonb_build_object('replayed',true,'replies','[]'::jsonb); end if;
     return r.response;
   end if;
 end if;
 if p_action='prepare' then
   if exists(select 1 from private.email_review_items where batch_id=b.id and status='draft')
   or not exists(select 1 from private.email_review_items where batch_id=b.id and status='approved') then
     raise exception using errcode='PT409',message='Finish reviewing the batch first'; end if;
   for i in select * from private.email_review_items where batch_id=b.id and status='approved' and dispatch_id is null order by id for update loop
     perform private.email_review_dispatch_check(i);
     payload:=private.email_review_approval_content(i)||jsonb_build_object('mailbox','info@sanctuarypergolas.co.nz','approvalHash',i.approval_hash);
     insert into private.email_review_dispatches(batch_id,item_id,payload,prepared_by) values(b.id,i.id,payload,actor) returning * into d;
     update private.email_review_items set dispatch_id=d.id where id=i.id;
     insert into private.email_review_events(item_id,actor_id,action,revision,content_hash) values(i.id,actor,'dispatch_prepared',i.revision,i.approval_hash);
   end loop;
   result:=private.email_review_dispatch_overview(b.id);
 elsif p_action='claim' then
   if jsonb_typeof(p_input->'limit') is distinct from 'number' or (p_input->>'limit') !~ '^[0-9]+$' then raise exception using errcode='22023',message='Invalid limit'; end if;
   n:=(p_input->>'limit')::int;
   if n not between 1 and 10 then raise exception using errcode='22023',message='Invalid limit'; end if;
   for d in select * from private.email_review_dispatches where batch_id=b.id and state='ready' order by id limit n for update loop
     select * into i from private.email_review_items where id=d.item_id for update;
     perform private.email_review_dispatch_check(i);
     if i.dispatch_id is distinct from d.id or d.payload->>'approvalHash' is distinct from i.approval_hash then raise exception using errcode='PT409',message='Dispatch changed'; end if;
     update private.email_review_dispatches set state='attempting',attempt_id=gen_random_uuid(),attempted_at=clock_timestamp() where id=d.id returning * into d;
     replies:=replies||jsonb_build_array(jsonb_build_object('id',d.id,'attemptId',d.attempt_id,'itemId',i.id,'projectId',i.project_id,
       'mailbox',d.payload->>'mailbox','messageId',d.payload->'thread'->>'messageId','to',d.payload->>'to','subject',d.payload->>'subject','body',d.payload->>'body','approvalHash',i.approval_hash));
     insert into private.email_review_events(item_id,actor_id,action,revision,content_hash) values(i.id,actor,'outlook_attempt_started',i.revision,i.approval_hash);
   end loop;
   result:=jsonb_build_object('replayed',false,'replies',replies);
 elsif p_action='cancel' then
   -- Only messages which were never claimed can be reopened. Attempted messages stay held.
   for d in select * from private.email_review_dispatches where batch_id=b.id and state='ready' order by id for update loop
     update private.email_review_dispatches set state='cancelled' where id=d.id;
     update private.email_review_items set dispatch_id=null,status='draft',revision=revision+1,approved_at=null,approved_by=null,approval_hash=null,updated_at=clock_timestamp() where id=d.item_id returning * into i;
     insert into private.email_review_events(item_id,actor_id,action,revision,content_hash) values(i.id,actor,'dispatch_cancelled',i.revision,private.email_review_hash(private.email_review_approval_content(i)));
   end loop;
   result:=private.email_review_dispatch_overview(b.id);
 else
   if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('intentId','attemptId','outcome','outlookMessageId','outlookWebLink','note')) then raise exception using errcode='22023',message='Invalid result'; end if;
   outcome:=p_input->>'outcome';
   if outcome is null or outcome not in ('sent','uncertain') or length(coalesce(p_input->>'note',''))>2000 then raise exception using errcode='22023',message='Invalid result'; end if;
   select * into d from private.email_review_dispatches where id=(p_input->>'intentId')::uuid and batch_id=b.id for update;
   if not found or d.attempt_id is distinct from (p_input->>'attemptId')::uuid or d.state not in ('attempting','uncertain','sent') then raise exception using errcode='PT409',message='Attempt unavailable'; end if;
   if outcome='sent' and (length(btrim(coalesce(p_input->>'outlookMessageId',''))) not between 1 and 2000
     or p_input->>'outlookMessageId' ~ E'[\r\n]' or length(coalesce(p_input->>'outlookWebLink',''))>4000
     or coalesce(p_input->>'outlookWebLink','') !~ '^https://outlook\.(office\.com|office365\.com)/') then raise exception using errcode='22023',message='Outlook evidence required'; end if;
   if outcome='uncertain' and (p_input?'outlookMessageId' or p_input?'outlookWebLink') then raise exception using errcode='22023',message='Unexpected evidence'; end if;
   if d.state='sent' then
     if outcome<>'sent' or d.outlook_message_id is distinct from p_input->>'outlookMessageId' or d.outlook_web_link is distinct from p_input->>'outlookWebLink' then raise exception using errcode='PT409',message='Sent evidence is immutable'; end if;
     return private.email_review_dispatch_overview(b.id);
   end if;
   update private.email_review_dispatches set state=outcome,note=p_input->>'note',
     sent_at=case when outcome='sent' then clock_timestamp() end,outlook_message_id=p_input->>'outlookMessageId',outlook_web_link=p_input->>'outlookWebLink' where id=d.id;
   select * into i from private.email_review_items where id=d.item_id;
   insert into private.email_review_events(item_id,actor_id,action,revision,note,content_hash) values(i.id,actor,'outlook_'||outcome,i.revision,p_input->>'note',i.approval_hash);
   return private.email_review_dispatch_overview(b.id);
 end if;
 insert into private.email_review_receipts(command_id,actor_id,request_hash,response) values(cmd,actor,h,case when p_action='claim' then jsonb_build_object('replayed',true,'replies','[]'::jsonb) else result end);
 return result;
end $$;
revoke all on function private.email_review_dispatch_overview(uuid),private.email_review_dispatch_check(private.email_review_items) from public,anon,authenticated,service_role;
revoke all on function public.email_review_dispatch(uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.email_review_dispatch(uuid,text,jsonb) to authenticated;
