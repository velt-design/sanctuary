-- One root-owned proposal on the existing control. No caller approval endpoint,
-- new identity, quota, effect kind, table, grant or historical-row rewrite.
begin;
select pg_advisory_xact_lock(819421,1);
alter table public.meta_creative_control add column owner_proposal jsonb
 check(owner_proposal is null or (
  jsonb_typeof(owner_proposal)='object' and octet_length(owner_proposal::text)<=12000
  and owner_proposal ?& array['version','proposal','plan','planHash','expiresAt']
  and (owner_proposal-'version'-'proposal'-'plan'-'planHash'-'expiresAt')='{}'::jsonb
  and owner_proposal->>'version'='1' and jsonb_typeof(owner_proposal->'proposal')='object'
  and coalesce(owner_proposal->>'expiresAt','') ~ '^\d{4}-\d{2}-\d{2}T'
  and ((owner_proposal->'plan'='null'::jsonb and owner_proposal->'planHash'='null'::jsonb)
   or (jsonb_typeof(owner_proposal->'plan')='object' and octet_length((owner_proposal->'plan')::text)<=8000
    and coalesce(owner_proposal->>'planHash','') ~ '^[a-f0-9]{64}$'
    and owner_proposal#>>'{plan,purpose}'='formal_experiment'
    and owner_proposal#>>'{plan,ownerReview,kind}'='owner_directed_independent_review_v1'))));

-- Direct control-table privileges remain revoked for all application roles.
-- Root uses an exact current-generation CAS; any change revokes old admission.
create or replace function public.meta_creative_generation() returns trigger language plpgsql set search_path='' as $$
begin if row(new.enabled,new.cleanup_enabled,new.authority_current,new.global_stop,new.binding,new.native_contract_hash,new.scope,new.original_ads,new.budget_hash,new.control_hash,new.delivery_enabled,new.owner_proposal)
 is distinct from row(old.enabled,old.cleanup_enabled,old.authority_current,old.global_stop,old.binding,old.native_contract_hash,old.scope,old.original_ads,old.budget_hash,old.control_hash,old.delivery_enabled,old.owner_proposal)
 then new.generation:=old.generation+1;else new.generation:=old.generation;end if;return new;end$$;

-- A cutoff read never returns or creates a frozen formal cohort. Reuse the
-- current genuine-source query, exclusions, ambiguity and hard row bounds.
do $cutoff$
declare d text;old_text text;new_text text;
begin
 d:=pg_get_functiondef('public.meta_creative_formal_cohort(text,uuid,boolean)'::regprocedure);
 old_text:='meta_creative_formal_cohort(p_binding text, p_experiment uuid, p_freeze boolean)';
 new_text:='meta_creative_loss_cohort(p_binding text, p_experiment uuid, p_through timestamp with time zone)';
 if strpos(d,old_text)=0 then raise exception 'Loss cohort signature predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='if p_freeze is null or';new_text:=$patch$if p_through is null or not c.enabled or not c.delivery_enabled or c.owner_proposal->'plan' is distinct from x.plan
  or c.scope is distinct from x.plan->'scope' or c.original_ads is distinct from x.plan->'originalAds'
  or c.native_contract_hash is distinct from x.plan->>'nativeContractHash' or(c.owner_proposal->>'expiresAt')::timestamptz<=clock_timestamp()
  or not exists(select 1 from public.acquisition_experiment_reservation where singleton and lane='creative'and experiment=p_experiment) or$patch$;
 if strpos(d,old_text)=0 then raise exception 'Loss cohort authority predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='if x.plan#>>''{evaluation,ambiguity}'' is distinct from ''finite_allocation_envelope_v1'' then return public.meta_creative_formal_cohort_v1(p_binding,p_experiment,p_freeze);end if;';
 new_text:='if x.plan#>>''{evaluation,ambiguity}'' is distinct from ''finite_allocation_envelope_v1'' then raise exception ''Loss cohort policy unavailable'';end if;';
 if strpos(d,old_text)=0 then raise exception 'Loss cohort policy predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:=E'select payload into result from public.meta_creative_formal_cohorts where experiment=p_experiment and plan_hash=x.plan_hash;\n if result is not null then return result;end if;';
 if strpos(d,old_text)=0 then raise exception 'Loss cohort frozen predecessor differs';end if;d:=replace(d,old_text,'');
 old_text:='f:=to_timestamp((x.plan->>''end'')::double precision);';new_text:='f:=p_through;';
 if strpos(d,old_text)=0 then raise exception 'Loss cohort cutoff predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='if p_freeze and stamp<m then raise exception ''Formal cohort not mature'';end if;';
 new_text:=$patch$if f<=s or f>to_timestamp((x.plan->>'end')::double precision) or stamp<m
  or f is distinct from (date_trunc('day',f at time zone 'Pacific/Auckland')at time zone 'Pacific/Auckland') then
  raise exception 'Loss cutoff is not a complete matured Auckland day';end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Loss cohort maturity predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='''frozen'',p_freeze';new_text:='''frozen'',false';
 if strpos(d,old_text)=0 then raise exception 'Loss cohort projection predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='if p_freeze then insert into public.meta_creative_formal_cohorts(experiment,plan_hash,payload)values(p_experiment,x.plan_hash,result);end if;';
 if strpos(d,old_text)=0 then raise exception 'Loss cohort storage predecessor differs';end if;d:=replace(d,old_text,'');
 execute d;
end$cutoff$;
revoke all on function public.meta_creative_loss_cohort(text,uuid,timestamptz)from public,anon,authenticated,service_role;

do $migration$
declare d text;old_text text;new_text text;
begin
 d:=pg_get_functiondef('public.meta_creative_without_activation(text,uuid,uuid,text,jsonb)'::regprocedure);
 old_text:='if p_stage=''reserve'' then';
 new_text:=$patch$if p_stage='reserve' then
  if p_payload ? 'ownerPlanHash' and (
   c.owner_proposal->'plan' is null or c.owner_proposal->'plan'='null'::jsonb
   or c.owner_proposal#>>'{plan,experiment}' is distinct from p_experiment::text
   or c.owner_proposal#>>'{plan,ownerReview,kind}' is distinct from 'owner_directed_independent_review_v1'
   or (c.owner_proposal->>'expiresAt')::timestamptz<=clock_timestamp()
   or p_payload is distinct from jsonb_build_object('scope',c.owner_proposal#>'{plan,scope}','originalAds',c.owner_proposal#>'{plan,originalAds}',
    'approvalHash',c.owner_proposal#>>'{plan,approvalHash}','catalogueHash',c.owner_proposal#>>'{plan,approvedAssetHash}',
    'controlHash',c.owner_proposal#>>'{plan,preStateHash}','budgetHash',c.budget_hash,'nativeContractHash',c.owner_proposal#>>'{plan,nativeContractHash}',
    'generator',null,'reviewer',null,'purpose','formal_experiment','ownerPlanHash',c.owner_proposal->>'planHash'))
   then raise exception 'Root reviewed reservation differs';end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Owner reserve predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='(key_count<>9 and not(key_count=10 and p_payload->>''purpose'' in(''paused_capability'',''formal_experiment'')))';
 new_text:='(key_count<>9 and not(key_count=10 and p_payload->>''purpose'' in(''paused_capability'',''formal_experiment'')) and not(key_count=11 and p_payload ? ''ownerPlanHash''))';
 if strpos(d,old_text)=0 then raise exception 'Owner reserve shape predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='case when p_payload->>''purpose''=''paused_capability'' then';
 new_text:='case when p_payload ? ''ownerPlanHash'' then p_payload->''generator'' is distinct from ''null''::jsonb or p_payload->''reviewer'' is distinct from ''null''::jsonb when p_payload->>''purpose''=''paused_capability'' then';
 if strpos(d,old_text)=0 then raise exception 'Owner reserve review predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='if p.id is null then raise exception ''Unknown plan'';end if;';
 new_text:=$patch$if p.id is null then raise exception 'Unknown plan';end if;
 if (p_stage='admit' or (p_stage='check' and not exists(select 1 from public.meta_creative_effects where command=p_command and terminal_cleanup))) and p.plan ? 'ownerPlanHash' and
  (c.owner_proposal->>'planHash' is distinct from p.plan->>'ownerPlanHash'
   or c.owner_proposal#>>'{plan,experiment}' is distinct from p_experiment::text
   or (c.owner_proposal->>'expiresAt')::timestamptz<=clock_timestamp()) then
  raise exception 'Root reviewed authority revoked';end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Owner dispatch predecessor differs';end if;d:=replace(d,old_text,new_text);execute d;

 d:=pg_get_functiondef('public.meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb)'::regprocedure);
 old_text:='payload:=p_payload->''plan'';';
 new_text:=$patch$payload:=p_payload->'plan';
  if payload ? 'ownerReview' and
   (payload->>'purpose' is distinct from 'formal_experiment'
    or c.owner_proposal->'plan' is distinct from payload
    or c.owner_proposal->>'planHash' is distinct from p_payload->>'planHash'
    or payload#>>'{ownerReview,kind}' is distinct from 'owner_directed_independent_review_v1'
    or (c.owner_proposal->>'expiresAt')::timestamptz<=clock_timestamp()) then
   raise exception 'Root reviewed execution differs';end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Owner prepare predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='(payload->>''purpose''=''formal_experiment'' and (coalesce(payload->>''generator'','''')='''' or payload->>''generator'' is not distinct from payload->>''reviewer''))';
 new_text:='(payload->>''purpose''=''formal_experiment'' and (case when payload ? ''ownerReview'' then payload->''generator'' is distinct from ''null''::jsonb or payload->''reviewer'' is distinct from ''null''::jsonb else coalesce(payload->>''generator'','''')='''' or payload->>''generator'' is not distinct from payload->>''reviewer'' end))';
 if strpos(d,old_text)=0 then raise exception 'Owner prepare review predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='''purpose'',payload->>''purpose''));';
 new_text:='''purpose'',payload->>''purpose'')||(case when payload ? ''ownerReview'' then jsonb_build_object(''ownerPlanHash'',p_payload->>''planHash'')else ''{}''::jsonb end));';
 if strpos(d,old_text)=0 then raise exception 'Owner prepare reservation predecessor differs';end if;d:=replace(d,old_text,new_text);execute d;

 d:=pg_get_functiondef('public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)'::regprocedure);
 old_text:=E'\nbegin\n perform pg_advisory_xact_lock(819421,1);';
 new_text:=$patch$
declare result jsonb;proposal jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 if p_stage='cohort' and p_payload ? 'through' then
  if p_command is null or p_payload-array['freeze','through']<>'{}'::jsonb or (select count(*)from jsonb_object_keys(p_payload))<>2
   or p_payload->'freeze' is distinct from 'false'::jsonb or jsonb_typeof(p_payload->'through') is distinct from 'string' then raise exception 'Loss cohort command differs';end if;
  return public.meta_creative_loss_cohort(p_binding,p_experiment,(p_payload->>'through')::timestamptz);
 end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Owner read declaration predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='return public.meta_creative_executor_without_inventory(p_binding,p_command,p_experiment,p_stage,p_payload);';
 new_text:=$patch$result:=public.meta_creative_executor_without_inventory(p_binding,p_command,p_experiment,p_stage,p_payload);
 if p_stage='read' then
  select owner_proposal into proposal from public.meta_creative_control where singleton and binding=p_binding;
  return result||jsonb_build_object('ownerProposal',proposal);
 end if;
 return result;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Owner read predecessor differs';end if;d:=replace(d,old_text,new_text);execute d;
end$migration$;

-- Retention and future comparator history use the SAME reviewed projection.
-- Existing model-authored primary-only cases retain their historical behavior.
create or replace function public.meta_creative_winning_control(p_plan jsonb,p_creative text)returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=jsonb_set(jsonb_set(p_plan->'control','{id}',to_jsonb(p_creative)),'{primary}',p_plan->'challengerPrimary');
 edit jsonb:=p_plan#>'{ownerReview,edit}';media jsonb;v jsonb;target jsonb;videos jsonb:='[]';source text;
begin
 if result->>'format'='video_assets'then
  result:=jsonb_set(result,'{payload,asset_feed_spec,bodies,0,text}',p_plan->'challengerPrimary');
  if result#>'{payload,object_story_spec,video_data,message}'is not null then result:=jsonb_set(result,'{payload,object_story_spec,video_data,message}',p_plan->'challengerPrimary');end if;
 elsif result->>'format'='video_story'then result:=jsonb_set(result,'{payload,object_story_spec,video_data,message}',p_plan->'challengerPrimary');end if;
 if p_plan ? 'ownerReview' then
  if p_plan->>'purpose' is distinct from 'formal_experiment' or result->>'format' is distinct from 'video_story'
   or jsonb_array_length(edit->'media') is distinct from 2 then raise exception 'Reviewed retained projection differs';end if;
  media:=edit->'media';
  for v in select value from jsonb_array_elements(result#>'{payload,media_sourcing_spec,videos}')loop
   select value->'video' into target from jsonb_array_elements(media)where value->>'sourceVideo'=v->>'video_id';
   if target is null then raise exception 'Reviewed retained media differs';end if;
   videos:=videos||jsonb_build_array(jsonb_set(v,'{video_id}',target));
  end loop;
  if jsonb_array_length(videos)<>2 then raise exception 'Reviewed retained media count differs';end if;
  source:=result#>>'{payload,object_story_spec,video_data,video_id}';
  select value->'video' into target from jsonb_array_elements(media)where value->>'sourceVideo'=source;
  if target is null then raise exception 'Reviewed retained story differs';end if;
  result:=jsonb_set(jsonb_set(jsonb_set(result,'{payload,media_sourcing_spec,videos}',videos),'{payload,object_story_spec,video_data,video_id}',target),
   '{payload,object_story_spec,video_data,title}',edit->'headline');
  result:=result#-'{payload,object_story_spec,video_data,image_url}'#-'{payload,object_story_spec,video_data,image_hash}';
  if edit#>>'{thumbnail,kind}' not in('image_hash','image_url')then raise exception 'Reviewed retained thumbnail differs';end if;
  result:=jsonb_set(result,array['payload','object_story_spec','video_data',edit#>>'{thumbnail,kind}'],edit#>'{thumbnail,value}');
  for v in select value from jsonb_array_elements(media)loop
   if jsonb_path_exists(result->'payload','$.** ? (@ == $source)',jsonb_build_object('source',v->'sourceVideo'))then
    raise exception 'Unsupported retained source reference';end if;
  end loop;
 end if;
 return result;
end$$;
commit;
