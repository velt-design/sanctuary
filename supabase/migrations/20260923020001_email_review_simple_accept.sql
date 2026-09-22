-- One-step acceptance and explicit fresh-message delivery. No sends or business-row changes.
-- Preserve existing approval hashes and frozen intents: version 1 uses the original exact payload.
alter table private.email_review_items
 add column delivery_mode text not null default 'reply' check(delivery_mode in ('reply','new')),
 add column approval_version smallint not null default 1 check(approval_version in (1,2));
alter table private.email_review_items add constraint email_review_delivery_consistent
 check(approval_version=1 or (delivery_mode='new' and thread_message_id is null) or (delivery_mode='reply' and (status<>'approved' or thread_message_id is not null)));
alter table private.email_review_dispatches
 add column actual_delivery_mode text check(actual_delivery_mode in ('reply','new')),
 add column fallback_reason text check(fallback_reason='anchor_not_found_before_send');

create function private.email_review_delivery(p_threads jsonb,p_to text,p_subject text) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $$
declare matches jsonb; candidate jsonb; reply_subject text;
begin
 select coalesce(jsonb_agg(t),'[]') into matches from jsonb_array_elements(p_threads) t where lower(trim(t->>'matchedRecipient'))=lower(trim(p_to));
 if jsonb_array_length(matches)=1 then
  candidate:=matches->0;
  reply_subject:=case when candidate->>'subject' ~* '^re:' then candidate->>'subject' else 'Re: '||(candidate->>'subject') end;
  if p_subject=reply_subject then return jsonb_build_object('mode','reply','threadMessageId',candidate->>'messageId','subject',p_subject); end if;
 end if;
 return jsonb_build_object('mode','new','threadMessageId',null,'subject',regexp_replace(p_subject,'^(re:[[:space:]]*)+','','i'));
end $$;
revoke all on function private.email_review_delivery(jsonb,text,text) from public,anon,authenticated,service_role;

create or replace function private.email_review_approval_content(i private.email_review_items) returns jsonb language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('itemId',i.id,'projectId',i.project_id,'revision',i.revision,'to',i.to_email,'subject',i.subject,'body',i.body,
 'prerequisites',i.prerequisites,'evidence',i.evidence,'context',i.context,'projectContext',i.saved_project_context,
 'thread',(select t from jsonb_array_elements(i.threads) t where t->>'messageId'=i.thread_message_id),'cc','[]'::jsonb,'bcc','[]'::jsonb)||case when i.approval_version=2 then jsonb_build_object('deliveryMode',i.delivery_mode,'allowFreshFallback',i.delivery_mode='reply') else '{}'::jsonb end
$$;
create or replace function private.email_review_item_json(i private.email_review_items,p_detail boolean) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c jsonb:=private.email_review_project_context(i.project_id); result jsonb;
begin
 result:=jsonb_build_object('id',i.id,'batchId',i.batch_id,'sourceId',i.source_id,'projectId',i.project_id,
 'projectName',c->>'name','to',i.to_email,'subject',i.subject,'status',i.status,'revision',i.revision,
 'updatedAt',i.updated_at,'contextChanged',c is distinct from i.saved_project_context);
 if p_detail then result:=result||jsonb_build_object('body',i.body,'prerequisites',i.prerequisites,'evidence',i.evidence,'context',i.context,
 'savedProjectContext',i.saved_project_context,'currentProjectContext',c,'currentContextHash',private.email_review_hash(c),
 'deliveryMode',i.delivery_mode,'threads',i.threads,'threadMessageId',i.thread_message_id,'dispatchId',i.dispatch_id,
 'approvedAt',i.approved_at,'approvedBy',i.approved_by,'approvalHash',i.approval_hash,
 'events',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'actorId',e.actor_id,
 'revision',e.revision,'note',e.note,'createdAt',e.created_at) order by e.created_at,e.id),'[]') from private.email_review_events e where e.item_id=i.id)); end if;
 return result;
