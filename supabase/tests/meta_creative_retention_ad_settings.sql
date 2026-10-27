-- Appended to the unchanged retention fixture's BEGIN/functions by the local
-- native harness. All rows and synthetic trigger changes roll back together.
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;
do $retained_settings$
declare test_case text;e uuid;cmd uuid;p jsonb;settings jsonb;setting jsonb;body jsonb;checks integer:=0;
begin
 foreach test_case in array array['old_five','preserved','changed','missing','unplanned','null_injected','schedule_injected','budget_injected','unknown_plan','old_unknown']loop
  begin
   settings:=case when test_case in('old_five','old_unknown')then null else '{"conversion_domain":"sanctuarypergolas.co.nz","adlabels":[{"id":"6601"}],"bid_amount":125,"creative_asset_groups_spec":{"groups":[{"id":"6602"}]},"creative_audience_pairing_persona":"original-persona","creative_automation_spec":{"enabled":false},"display_sequence":2,"engagement_audience":true,"priority":3,"audience_id":null,"dataset_split_specs":[{"split":2}],"ad_schedule_start_time":"2026-10-27T19:00:00+13:00","ad_schedule_end_time":"2026-11-10T19:00:00+13:00"}'::jsonb end;
   if test_case='unknown_plan'then settings:=settings||'{"unreviewed_setting":true}'::jsonb;end if;
   e:=pg_temp.ret_seed('21',null,settings);cmd:=gen_random_uuid();p:=pg_temp.ret_payload(e,'create_retained');body:=p#>'{intent,body}';
   if settings is not null then
    select body||coalesce(jsonb_object_agg(key,case when jsonb_typeof(value)='string'then value else to_jsonb(value::text)end),'{}'::jsonb)into body from jsonb_each(settings)where value<>'null'::jsonb and key not in('ad_schedule_start_time','ad_schedule_end_time');
    -- Compact JS-style JSON must compare semantically with the native JSONB.
    body:=body||jsonb_build_object('creative_asset_groups_spec','{"groups":[{"id":"6602"}]}','creative_automation_spec','{"enabled":false}','dataset_split_specs','[{"split":2}]');
   end if;
   if test_case='changed'then body:=body||'{"bid_amount":"126"}'::jsonb;end if;
   if test_case='missing'then body:=body-'conversion_domain';end if;
   if test_case in('unplanned','old_unknown')then body:=body||'{"unreviewed_setting":"true"}'::jsonb;end if;
   if test_case='null_injected'then body:=body||'{"audience_id":"null"}'::jsonb;end if;
   if test_case='schedule_injected'then body:=body||'{"ad_schedule_start_time":"2026-10-27T19:00:00+13:00"}'::jsonb;end if;
   if test_case='budget_injected'then body:=body||'{"daily_budget":"40000"}'::jsonb;end if;
   p:=jsonb_set(p,'{intent,body}',body);
   if test_case in('old_five','preserved')then
    perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_admit',p);
    perform pg_temp.ret_assert(exists(select 1 from public.meta_creative_effects where command=cmd and state='prepared'and kind='create_paused_ad'));
    perform pg_temp.ret_assert((select intent->'body'=body from public.meta_creative_execution_intents where command=cmd));
    perform pg_temp.ret_assert(not(body?'ad_schedule_start_time')and not(body?'ad_schedule_end_time')and not(body?'audience_id'));
   else
    perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),cmd,e,'retention_admit',p));
    perform pg_temp.ret_assert(not exists(select 1 from public.meta_creative_effects where command=cmd));
   end if;
   raise exception 'Rollback retained settings fixture'using errcode='P9998';
  exception when sqlstate'P9998'then null;end;
  checks:=checks+1;
 end loop;
 raise notice 'Retained settings native cases: %',checks;
 if checks<>10 then raise exception 'Retained settings case coverage differs';end if;
end$retained_settings$;
select jsonb_build_object('cases',10,'oldFiveAndAll13PlanSettings',true,'mixedWireJsonAndNullOmission',true,'negativeCases',8,'nativeCreateRetained',true,'providerCalls',0);
rollback;
