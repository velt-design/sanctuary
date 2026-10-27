begin;
select pg_advisory_xact_lock(819421,1);
-- Same existing maxima, limited to a root-pending-reviewed paused normalization.
create function public.meta_creative_pending_normalization(p_plan jsonb,p_review jsonb)
returns boolean language sql stable set search_path='' as $$
 select coalesce(p_plan->>'purpose'='paused_capability'
  and p_plan#>>'{control,format}'='video_story'
  and p_plan#>>'{capabilityReview,kind}'='owner_directed_paused_normalization_v1'
  and p_review->'plan'='null'::jsonb and p_review->'planHash'='null'::jsonb
  and (p_review->>'expiresAt')::timestamptz>statement_timestamp()
  and p_plan#>'{capabilityReview,proposal}'=p_review->'proposal'
  and p_plan->'scope'=p_review#>'{proposal,scope}'
  and p_plan->'originalAds'=p_review#>'{proposal,originalAds}'
  and p_plan->>'controlAd'=p_review#>>'{proposal,controlAd}'
  and p_plan#>>'{control,id}'=p_review#>>'{proposal,controlCreative}',false)
$$;
revoke all on function public.meta_creative_pending_normalization(jsonb,jsonb) from public,anon,authenticated,service_role;
do $paused_bounds$
declare d text;name text;old_text text;new_text text;constraint_name text;n integer;
begin
 select count(*),min(conname::text) into n,constraint_name from pg_constraint
  where conrelid='public.meta_creative_execution'::regclass and contype='c'
   and pg_get_constraintdef(oid) like '%octet_length%plan%16000%8000%';
 if n<>1 then raise exception 'Paused capacity constraint predecessor differs';end if;
 execute format('alter table public.meta_creative_execution drop constraint %I',constraint_name);
 execute format('alter table public.meta_creative_execution add constraint %I CHECK (octet_length(plan::text)<=CASE WHEN (plan->>''purpose''=''formal_experiment'' AND plan#>>''{ownerReview,kind}''=''owner_directed_independent_review_v1'') OR (plan->>''purpose''=''paused_capability'' AND plan#>>''{capabilityReview,kind}''=''owner_directed_paused_normalization_v1'') THEN 16000 ELSE 8000 END)',constraint_name);
 d:=pg_get_functiondef('public.meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb)'::regprocedure);
 old_text:='then 20000 else 14000 end)';
 new_text:='or (p_stage=''prepare'' and public.meta_creative_pending_normalization(p_payload->''plan'',c.owner_proposal)) or (p_stage=''admit'' and p_payload#>>''{intent,kind}''=''create_creative'' and exists(select 1 from public.meta_creative_execution normalized_execution where normalized_execution.experiment=p_experiment and public.meta_creative_pending_normalization(normalized_execution.plan,c.owner_proposal))) then 20000 else 14000 end)';
 if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Paused payload capacity predecessor differs';end if;d:=replace(d,old_text,new_text);
 old_text:='then 16000 else 8000 end)';
 new_text:='or public.meta_creative_pending_normalization(payload,c.owner_proposal) then 16000 else 8000 end)';
 if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>2 then raise exception 'Paused plan/intent capacity predecessor differs';end if;
 -- Plan payload and admitted intent have different immutable owners.
 old_text:='and c.owner_proposal->''plan''=payload then 16000 else 8000 end)';
 new_text:='and c.owner_proposal->''plan''=payload or public.meta_creative_pending_normalization(payload,c.owner_proposal) then 16000 else 8000 end)';
 if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Paused plan capacity patch differs';end if;d:=replace(d,old_text,new_text);
 old_text:='and c.owner_proposal->''plan''=x.plan then 16000 else 8000 end)';
 new_text:='and c.owner_proposal->''plan''=x.plan or (v_kind=''create_creative'' and public.meta_creative_pending_normalization(x.plan,c.owner_proposal)) then 16000 else 8000 end)';
 if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Paused intent capacity patch differs';end if;d:=replace(d,old_text,new_text);
 execute d;
 for name in select unnest(array['meta_creative_executor_without_ambiguity','meta_creative_executor_without_retention'])loop
  d:=pg_get_functiondef(('public.'||name||'(text,uuid,uuid,text,jsonb)')::regprocedure);
  old_text:='then 20000 else 14000 end)';
  new_text:='or (p_stage=''prepare'' and public.meta_creative_pending_normalization(p_payload->''plan'',c.owner_proposal)) or (p_stage=''admit'' and p_payload#>>''{intent,kind}''=''create_creative'' and exists(select 1 from public.meta_creative_execution normalized_execution where normalized_execution.experiment=p_experiment and public.meta_creative_pending_normalization(normalized_execution.plan,c.owner_proposal))) then 20000 else 14000 end)';
  if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Paused outer capacity predecessor differs';end if;
  execute replace(d,old_text,new_text);
 end loop;
end$paused_bounds$;
-- Reuse genuinely created, registered and cleaned-up PAUSED proof objects.
-- A capability baseline is neither a retained winner nor a new provider effect.
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)
 rename to meta_creative_executor_without_capability_baseline;