end $$;
create or replace function public.email_review_command(p_batch_id uuid,p_item_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare admin boolean:=private.email_review_actor(); actor uuid:=auth.uid(); b private.email_review_batches; i private.email_review_items;
 r private.email_review_receipts; cmd uuid; h text; action text; c jsonb; result jsonb; selected jsonb; delivery jsonb;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>65536
 or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('commandId','expectedRevision','action','to','subject','body','note','prerequisitesConfirmed','threadConfirmed','acknowledgeContextChange','expectedContextHash','threadMessageId'))
 then raise exception using errcode='22023',message='Invalid command'; end if;
 select * into b from private.email_review_batches where id=p_batch_id and (admin or reviewer_id=actor) for share;
 if not found then raise exception using errcode='42501',message='Access denied'; end if;
 action:=p_input->>'action'; cmd:=(p_input->>'commandId')::uuid;
 if cmd is null or action is null or action not in ('save','accept','approve','skip','unapprove') or coalesce(p_input->>'expectedRevision','') !~ '^[1-9][0-9]{0,14}$'
 or (p_input ? 'note' and (jsonb_typeof(p_input->'note')<>'string' or length(p_input->>'note')>2000)) then raise exception using errcode='22023',message='Invalid command'; end if;
 if action not in ('save','accept') and (p_input ?| array['to','subject','body','acknowledgeContextChange','threadMessageId']) then raise exception using errcode='22023',message='Save required'; end if;
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
 if action='accept' then
  if not(p_input ?& array['to','subject','body','expectedContextHash']) or coalesce(p_input->>'expectedContextHash','') !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Displayed message and context required'; end if;
  if private.email_review_hash(c) is distinct from p_input->>'expectedContextHash' or c->>'archivedAt' is not null or c->>'state' is distinct from 'ACTIVE' or coalesce(c->>'stage','') not in ('CONTACTED','SENT') then raise exception using errcode='PT409',message='Project context changed or unavailable'; end if;
  i.to_email:=p_input->>'to'; i.subject:=p_input->>'subject'; i.body:=p_input->>'body';
  perform private.email_review_validate_message(i.to_email,i.subject,i.body);
  delivery:=private.email_review_delivery(i.threads,i.to_email,i.subject);
  if i.subject is distinct from delivery->>'subject' then raise exception using errcode='22023',message='Review the fresh message subject'; end if;
  i.delivery_mode:=delivery->>'mode'; i.thread_message_id:=delivery->>'threadMessageId'; i.approval_version:=2;
  i.saved_project_context:=c; i.status:='approved';
 elsif action='save' then
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
  delivery:=private.email_review_delivery(i.threads,i.to_email,i.subject);
  i.subject:=delivery->>'subject'; perform private.email_review_validate_message(i.to_email,i.subject,i.body);
  i.delivery_mode:=delivery->>'mode'; i.thread_message_id:=delivery->>'threadMessageId'; i.approval_version:=2;
  i.status:='draft';
 elsif action='approve' then
  if p_input->'prerequisitesConfirmed' is distinct from 'true'::jsonb or p_input->'threadConfirmed' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='Review confirmation required'; end if;
  if c is distinct from i.saved_project_context or c->>'archivedAt' is not null or c->>'state' is distinct from 'ACTIVE' or coalesce(c->>'stage','') not in ('CONTACTED','SENT') then raise exception using errcode='PT409',message='Project context changed or unavailable'; end if;
  select t into selected from jsonb_array_elements(i.threads) t where t->>'messageId'=i.thread_message_id;
  if selected is null or lower(selected->>'matchedRecipient')<>lower(i.to_email) then raise exception using errcode='PT409',message='Matched thread required'; end if;
  if i.subject is distinct from (case when selected->>'subject' ~* '^re:' then selected->>'subject' else 'Re: '||(selected->>'subject') end) then raise exception using errcode='PT409',message='Reply subject must match thread'; end if;
  i.approval_version:=1; i.delivery_mode:='reply'; i.status:='approved';
 elsif action='skip' then i.status:='skipped'; else i.status:='draft'; end if;
 i.revision:=i.revision+1; i.updated_at:=clock_timestamp();
 i.approved_at:=case when action in ('accept','approve') then i.updated_at else null end;
 i.approved_by:=case when action in ('accept','approve') then actor else null end;
 i.approval_hash:=case when action in ('accept','approve') then private.email_review_hash(private.email_review_approval_content(i)) else null end;
 update private.email_review_items set delivery_mode=i.delivery_mode,approval_version=i.approval_version,to_email=i.to_email,subject=i.subject,body=i.body,thread_message_id=i.thread_message_id,
 saved_project_context=i.saved_project_context,status=i.status,revision=i.revision,updated_at=i.updated_at,
 approved_at=i.approved_at,approved_by=i.approved_by,approval_hash=i.approval_hash where id=i.id;
 insert into private.email_review_events(item_id,actor_id,action,revision,note,content_hash)
 values(i.id,actor,action,i.revision,p_input->>'note',private.email_review_hash(private.email_review_approval_content(i)));
 result:=jsonb_build_object('item',private.email_review_item_json(i,true));
 insert into private.email_review_receipts values(cmd,actor,h,result,clock_timestamp());
 return result;
