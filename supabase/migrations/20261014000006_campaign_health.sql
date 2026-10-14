begin;
-- Provision privately, disabled until the exact deployment scope is reviewed.
create table private.sanctuary_campaign_monitor_scope(singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 scope jsonb not null check(jsonb_typeof(scope)='object'));
alter table private.sanctuary_campaign_monitor_scope enable row level security;
revoke all on private.sanctuary_campaign_monitor_scope from public,anon,authenticated,service_role;
-- Preserve the completed-seven-day contract. The new non-retained purpose is
-- fixed to the owner's campaign and NZ current calendar week, maximum five reads.
do $migration$
declare target oid; definition text; original jsonb;
begin
 target:=to_regprocedure('public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid,text,text,text)');
 select pg_get_functiondef(p.oid),to_jsonb(p) into definition,original from pg_proc p where p.oid=target;
 definition:=replace(definition,E'\r\n',E'\n');
 if target is null or position('if (select count(*) from jsonb_object_keys(q))<>3' in definition)=0
 or position('b->>''version'' is distinct from ''sanctuary-meta-campaigns-v1''' in definition)=0 then raise exception 'Unknown Meta lifecycle';end if;
 definition:=replace(definition,replace('octet_length(p_query)>128',E'\r\n',E'\n'),replace('octet_length(p_query)>2048',E'\r\n',E'\n'));
 definition:=replace(definition,replace('if (select count(*) from jsonb_object_keys(q))<>3 or jsonb_typeof(q->''retain'') is distinct from ''boolean'' or q->>''start'' is null or q->>''end'' is null
 or (q->>''end'')::date-(q->>''start'')::date<>6 then raise exception ''Invalid Meta dates'';end if;',E'\r\n',E'\n'),replace('if q->>''health''=''true'' then
 if not exists(select 1 from private.sanctuary_campaign_monitor_scope cs where cs.singleton and cs.enabled and cs.scope=q->''scope'' and cs.scope->>''account''=p_account)
 or q is distinct from jsonb_build_object(''health'',true,''retain'',false,''scope'',q->''scope'',
 ''start'',to_char((clock_timestamp() at time zone ''Pacific/Auckland'')::date-((extract(dow from clock_timestamp() at time zone ''Pacific/Auckland'')::integer-(q#>>''{scope,weekStartsOn}'')::integer+7)%7),''YYYY-MM-DD''),
 ''end'',to_char(clock_timestamp() at time zone ''Pacific/Auckland'',''YYYY-MM-DD'')) then raise exception ''Invalid campaign scope'';end if;
 else
 if octet_length(p_query)>128 then raise exception ''Invalid Meta dates'';end if;
 if (select count(*) from jsonb_object_keys(q))<>3 or jsonb_typeof(q->''retain'') is distinct from ''boolean'' or q->>''start'' is null or q->>''end'' is null
 or (q->>''end'')::date-(q->>''start'')::date<>6 then raise exception ''Invalid Meta dates'';end if;
 end if;',E'\r\n',E'\n'));
 definition:=replace(definition,replace('b->>''version'' is distinct from ''sanctuary-meta-campaigns-v1'' or b->>''source'' is distinct from ''meta'' or b->>''complete'' is distinct from ''true''
 or b->''period'' is distinct from (o.query::jsonb-''retain'')',E'\r\n',E'\n'),replace('(case when o.query::jsonb->>''health''=''true'' then
 b->>''version'' is distinct from ''sanctuary-campaign-health-v1'' or b->>''account'' is distinct from o.query::jsonb#>>''{scope,account}''
 or b->>''campaign'' is distinct from o.query::jsonb#>>''{scope,campaign}'' or b->>''adset'' is distinct from o.query::jsonb#>>''{scope,adset}''
 or b->>''currency'' is distinct from ''NZD'' or b->>''timezone'' is distinct from ''Pacific/Auckland''
 or b#>''{periods,week}'' is distinct from (o.query::jsonb-array[''retain'',''health'',''scope''])
 else b->>''version'' is distinct from ''sanctuary-meta-campaigns-v1'' or b->>''source'' is distinct from ''meta'' or b->>''complete'' is distinct from ''true''
 or b->''period'' is distinct from (o.query::jsonb-''retain'') end)',E'\r\n',E'\n'));
 definition:=replace(definition,replace('stamp:=(b->>''fetchedAt'')::timestamptz;',E'\r\n',E'\n'),replace('stamp:=(case when o.query::jsonb->>''health''=''true'' then b->>''observedAt'' else b->>''fetchedAt'' end)::timestamptz;',E'\r\n',E'\n'));
 definition:=replace(definition,replace('if p_action=''deliver'' then',E'\r\n',E'\n'),replace('if o.query::jsonb->>''health''=''true'' and not exists(select 1 from private.sanctuary_campaign_monitor_scope cs where cs.singleton and cs.enabled and cs.scope=o.query::jsonb->''scope'') then raise exception ''Campaign scope revoked'';end if;
 if p_action=''deliver'' then',E'\r\n',E'\n'));
 if position('Invalid campaign scope' in definition)=0 then raise exception 'Campaign lifecycle patch failed';end if;
 execute definition;
 if (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid=target) is distinct from original-'prosrc' then raise exception 'Meta grants changed';end if;
end $migration$;

create function public.sanctuary_campaign_outcomes(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; n integer; scope jsonb; launch timestamptz;
begin
 -- Reuse exact source/actor/current-generation/kill/expiry/delivery checks.
 perform public.sanctuary_meta_command(p_actor,p_account,p_binding,p_source,p_connection,p_environment,'deliver',p_operation);
 if not exists(select 1 from private.sanctuary_meta_operations where id=p_operation and query::jsonb->>'health'='true') then raise exception 'Wrong evidence purpose';end if;
 select query::jsonb->'scope' into scope from private.sanctuary_meta_operations where id=p_operation;
 launch:=(scope->>'launchDay')::date::timestamp at time zone 'Pacific/Auckland';
 select count(*) into n from public.enquiry_requests where created_at>=launch;
 if n>2000 then raise exception 'Campaign cohort exceeds bound';end if;
 with receipts as materialized (
   select e.*, coalesce(e.raw_payload#>>'{attribution,utm,utm_content}',e.utm->>'utm_content') ad,
     coalesce(e.raw_payload#>>'{attribution,utm,utm_term}',e.utm->>'utm_term') adset
   from public.enquiry_requests e where e.created_at>=launch
   and e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and coalesce(e.raw_payload#>>'{attribution,utm,utm_campaign}',e.utm->>'utm_campaign')=scope->>'campaign'
   and e.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid
   and e.project_id is distinct from '10c5db1a-602c-4f0c-8193-855b186215bb'::uuid
 ), ads(id) as (select value->>'id' from jsonb_array_elements(scope->'ads')),
 included as materialized (select e.* from receipts e join ads a on a.id=e.ad where e.adset=scope->>'adset'),
 facts as materialized (
   select e.*, (select state from private.enquiry_qualification_events where enquiry_id=e.id order by version desc limit 1) qualification,
     e.id=(select r.id from public.enquiry_requests r where r.project_id=e.project_id and r.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid order by r.created_at,r.id limit 1) origin,
     exists(select 1 from public.site_visit_events v where v.project_id=e.project_id and (to_jsonb(v)->>'confirmed_at' is not null or v.status='CONFIRMED')) visited,
     exists(select 1 from public.quotes q join public.quote_versions v on v.quote_id=q.id where q.project_id=e.project_id and (v.sent_at is not null or v.accepted_at is not null or v.status in ('SENT','ACCEPTED'))) quoted,
     exists(select 1 from public.commercial_current_accepted_quote_versions(e.project_id)) accepted,
     (exists(select 1 from public.xero_deposit_matches m where m.project_id=e.project_id and m.reversed_at is null and m.amount_inc_gst_cents>0)
       or exists(select 1 from public.deposit_invoices i join public.commercial_current_accepted_quote_versions(e.project_id) a on a.quote_version_id=i.quote_version_id
         where i.project_id=e.project_id and i.status='PAID' and i.payment_term_position=1 and i.total_inc_gst_cents>0)) paid
   from included e
 ), identities as materialized (
   select e.id,e.ad,e.created_at,p.id project_id,c.id contact_id,lower(trim(c.email)) email,
     greatest(e.created_at,coalesce((to_jsonb(p)->>'updated_at')::timestamptz,e.created_at),coalesce((to_jsonb(c)->>'updated_at')::timestamptz,e.created_at)) changed_at,
     (select count(*)>1 from public.projects other join public.contacts mailbox_contact on mailbox_contact.id=other.contact_id
       where lower(trim(mailbox_contact.email))=lower(trim(c.email))) multiple_projects
   from included e join public.projects p on p.id=e.project_id join public.contacts c on c.id=p.contact_id
   where c.email~'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$' and length(c.email)<=254
     and coalesce(to_jsonb(e)->>'contact_id',p.contact_id::text)=p.contact_id::text
 ), selected_identities as (
   select * from identities order by (created_at>=clock_timestamp()-interval '2 days') desc,
     md5(id::text||(clock_timestamp() at time zone 'Pacific/Auckland')::date::text) limit 200
 ), counts as (
   select a.id,count(f.id) enquiries,count(f.id) filter(where qualification='qualified') qualified,
     count(f.id) filter(where qualification is null or qualification='unreviewed') unreviewed,
     count(distinct project_id) filter(where origin and visited) visits,count(distinct project_id) filter(where origin and quoted) quoted,
     count(distinct project_id) filter(where origin and accepted) accepted,count(distinct project_id) filter(where origin and paid) paid
   from ads a left join facts f on f.ad=a.id group by a.id
 ) select jsonb_build_object('observedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cohortStart',scope->>'launchDay',
   'ads',(select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts),
   'correspondence',jsonb_build_object('total',(select count(*) from included),'eligible',(select count(*) from identities),
     'unlinked',(select count(*) from included)-(select count(*) from identities),'omitted',(select count(*) from identities)-(select count(*) from selected_identities),
     'contacts',coalesce((select jsonb_agg(jsonb_build_object('key',encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex'),'ad',ad,
       'enquiryId',id,'projectId',project_id,'contactId',contact_id,'email',email,'multipleProjects',multiple_projects,'createdAt',created_at,'changedAt',changed_at)) from selected_identities),'[]'::jsonb)),
   'enquiryReferenceHashes',coalesce((select jsonb_agg(encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex')) from included),'[]'::jsonb),
   'unmatchedCampaignEnquiries',(select count(*) from receipts where id not in (select id from included))) into result;
 return result;
end $$;
revoke all on function public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid) to service_role;
commit;
