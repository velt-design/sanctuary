begin;
select pg_advisory_xact_lock(819421,1);
-- Source owns all terminal learning. The display tail is bounded independently
-- of exact rendered-primary exclusion; neither rewrites immutable results.
create function public.meta_creative_learning(p_scope jsonb,p_originals jsonb,p_native text,p_donor text,p_template text,p_control jsonb)
returns jsonb language sql stable set search_path='' as $$
 with terminal as (
  select x.experiment,x.plan->>'challengerPrimary' as primary_text,a.payload,
   encode(sha256(convert_to(to_jsonb(x.plan->>'challengerPrimary')::text,'UTF8')),'hex') as copy_hash
  from public.meta_creative_execution x join public.meta_creative_formal_analysis a on a.experiment=x.experiment
  where x.plan->>'purpose'='formal_experiment' and x.plan->'scope'=p_scope and x.plan->'originalAds'=p_originals
   and x.plan->>'nativeContractHash'=p_native and x.plan->>'controlAd'=p_donor and x.plan->>'landingTemplate'=p_template
   and x.plan->'control'=p_control and a.payload->>'planHash'=x.plan_hash and x.plan->>'challengerPrimary' is not null
 ), distinct_copies as(select distinct copy_hash from terminal), tail as(
  select jsonb_build_object('copyHash',copy_hash,'hookPrefix',left(rtrim(split_part(primary_text,E'\n',1),E'\r'),160),'result',case payload->>'decision'when 'revert'then 'reverted'when 'retain'then 'retained'else payload->>'decision'end,
   'observedAt',payload->'observedAt','reason',payload->'reason','quality',payload->'quality',
   'enquiries',jsonb_build_array((select v->'enquiries'from jsonb_array_elements(payload->'arms')v where v->>'arm'='control'),(select v->'enquiries'from jsonb_array_elements(payload->'arms')v where v->>'arm'='challenger')),
   'spend',jsonb_build_array((select v->'spend'from jsonb_array_elements(payload->'arms')v where v->>'arm'='control'),(select v->'spend'from jsonb_array_elements(payload->'arms')v where v->>'arm'='challenger'))) as summary,
   (payload->>'observedAt')::timestamptz as observed_at,experiment
  from terminal order by observed_at desc,experiment desc limit 4
 ) select jsonb_build_object('previous',(select coalesce(jsonb_agg(summary order by observed_at desc,experiment desc),'[]')from tail),
  'complete',(select count(*)<=64 from distinct_copies),
  'excluded',case when(select count(*)from distinct_copies)<=64 then(select coalesce(jsonb_agg(copy_hash order by copy_hash),'[]')from distinct_copies)else'[]'::jsonb end)
$$;
revoke all on function public.meta_creative_learning(jsonb,jsonb,text,text,text,jsonb) from public,anon,authenticated,service_role;
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_learning;
revoke all on function public.meta_creative_executor_without_learning(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;learning jsonb;plan jsonb;template_key text;copy_hash text;
begin
 perform pg_advisory_xact_lock(819421,1);
 if p_stage='history' or(p_stage='prepare'and p_payload#>>'{plan,purpose}'='formal_experiment')then
  select * into c from public.meta_creative_control where singleton for update;
  select template into template_key from public.landing_experiment_control where singleton;
  if c.binding is null or c.binding is distinct from p_binding or p_command is null or jsonb_typeof(p_payload)is distinct from'object'or octet_length(p_payload::text)>14000 then raise exception 'Creative authority unavailable';end if;
  if p_stage='history'then
   if p_experiment is not null or p_payload-array['generation','controlAd','control','template']<>'{}'::jsonb or(select count(*)from jsonb_object_keys(p_payload))<>4
    or(p_payload->>'generation')::bigint is distinct from c.generation or not c.enabled or not c.authority_current or c.global_stop
    or p_payload->>'template'is distinct from template_key or not(c.original_ads ? (p_payload->>'controlAd'))
    or jsonb_typeof(p_payload->'control')is distinct from'object'or p_payload#>>'{control,page}'is distinct from c.scope->>'page'
    or coalesce(p_payload#>>'{control,primary}','')=''or coalesce(p_payload#>>'{control,path}','')not in('/acrylic-roof-pergolas-auckland','/auckland-outdoor-living')
    then raise exception 'Creative history unavailable';end if;
   learning:=public.meta_creative_learning(c.scope,c.original_ads,c.native_contract_hash,p_payload->>'controlAd',template_key,p_payload->'control');
   return learning||jsonb_build_object('version',1,'generation',c.generation,'controlAd',p_payload->>'controlAd','template',template_key);
  end if;
  -- Exact prepared-command replay still delegates to the original immutable
  -- plan check. All new plans must pass durable exclusion under the same lock.
  if not exists(select 1 from public.meta_creative_execution where experiment=p_experiment)then
   plan:=p_payload->'plan';
   learning:=public.meta_creative_learning(c.scope,c.original_ads,c.native_contract_hash,plan->>'controlAd',template_key,plan->'control');
   if learning->'complete'<>'true'::jsonb then raise exception 'Creative history coverage bound';end if;
   copy_hash:=encode(sha256(convert_to(to_jsonb(plan->>'challengerPrimary')::text,'UTF8')),'hex');
   if learning->'excluded'?copy_hash then raise exception 'Previously evaluated creative copy';end if;
  end if;
 end if;
 return public.meta_creative_executor_without_learning(p_binding,p_command,p_experiment,p_stage,p_payload);
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