end $$;
create or replace function private.email_review_dispatch_overview(p_batch uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('batchId',p_batch,'prepared',exists(select 1 from private.email_review_dispatches where batch_id=p_batch and state<>'cancelled'),
 'counts',jsonb_build_object('ready',count(*) filter(where state='ready'),'attempting',count(*) filter(where state='attempting'),
 'sent',count(*) filter(where state='sent'),'uncertain',count(*) filter(where state='uncertain'),'cancelled',count(*) filter(where state='cancelled')),
 'items',coalesce(jsonb_agg(jsonb_build_object('id',id,'itemId',item_id,'projectName',payload->'projectContext'->>'name',
 'to',payload->>'to','subject',payload->>'subject','state',state,'attemptId',attempt_id,'attemptedAt',attempted_at,'sentAt',sent_at,
 'actualDeliveryMode',actual_delivery_mode,'fallbackReason',fallback_reason,'outlookMessageId',outlook_message_id,'outlookWebLink',outlook_web_link) order by created_at,id),'[]'))
 from private.email_review_dispatches where batch_id=p_batch
$$;
create or replace function public.email_review_dispatch(p_batch_id uuid,p_action text,p_input jsonb default '{}'::jsonb) returns jsonb
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
       'mailbox',d.payload->>'mailbox','deliveryMode',coalesce(d.payload->>'deliveryMode','reply'),'allowFreshFallback',coalesce((d.payload->>'allowFreshFallback')::boolean,false),'messageId',d.payload->'thread'->>'messageId','to',d.payload->>'to','subject',d.payload->>'subject','body',d.payload->>'body','approvalHash',i.approval_hash));
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
   if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('intentId','attemptId','outcome','outlookMessageId','outlookWebLink','note','actualDeliveryMode','fallbackReason')) then raise exception using errcode='22023',message='Invalid result'; end if;
   outcome:=p_input->>'outcome';
   if outcome is null or outcome not in ('sent','uncertain') or length(coalesce(p_input->>'note',''))>2000 then raise exception using errcode='22023',message='Invalid result'; end if;
   select * into d from private.email_review_dispatches where id=(p_input->>'intentId')::uuid and batch_id=b.id for update;
   if not found or d.attempt_id is distinct from (p_input->>'attemptId')::uuid or d.state not in ('attempting','uncertain','sent') then raise exception using errcode='PT409',message='Attempt unavailable'; end if;
   if d.payload ? 'deliveryMode' then
     if coalesce(p_input->>'actualDeliveryMode','') not in ('reply','new') then raise exception using errcode='22023',message='Actual delivery mode required'; end if;
     if p_input->>'actualDeliveryMode' is distinct from d.payload->>'deliveryMode' then
       if (d.payload->>'deliveryMode'='reply' and p_input->>'actualDeliveryMode'='new' and d.payload->'allowFreshFallback'='true'::jsonb and p_input->>'fallbackReason'='anchor_not_found_before_send') is distinct from true then raise exception using errcode='22023',message='Unapproved delivery mode'; end if;
     elsif p_input ? 'fallbackReason' then raise exception using errcode='22023',message='Unexpected fallback reason'; end if;
     if d.state in ('uncertain','sent') and (d.actual_delivery_mode is distinct from p_input->>'actualDeliveryMode' or d.fallback_reason is distinct from p_input->>'fallbackReason') then raise exception using errcode='PT409',message='Attempt delivery mode is immutable'; end if;
   elsif p_input ?| array['actualDeliveryMode','fallbackReason'] then raise exception using errcode='22023',message='Legacy attempt uses its original delivery policy'; end if;
   if outcome='sent' and (length(btrim(coalesce(p_input->>'outlookMessageId',''))) not between 1 and 2000
     or p_input->>'outlookMessageId' ~ E'[\r\n]' or length(coalesce(p_input->>'outlookWebLink',''))>4000
     or coalesce(p_input->>'outlookWebLink','') !~ '^https://outlook\.(office\.com|office365\.com)/') then raise exception using errcode='22023',message='Outlook evidence required'; end if;
   if outcome='uncertain' and (p_input?'outlookMessageId' or p_input?'outlookWebLink') then raise exception using errcode='22023',message='Unexpected evidence'; end if;
   if d.state='sent' then
     if outcome<>'sent' or d.outlook_message_id is distinct from p_input->>'outlookMessageId' or d.outlook_web_link is distinct from p_input->>'outlookWebLink' then raise exception using errcode='PT409',message='Sent evidence is immutable'; end if;
     return private.email_review_dispatch_overview(b.id);
   end if;
   update private.email_review_dispatches set state=outcome,note=p_input->>'note',actual_delivery_mode=p_input->>'actualDeliveryMode',fallback_reason=p_input->>'fallbackReason',
     sent_at=case when outcome='sent' then clock_timestamp() end,outlook_message_id=p_input->>'outlookMessageId',outlook_web_link=p_input->>'outlookWebLink' where id=d.id;
   select * into i from private.email_review_items where id=d.item_id;
   insert into private.email_review_events(item_id,actor_id,action,revision,note,content_hash) values(i.id,actor,'outlook_'||outcome,i.revision,p_input->>'note',i.approval_hash);
   return private.email_review_dispatch_overview(b.id);
 end if;
 insert into private.email_review_receipts(command_id,actor_id,request_hash,response) values(cmd,actor,h,case when p_action='claim' then jsonb_build_object('replayed',true,'replies','[]'::jsonb) else result end);
 return result;
end $$;
