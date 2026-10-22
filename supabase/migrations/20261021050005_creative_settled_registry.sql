begin;
select pg_advisory_xact_lock(819421,1);
-- Read only history from the existing immutable registry. Cleanup history is
-- not permission to change originals or to assume a currently ACTIVE ad paused.
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_settled_registry;
revoke all on function public.meta_creative_executor_without_settled_registry(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; c public.meta_creative_control; settled jsonb; capable boolean;
begin
 perform pg_advisory_xact_lock(819421,1);
 result:=public.meta_creative_executor_without_settled_registry(p_binding,p_command,p_experiment,p_stage,p_payload);
 if p_stage<>'read' then return result;end if;
 select * into c from public.meta_creative_control where singleton;
 select coalesce(jsonb_agg(o.object_id order by o.object_id),'[]') into settled
 from public.meta_creative_objects o join public.meta_creative_execution x on x.experiment=o.experiment
 where o.kind='ad' and x.plan->'scope'=c.scope
  and exists(select 1 from public.meta_creative_execution_receipts r where r.experiment=x.experiment and r.stage='cleanup')
  and exists(select 1 from public.meta_creative_effects e where e.experiment=x.experiment and e.kind='pause_ad' and e.target=o.object_id and e.object_id=o.object_id and e.state='confirmed');
 -- A full inventory is required. Never silently truncate old ads from validation.
 if jsonb_array_length(settled)>20 then settled:=null;end if;
 select exists(select 1 from public.meta_creative_execution x where x.plan->>'purpose'='paused_capability'
  and x.plan->'scope'=c.scope and x.plan->'originalAds'=c.original_ads and x.plan->>'nativeContractHash'=c.native_contract_hash
  and exists(select 1 from public.meta_creative_execution_receipts r where r.experiment=x.experiment and r.stage='canary')
  and exists(select 1 from public.meta_creative_execution_receipts r where r.experiment=x.experiment and r.stage='cleanup')) into capable;
 return result||jsonb_build_object('settledAds',settled,'capabilityReady',capable);
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
