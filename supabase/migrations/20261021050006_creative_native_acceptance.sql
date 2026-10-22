begin;
select pg_advisory_xact_lock(819421,1);
-- Provisioned only by the separately reviewed operator after actual hosted
-- paused-study AND native UI proof. No application role may insert or revoke.
create table public.meta_creative_native_acceptance (
 id uuid primary key, example_experiment uuid not null references public.meta_creative_execution(experiment),
 example_study text not null check(example_study ~ '^[1-9][0-9]{0,19}$'),
 scope jsonb not null, original_ads jsonb not null,
 native_contract_hash text not null check(native_contract_hash ~ '^[a-f0-9]{64}$'),
 pixel text not null check(pixel ~ '^[1-9][0-9]{0,19}$'), example_cells jsonb not null,
 observed_at timestamptz not null, recorded_at timestamptz not null default clock_timestamp(),
 provenance text not null check(provenance='hosted_paused_study_and_native_ui'),
 evidence_hash text not null unique check(evidence_hash ~ '^[a-f0-9]{64}$'),
 unit_proof_hash text not null check(unit_proof_hash ~ '^[a-f0-9]{64}$'),
 allocation_proof_hash text not null check(allocation_proof_hash ~ '^[a-f0-9]{64}$'),
 originals_proof_hash text not null check(originals_proof_hash ~ '^[a-f0-9]{64}$'),
 objective_proof_hash text not null check(objective_proof_hash ~ '^[a-f0-9]{64}$'),
 semantics jsonb not null check(semantics='{"currency":"NZD","timezone":"Pacific/Auckland","budgetOwner":"campaign","dailyMinor":40000,"studyDailyMinor":8000,"uiStudyDaily":80,"offset":100,"allocation":"existing_campaign_portion","experimentalUnit":"SPLIT_TEST_V2_ad_cells","topology":"same_original_adset","objective":"CONVERSIONS","event":"Lead","isPrimary":true}'::jsonb),
 check(isfinite(observed_at) and isfinite(recorded_at) and observed_at<=recorded_at)
);
create table public.meta_creative_native_revocations (
 acceptance uuid primary key references public.meta_creative_native_acceptance(id),
 recorded_at timestamptz not null default clock_timestamp(),
 reason text not null check(reason in('contract_changed','scope_changed','provider_behavior_changed','operator_withdrawn')),
 evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$')
);
alter table public.meta_creative_native_acceptance enable row level security;
alter table public.meta_creative_native_revocations enable row level security;
revoke all on public.meta_creative_native_acceptance,public.meta_creative_native_revocations from public,anon,authenticated,service_role;
create trigger native_acceptance_immutable before update or delete on public.meta_creative_native_acceptance for each row execute function public.meta_creative_immutable();
create trigger native_revocation_immutable before update or delete on public.meta_creative_native_revocations for each row execute function public.meta_creative_immutable();
create function public.meta_creative_native_acceptance_guard() returns trigger language plpgsql set search_path='' as $$
declare x public.meta_creative_execution;cell jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 new.recorded_at:=clock_timestamp();
 select * into x from public.meta_creative_execution where experiment=new.example_experiment;
 if x.experiment is null or x.plan->>'purpose'<>'formal_experiment' or new.scope is distinct from x.plan->'scope'
 or new.original_ads is distinct from x.plan->'originalAds' or new.native_contract_hash is distinct from x.plan->>'nativeContractHash'
 or new.pixel is distinct from x.plan#>>'{nativeObjective,adspixels,0,id}'
 or new.observed_at<x.created_at or new.observed_at>new.recorded_at or new.observed_at>=to_timestamp((x.plan->>'start')::double precision)
 or not exists(select 1 from public.meta_creative_objects where experiment=x.experiment and kind='study' and object_id=new.example_study)
 or not exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='canary') then raise exception 'Native example differs';end if;
 if jsonb_typeof(new.example_cells) is distinct from 'array' or jsonb_array_length(new.example_cells)<>2 then raise exception 'Native cells differ';end if;
 if (select count(distinct c->>'id') from jsonb_array_elements(new.example_cells)c)<>2
 or (select count(distinct c->>'ad') from jsonb_array_elements(new.example_cells)c)<>2
 or (select count(distinct c->>'arm') from jsonb_array_elements(new.example_cells)c)<>2 then raise exception 'Native cells differ';end if;
 for cell in select value from jsonb_array_elements(new.example_cells) loop
  if jsonb_typeof(cell) is distinct from 'object' or (cell-array['id','ad','arm'])<>'{}'::jsonb
  or jsonb_typeof(cell->'id') is distinct from 'string' or jsonb_typeof(cell->'ad') is distinct from 'string'
  or coalesce(cell->>'id','')!~'^[1-9][0-9]{0,19}$' or coalesce(cell->>'ad','')!~'^[1-9][0-9]{0,19}$'
  or coalesce(cell->>'arm','') not in('control','challenger')
  or not exists(select 1 from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by
    where o.experiment=x.experiment and o.kind='ad' and o.object_id=cell->>'ad' and i.kind='create_'||(cell->>'arm')) then raise exception 'Native cells differ';end if;
 end loop;
 return new;
end$$;
revoke all on function public.meta_creative_native_acceptance_guard() from public,anon,authenticated,service_role;
create trigger native_acceptance_guard before insert on public.meta_creative_native_acceptance for each row execute function public.meta_creative_native_acceptance_guard();
create function public.meta_creative_native_acceptance_for(p_experiment uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.meta_creative_native_acceptance;c public.meta_creative_control;x public.meta_creative_execution;
begin
 select * into c from public.meta_creative_control where singleton;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if x.plan->>'purpose' is distinct from 'formal_experiment' then return null;end if;
 select * into a from public.meta_creative_native_acceptance where scope=c.scope and original_ads=c.original_ads
  and scope=x.plan->'scope' and original_ads=x.plan->'originalAds' and native_contract_hash=c.native_contract_hash and native_contract_hash=x.plan->>'nativeContractHash'
  and pixel=x.plan#>>'{nativeObjective,adspixels,0,id}' order by recorded_at desc,id desc limit 1;
 -- Do not fall back to an older proof after the current contract was revoked.
 if a.id is null or exists(select 1 from public.meta_creative_native_revocations where acceptance=a.id) then return null;end if;
 return jsonb_build_object('version',1,'id',a.id,'scope',a.scope,'originalAds',a.original_ads,'nativeContractHash',a.native_contract_hash,'pixel',a.pixel,'semantics',a.semantics,
 'exampleExperiment',a.example_experiment,'exampleStudy',a.example_study,'exampleCells',a.example_cells,'observedAt',a.observed_at,'recordedAt',a.recorded_at,
 'provenance',a.provenance,'evidenceHash',a.evidence_hash,'unitProofHash',a.unit_proof_hash,'allocationProofHash',a.allocation_proof_hash,'originalsProofHash',a.originals_proof_hash,'objectiveProofHash',a.objective_proof_hash);
end$$;
revoke all on function public.meta_creative_native_acceptance_for(uuid) from public,anon,authenticated,service_role;
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_native_acceptance;
revoke all on function public.meta_creative_executor_without_native_acceptance(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 result:=public.meta_creative_executor_without_native_acceptance(p_binding,p_command,p_experiment,p_stage,p_payload);
 if p_stage='read' then result:=result||jsonb_build_object('nativeAcceptance',public.meta_creative_native_acceptance_for((result#>>'{plan,experiment}')::uuid));end if;
 return result;
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