revoke all on function public.meta_creative_executor_without_capability_baseline(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; x public.meta_creative_execution; c public.meta_creative_control;
begin
 perform pg_advisory_xact_lock(819421,1);
 if p_stage='prepare' and p_payload#>'{plan,capabilityReview}' is not null then
  select * into c from public.meta_creative_control where singleton for update;
  if c.binding is distinct from p_binding or not public.meta_creative_pending_normalization(p_payload->'plan',c.owner_proposal) then raise exception 'Current pending normalization review differs';end if;
 end if;
 if p_stage='prepare' and p_payload#>'{plan,capabilityBaseline}' is not null then
  b:=p_payload#>'{plan,capabilityBaseline}';
  select * into c from public.meta_creative_control where singleton for update;
  if c.binding is distinct from p_binding or p_payload#>>'{plan,purpose}' is distinct from 'formal_experiment'
   or p_payload#>'{plan,ownerReview}' is null or p_payload#>'{plan,retainedBaseline}' is not null
   or jsonb_typeof(b) is distinct from 'object' or coalesce(b->>'experiment','') !~ '^[a-f0-9-]{36}$'
   then raise exception 'Capability baseline scope differs';end if;
  select * into x from public.meta_creative_execution where experiment=(b->>'experiment')::uuid;
  if x.experiment is null or x.experiment=p_experiment or x.plan->>'purpose' is distinct from 'paused_capability'
   or x.plan#>>'{control,format}' is distinct from 'video_story'
   or x.plan->'scope' is distinct from c.scope or x.plan->'originalAds' is distinct from c.original_ads
   or x.plan->>'nativeContractHash' is distinct from c.native_contract_hash
   or b->>'planHash' is distinct from x.plan_hash
   or b->>'donor' is distinct from x.plan->>'controlAd'
   or b->>'donor' is distinct from p_payload#>>'{plan,controlAd}'
   or b->>'sourceCreative' is distinct from x.plan#>>'{control,id}'
   or b->>'creative' is distinct from p_payload#>>'{plan,control,id}'
   or b->>'creative'=b->>'sourceCreative'
   or x.plan->'adSettings' is distinct from p_payload#>'{plan,adSettings}'
   or exists(select 1 from public.acquisition_experiment_reservation where experiment=x.experiment)
   or not exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='canary')
   or not exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='cleanup')
   or exists(select 1 from public.meta_creative_effects where experiment=x.experiment and state in('prepared','uncertain'))
   then raise exception 'Closed capability baseline differs';end if;
  if not exists(select 1 from public.meta_creative_effects e join public.meta_creative_execution_intents i on i.command=e.command
    where e.experiment=x.experiment and e.kind='create_creative' and i.kind='create_creative' and e.state='confirmed'
     and i.intent->>'requestHash'=e.request_hash and e.object_id=b->>'creative' and e.evidence_hash=b->>'evidenceHash')
   or not exists(select 1 from public.meta_creative_effects e join public.meta_creative_objects o on o.created_by=e.command
    join public.meta_creative_execution_intents i on i.command=e.command
    where e.experiment=x.experiment and e.kind='create_paused_ad' and e.state='confirmed' and i.kind='create_control'
     and i.intent->>'requestHash'=e.request_hash and i.intent#>>'{body,creative}' is not null
     and (i.intent#>>'{body,creative}')::jsonb=jsonb_build_object('creative_id',b->>'creative')
     and e.object_id=b->>'ad' and o.object_id=e.object_id and o.kind='ad' and o.experiment=x.experiment)
   or not exists(select 1 from public.meta_creative_effects e where e.experiment=x.experiment and e.kind='pause_ad'
    and e.state='confirmed' and e.target=b->>'ad' and e.object_id=e.target)
   or c.original_ads ? (b->>'ad') or c.original_ads ? (b->>'creative')
   or b is distinct from jsonb_build_object('experiment',x.experiment,'planHash',x.plan_hash,'donor',x.plan->>'controlAd',
    'sourceCreative',x.plan#>>'{control,id}','ad',b->>'ad','creative',b->>'creative','evidenceHash',b->>'evidenceHash')
   then raise exception 'Registered capability baseline proof differs';end if;
 end if;
 if p_stage in('admit','check') then
  select * into x from public.meta_creative_execution where experiment=p_experiment;
  if x.plan ? 'capabilityReview' and not (p_stage='admit' and p_payload->'cleanup'='true'::jsonb)
   and not (p_stage='check' and exists(select 1 from public.meta_creative_effects where command=p_command and experiment=p_experiment and terminal_cleanup)) then
   select * into c from public.meta_creative_control where singleton for update;
   if not public.meta_creative_pending_normalization(x.plan,c.owner_proposal) then raise exception 'Pending normalization review revoked';end if;
  end if;
 end if;
 return public.meta_creative_executor_without_capability_baseline(p_binding,p_command,p_experiment,p_stage,p_payload);
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
