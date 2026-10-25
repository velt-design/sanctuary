-- Extend only the existing paused proof. No object, control, history, ACL or
-- dispatch state is changed by installation. Formal creation remains unchanged.
begin;
do $migration$
declare d text; old_text text; new_text text;
begin
 d:=pg_get_functiondef('public.meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb)'::regprocedure);
 old_text:='if p_stage=''prepare'' then';
 new_text:=$patch$if p_stage='prepare' then
  if p_payload#>>'{plan,control,format}'='native_reference' and
   (p_payload#>>'{plan,purpose}' is distinct from 'paused_capability'
    or p_payload#>>'{plan,control,sourceAd}' is distinct from p_payload#>>'{plan,controlAd}'
    or not coalesce(c.original_ads ? (p_payload#>>'{plan,controlAd}'),false)
    or p_payload#>'{plan,retainedBaseline}' is not null
    or coalesce(p_payload#>>'{plan,control,id}','') !~ '^[1-9][0-9]{0,19}$'
    or coalesce(p_payload#>>'{plan,control,snapshotHash}','') !~ '^[a-f0-9]{64}$') then
   raise exception 'Native copy is paused original-reference proof only';end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Native copy prepare predecessor differs';end if;
 d:=replace(d,old_text,new_text);
 old_text:='if p_stage=''admit'' then';
 new_text:=$patch$if p_stage='admit' then
  if x.plan#>>'{control,format}'='native_reference' then
   if x.plan->>'purpose' is distinct from 'paused_capability'
    or (p_payload#>>'{intent,kind}'='create_control' and
      (p_payload#>>'{intent,path}' is distinct from (x.plan->>'controlAd')||'/copies'
       or p_payload#>'{intent,body}' is distinct from jsonb_build_object('adset_id',x.plan#>>'{scope,adset}','status_option','PAUSED')
       or p_payload#>'{intent,target}' is distinct from 'null'::jsonb
       or p_payload->'cleanup' is distinct from 'false'::jsonb))
    or (p_payload#>>'{intent,kind}'='pause_control' and
      (p_payload#>'{intent,body}' is distinct from jsonb_build_object('status','PAUSED')
       or p_payload#>>'{intent,path}' is distinct from p_payload#>>'{intent,target}'
       or p_payload->'cleanup' is distinct from 'true'::jsonb))
    or coalesce(p_payload#>>'{intent,kind}','') not in('create_control','pause_control') then
    raise exception 'Native copy effect differs';end if;
  end if;$patch$;
 if strpos(d,old_text)=0 then raise exception 'Native copy effect predecessor differs';end if;
 d:=replace(d,old_text,new_text);
 old_text:=$patch$if not exists(select 1 from public.meta_creative_effects where experiment=p_experiment and kind='create_creative' and state='confirmed') or$patch$;
 new_text:=$patch$if (case when x.plan#>>'{control,format}'='native_reference' then
    x.plan->>'purpose' is distinct from 'paused_capability'
    or not exists(select 1 from public.meta_creative_effects copy_effect
      join public.meta_creative_execution_intents copy_intent on copy_intent.command=copy_effect.command
      join public.meta_creative_objects copy_object on copy_object.created_by=copy_effect.command and copy_object.object_id=copy_effect.object_id and copy_object.kind='ad'
      where copy_effect.experiment=p_experiment and copy_effect.kind='create_paused_ad' and copy_effect.state='confirmed' and copy_intent.kind='create_control'
       and p_payload->'nativeCopy'=jsonb_build_object('sourceAd',x.plan->>'controlAd','creative',x.plan#>>'{control,id}',
         'ad',copy_effect.object_id,'requestHash',copy_effect.request_hash,'readbackHash',copy_effect.evidence_hash))
    or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and kind='create_creative')
   else p_payload ? 'nativeCopy' or not exists(select 1 from public.meta_creative_effects where experiment=p_experiment and kind='create_creative' and state='confirmed') end) or$patch$;
 if strpos(d,old_text)=0 then raise exception 'Native copy canary predecessor differs';end if;
 d:=replace(d,old_text,new_text);
 execute d;
end$migration$;
commit;
