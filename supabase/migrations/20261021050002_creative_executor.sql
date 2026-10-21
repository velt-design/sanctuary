begin;
select pg_advisory_xact_lock(819421,1);
create table public.meta_creative_execution (
 experiment uuid primary key references public.meta_creative_plans(id), plan jsonb not null check(octet_length(plan::text)<=8000),
 plan_hash text not null unique check(plan_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default clock_timestamp()
);
create table public.meta_creative_execution_intents (
 command uuid primary key references public.meta_creative_effects(command), experiment uuid not null references public.meta_creative_execution(experiment),
 kind text not null check(kind in('create_creative','create_control','create_challenger','create_study','pause_control','pause_challenger','end_study')),
 intent jsonb not null check(octet_length(intent::text)<=8000)
);
create table public.meta_creative_execution_receipts (
 command uuid primary key, experiment uuid not null references public.meta_creative_execution(experiment),
 stage text not null check(stage in('canary','measurement','activation','evaluation','cleanup')), evidence_hash text check(evidence_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table public.meta_creative_execution enable row level security;
alter table public.meta_creative_execution_intents enable row level security;
alter table public.meta_creative_execution_receipts enable row level security;
revoke all on public.meta_creative_execution,public.meta_creative_execution_intents,public.meta_creative_execution_receipts from public,anon,authenticated,service_role;
create trigger creative_execution_immutable before update or delete on public.meta_creative_execution for each row execute function public.meta_creative_immutable();
create trigger creative_intents_immutable before update or delete on public.meta_creative_execution_intents for each row execute function public.meta_creative_immutable();
create trigger creative_execution_receipts_immutable before update or delete on public.meta_creative_execution_receipts for each row execute function public.meta_creative_immutable();
create function public.meta_creative_registered_ads()
returns table(experiment uuid,ad_id text,arm text,campaign_id text,adset_id text,page_path text,starts_at timestamptz,ends_at timestamptz)
language sql security definer set search_path='' as $$
 select x.experiment,o.object_id,case when i.kind='create_control' then 'control' else 'challenger' end,
  x.plan->'scope'->>'campaign',x.plan->'scope'->>'adset',x.plan->'control'->>'path',
  to_timestamp((x.plan->>'start')::double precision),to_timestamp((x.plan->>'end')::double precision)
 from public.meta_creative_execution x join public.meta_creative_objects o on o.experiment=x.experiment and o.kind='ad'
 join public.meta_creative_execution_intents i on i.command=o.created_by and i.kind in('create_control','create_challenger')
$$;
create function public.meta_creative_reporting_registry() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if (select count(*) from public.meta_creative_registered_ads())>40 then raise exception 'Creative registry coverage bound';end if;
 select coalesce(jsonb_agg(jsonb_build_object('experiment',r.experiment,'id',r.ad_id,'arm',r.arm,'campaign',r.campaign_id,'adset',r.adset_id,
  'page',x.plan->'scope'->>'page','path',r.page_path,'template',x.plan->>'landingTemplate','purpose',x.plan->>'purpose',
  'delivery',exists(select 1 from public.meta_creative_execution_receipts proof where proof.experiment=x.experiment and proof.stage='activation'),
  'startsAt',r.starts_at,'endsAt',r.ends_at) order by r.experiment,r.arm),'[]') into result
 from public.meta_creative_registered_ads() r join public.meta_creative_execution x on x.experiment=r.experiment;
 return result;
end$$;
revoke all on function public.meta_creative_reporting_registry() from public,anon,authenticated;
grant execute on function public.meta_creative_reporting_registry() to service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;r public.acquisition_experiment_reservation;x public.meta_creative_execution;
 e public.meta_creative_effects;i public.meta_creative_execution_intents;v_kind text;v_target text;result jsonb;payload jsonb;ready boolean;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton for update;
 if c.binding is null or c.binding is distinct from p_binding or p_command is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>14000 then raise exception 'Creative authority unavailable';end if;
 select * into r from public.acquisition_experiment_reservation where singleton for update;
 if p_stage='read' and p_experiment is null and r.lane='creative' then p_experiment:=r.experiment;end if;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if p_stage='read' then
  return jsonb_build_object('enabled',c.enabled,'cleanupEnabled',c.cleanup_enabled,'stopped',c.global_stop or not c.authority_current,'generation',c.generation,'plan',x.plan,
   'creativeReference',(select object_id from public.meta_creative_effects where experiment=x.experiment and kind='create_creative' and state='confirmed' order by confirmed_at desc limit 1),'reserved',r.experiment is not null,'template',(select template from public.landing_experiment_control where singleton),'nativeContractHash',c.native_contract_hash,'activationReady',false,'measurementReady',exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='measurement'),
   'state',case when x.experiment is null then 'empty' when r.experiment is distinct from x.experiment then 'closed'
    when exists(select 1 from public.meta_creative_effects where experiment=x.experiment and terminal_cleanup) then 'cleanup'
    when exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='canary') then 'canary_ready' else 'prepared' end,
   'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',o.object_id,'kind',case when j.kind='create_control' then 'control' when j.kind='create_challenger' then 'challenger' else o.kind end,
      'command',o.created_by,'requestHash',o.request_hash)),'[]') from public.meta_creative_objects o join public.meta_creative_execution_intents j on j.command=o.created_by where o.experiment=x.experiment),
   'effects',(select coalesce(jsonb_agg(jsonb_build_object('command',a.command,'kind',j.kind,'requestHash',a.request_hash,'state',a.state,'object',a.object_id,'evidenceHash',a.evidence_hash,'intent',j.intent) order by a.admitted_at),'[]')
     from public.meta_creative_effects a join public.meta_creative_execution_intents j on j.command=a.command where a.experiment=x.experiment));
 end if;
 if p_stage='prepare' then
  -- Authenticated broker validates the full versioned plan before this command;
  -- SQL independently binds its immutable scope/control/budget/approval identity.
  payload:=p_payload->'plan';
  if coalesce(p_payload->>'planHash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>8000
   or payload->>'experiment' is distinct from p_experiment::text or payload->'scope' is distinct from c.scope or payload->'originalAds' is distinct from c.original_ads
   or coalesce(payload->>'preStateHash','') !~ '^[a-f0-9]{64}$' or payload->>'nativeContractHash' is distinct from c.native_contract_hash
   or payload->>'dailyMinor' is distinct from '40000' or payload->>'weeklyMinor' is distinct from '280000' or payload->>'studyDailyMinor' is distinct from '8000'
   or payload->>'landingTemplate' is distinct from (select template from public.landing_experiment_control where singleton)
   or coalesce(payload->>'purpose','') not in('paused_capability','formal_experiment')
   or payload->>'currency' is distinct from 'NZD' or payload->>'timezone' is distinct from 'Pacific/Auckland'
   or (payload->>'purpose'='formal_experiment' and (coalesce(payload->>'generator','')='' or payload->>'generator' is not distinct from payload->>'reviewer'))
   or (payload->>'purpose'='paused_capability' and (payload->'generator' is distinct from 'null'::jsonb or payload->'reviewer' is distinct from 'null'::jsonb or payload->>'challengerPrimary' is distinct from payload->'control'->>'primary'))
   or (payload->>'approvalUntil')::timestamptz<=clock_timestamp() then raise exception 'Unapproved execution plan';end if;
  if x.experiment is not null then if x.plan=payload and x.plan_hash=p_payload->>'planHash' then return jsonb_build_object('prepared',true);end if;raise exception 'Plan conflict';end if;
  if payload->>'purpose'='formal_experiment' and exists(select 1 from public.meta_creative_execution where plan->>'purpose'='formal_experiment' and created_at>clock_timestamp()-interval '7 days') then raise exception 'Creative cadence';end if;
  if r.experiment is not null or not c.enabled or not c.authority_current or c.global_stop then raise exception 'Acquisition reservation unavailable';end if;
  -- Record the exact authenticated donor read in the immutable plan. No targeting,
  -- budget, principal or original-ad scope is learned from caller input.
  update public.meta_creative_control set control_hash=payload->>'preStateHash' where singleton returning * into c;
  result:=public.meta_creative_command(p_binding,p_command,p_experiment,'reserve',jsonb_build_object('scope',c.scope,'originalAds',c.original_ads,'approvalHash',payload->>'approvalHash',
   'catalogueHash',payload->>'approvedAssetHash','controlHash',c.control_hash,'budgetHash',c.budget_hash,'nativeContractHash',c.native_contract_hash,'generator',payload->>'generator','reviewer',payload->>'reviewer','purpose',payload->>'purpose'));
  insert into public.meta_creative_execution(experiment,plan,plan_hash) values(p_experiment,payload,p_payload->>'planHash');return result;
 end if;
 if x.experiment is null then raise exception 'Execution plan unavailable';end if;
 if p_stage='receipt' then
  select to_jsonb(a) into result from public.meta_creative_effects a where command=p_command and experiment=p_experiment;return result;
 end if;
 if p_stage='authority' then
  if c.global_stop or not c.authority_current or (not c.enabled and not c.cleanup_enabled) or c.generation is distinct from (p_payload->>'generation')::bigint
   or r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment then raise exception 'Execution authority changed';end if;return jsonb_build_object('current',true);
 end if;
 if p_stage='admit' then
  payload:=p_payload->'intent';v_kind:=payload->>'kind';v_target:=payload->>'target';
  if coalesce(v_kind,'') not in('create_creative','create_control','create_challenger','create_study','pause_control','pause_challenger','end_study')
   or jsonb_typeof(payload) is distinct from 'object' or coalesce(payload->>'requestHash','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_payload->'cleanup') is distinct from 'boolean' then raise exception 'Invalid execution intent';end if;
  select * into i from public.meta_creative_execution_intents where command=p_command;
  if found then if i.intent=payload and i.experiment=p_experiment then return jsonb_build_object('prepared',true);end if;raise exception 'Intent conflict';end if;
  if exists(select 1 from public.meta_creative_execution_intents where experiment=p_experiment and kind=v_kind) then raise exception 'Execution step already admitted';end if;
  result:=public.meta_creative_command(p_binding,p_command,p_experiment,case when (p_payload->>'cleanup')::boolean then 'admit_cleanup' else 'admit' end,
   jsonb_build_object('kind',case when v_kind in('create_control','create_challenger') then 'create_paused_ad' when v_kind in('pause_control','pause_challenger') then 'pause_ad' else v_kind end,
    'objectId',v_target,'requestHash',payload->>'requestHash','generation',p_payload->'generation','preStateHash',x.plan->>'preStateHash','observedAt',to_timestamp((payload->>'at')::double precision/1000)));
  insert into public.meta_creative_execution_intents(command,experiment,kind,intent) values(p_command,p_experiment,v_kind,payload);return result;
 end if;
 if p_stage in('check','confirm','no_effect') then return public.meta_creative_command(p_binding,p_command,p_experiment,p_stage,p_payload);end if;
 if p_stage='measurement' then
  -- Registry join proof only. Consumer release compatibility is additionally
  -- required before activation, which this executor cannot perform.
  select count(*)=(case when x.plan->>'purpose'='paused_capability' then 1 else 2 end) and count(distinct arm)=(case when x.plan->>'purpose'='paused_capability' then 1 else 2 end) into ready from public.meta_creative_registered_ads() where experiment=p_experiment;
  if ready then insert into public.meta_creative_execution_receipts(command,experiment,stage) values(p_command,p_experiment,p_stage) on conflict(command)do nothing;end if;
  return jsonb_build_object('ready',ready);
 end if;
 if p_stage in('canary','cleanup') then
  if coalesce(p_payload->>'evidenceHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Missing confirmation';end if;
  if p_stage='cleanup' then result:=public.meta_creative_command(p_binding,p_command,p_experiment,'cleanup',p_payload);
  else
   if not exists(select 1 from public.meta_creative_effects where experiment=p_experiment and kind='create_creative' and state='confirmed') or (select count(*) from public.meta_creative_objects where experiment=p_experiment and kind in('ad','study'))<>(case when x.plan->>'purpose'='paused_capability' then 1 else 3 end)
    or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and state in('prepared','uncertain')) then raise exception 'Canary unconfirmed';end if;
   result:=jsonb_build_object('paused',true,'activationReady',false);
  end if;
  insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash) values(p_command,p_experiment,p_stage,p_payload->>'evidenceHash') on conflict(command)do nothing;
  return result;
 end if;
 raise exception 'Unknown execution stage';
end$$;
revoke all on function public.meta_creative_registered_ads() from public,anon,authenticated;
grant execute on function public.meta_creative_registered_ads() to service_role;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;

-- Registered formal-test ads use the same consent, genuine-record and canonical outcome rules.
create or replace function public.sanctuary_campaign_outcomes_without_intake(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid)
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
 ), ads(id,is_creative) as (select value->>'id',false from jsonb_array_elements(scope->'ads')
   union all select r.ad_id,true from public.meta_creative_registered_ads() r join public.meta_creative_execution x on x.experiment=r.experiment
    where r.campaign_id=scope->>'campaign' and r.adset_id=scope->>'adset' and x.plan->>'purpose'='formal_experiment'),
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
   select a.id,a.is_creative,count(f.id) enquiries,count(f.id) filter(where qualification='qualified') qualified,
     count(f.id) filter(where qualification is null or qualification='unreviewed') unreviewed,
     count(distinct project_id) filter(where origin and visited) visits,count(distinct project_id) filter(where origin and quoted) quoted,
     count(distinct project_id) filter(where origin and accepted) accepted,count(distinct project_id) filter(where origin and paid) paid
   from ads a left join facts f on f.ad=a.id group by a.id,a.is_creative
 ) select jsonb_build_object('observedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cohortStart',scope->>'launchDay',
   'ads',(select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts where not is_creative),
   'creativeAds',coalesce((select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts where is_creative),'[]'),
   'correspondence',jsonb_build_object('total',(select count(*) from included),'eligible',(select count(*) from identities),
     'unlinked',(select count(*) from included)-(select count(*) from identities),'omitted',(select count(*) from identities)-(select count(*) from selected_identities),
     'contacts',coalesce((select jsonb_agg(jsonb_build_object('key',encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex'),'ad',ad,
       'enquiryId',id,'projectId',project_id,'contactId',contact_id,'email',email,'multipleProjects',multiple_projects,'createdAt',created_at,'changedAt',changed_at)) from selected_identities),'[]'::jsonb)),
   'enquiryReferenceHashes',coalesce((select jsonb_agg(encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex')) from included),'[]'::jsonb),
   'unmatchedCampaignEnquiries',(select count(*) from receipts where id not in (select id from included))) into result;
 return result;
end $$;

revoke all on function public.sanctuary_campaign_outcomes_without_intake(uuid,text,text,text,uuid,text,uuid) from public,anon,authenticated,service_role;
commit;
