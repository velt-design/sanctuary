-- Complete root-reviewed donor metadata needs a finite owner-only capacity.
-- Existing model/native-reference limits, ACLs, identities and history remain.
begin;
select pg_advisory_xact_lock(819421,1);
do $owner_bounds$
declare d text;n int;c record;actual_name text;old_text text;new_text text;
begin
 select pg_get_functiondef('public.meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb)'::regprocedure)into d;
 if md5(d)<>'13ba9066a6a7cb11ce68f79b80da3754' then raise exception 'Creative capacity predecessor differs';end if;
 select count(*),min(conname::text)into n,actual_name from pg_constraint where conrelid='public.meta_creative_execution'::regclass and contype='c' and pg_get_constraintdef(oid)=$before$CHECK ((octet_length((plan)::text) <= 8000))$before$;
 if n<>1 then raise exception 'Creative capacity constraint differs';end if;
 execute format('alter table public.meta_creative_execution drop constraint %I',actual_name);
 execute format('alter table public.meta_creative_execution add constraint %I CHECK (octet_length(plan::text) <= CASE WHEN plan->>''purpose''=''formal_experiment'' AND plan#>>''{ownerReview,kind}''=''owner_directed_independent_review_v1'' THEN 16000 ELSE 8000 END)',actual_name);
 select count(*),min(conname::text)into n,actual_name from pg_constraint where conrelid='public.meta_creative_execution_intents'::regclass and contype='c' and pg_get_constraintdef(oid)=$before$CHECK ((octet_length((intent)::text) <= 8000))$before$;
 if n<>1 then raise exception 'Creative capacity constraint differs';end if;
 execute format('alter table public.meta_creative_execution_intents drop constraint %I',actual_name);
 execute format('alter table public.meta_creative_execution_intents add constraint %I CHECK (octet_length(intent::text) <= 16000)',actual_name);
 select count(*),min(conname::text)into n,actual_name from pg_constraint where conrelid='public.meta_creative_control'::regclass and contype='c' and pg_get_constraintdef(oid)=$before$CHECK (((owner_proposal IS NULL) OR ((jsonb_typeof(owner_proposal) = 'object'::text) AND (octet_length((owner_proposal)::text) <= 12000) AND (owner_proposal ?& ARRAY['version'::text, 'proposal'::text, 'plan'::text, 'planHash'::text, 'expiresAt'::text]) AND ((((((owner_proposal - 'version'::text) - 'proposal'::text) - 'plan'::text) - 'planHash'::text) - 'expiresAt'::text) = '{}'::jsonb) AND ((owner_proposal ->> 'version'::text) = '1'::text) AND (jsonb_typeof((owner_proposal -> 'proposal'::text)) = 'object'::text) AND (COALESCE((owner_proposal ->> 'expiresAt'::text), ''::text) ~ '^\d{4}-\d{2}-\d{2}T'::text) AND ((((owner_proposal -> 'plan'::text) = 'null'::jsonb) AND ((owner_proposal -> 'planHash'::text) = 'null'::jsonb)) OR ((jsonb_typeof((owner_proposal -> 'plan'::text)) = 'object'::text) AND (octet_length(((owner_proposal -> 'plan'::text))::text) <= 8000) AND (COALESCE((owner_proposal ->> 'planHash'::text), ''::text) ~ '^[a-f0-9]{64}$'::text) AND ((owner_proposal #>> '{plan,purpose}'::text[]) = 'formal_experiment'::text) AND ((owner_proposal #>> '{plan,ownerReview,kind}'::text[]) = 'owner_directed_independent_review_v1'::text))))))$before$;
 if n<>1 then raise exception 'Creative capacity constraint differs';end if;
 execute format('alter table public.meta_creative_control drop constraint %I',actual_name);
 execute format('alter table public.meta_creative_control add constraint %I CHECK (((owner_proposal IS NULL) OR ((jsonb_typeof(owner_proposal) = ''object''::text) AND (octet_length((owner_proposal)::text) <= 20000) AND (owner_proposal ?& ARRAY[''version''::text, ''proposal''::text, ''plan''::text, ''planHash''::text, ''expiresAt''::text]) AND ((((((owner_proposal - ''version''::text) - ''proposal''::text) - ''plan''::text) - ''planHash''::text) - ''expiresAt''::text) = ''{}''::jsonb) AND ((owner_proposal ->> ''version''::text) = ''1''::text) AND (jsonb_typeof((owner_proposal -> ''proposal''::text)) = ''object''::text) AND (COALESCE((owner_proposal ->> ''expiresAt''::text), ''''::text) ~ ''^\d{4}-\d{2}-\d{2}T''::text) AND ((((owner_proposal -> ''plan''::text) = ''null''::jsonb) AND ((owner_proposal -> ''planHash''::text) = ''null''::jsonb)) OR ((jsonb_typeof((owner_proposal -> ''plan''::text)) = ''object''::text) AND (octet_length(((owner_proposal -> ''plan''::text))::text) <= 16000) AND (COALESCE((owner_proposal ->> ''planHash''::text), ''''::text) ~ ''^[a-f0-9]{64}$''::text) AND ((owner_proposal #>> ''{plan,purpose}''::text[]) = ''formal_experiment''::text) AND ((owner_proposal #>> ''{plan,ownerReview,kind}''::text[]) = ''owner_directed_independent_review_v1''::text))))))',actual_name);
 old_text:=$old$octet_length(p_payload::text)>14000$old$;new_text:=$new$octet_length(p_payload::text)>(case when c.owner_proposal#>>'{plan,ownerReview,kind}'='owner_directed_independent_review_v1' and c.owner_proposal#>>'{plan,experiment}'=p_experiment::text and ((p_stage='prepare' and c.owner_proposal->'plan'=p_payload->'plan') or(p_stage='admit' and p_payload#>>'{intent,kind}'='create_creative'))then 20000 else 14000 end)$new$;
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Creative capacity patch differs';end if;
 d:=replace(d,old_text,new_text);
 old_text:=$old$octet_length(payload::text)>8000$old$;new_text:=$new$octet_length(payload::text)>(case when payload->>'purpose'='formal_experiment' and payload#>>'{ownerReview,kind}'='owner_directed_independent_review_v1' and c.owner_proposal->'plan'=payload then 16000 else 8000 end)$new$;
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Creative capacity patch differs';end if;
 d:=replace(d,old_text,new_text);
 old_text:=$old$  select * into i from public.meta_creative_execution_intents where command=p_command;$old$;new_text:=$new$  if octet_length(payload::text)>(case when v_kind='create_creative' and x.plan#>>'{ownerReview,kind}'='owner_directed_independent_review_v1' and c.owner_proposal->'plan'=x.plan then 16000 else 8000 end) then raise exception 'Creative intent capacity differs';end if;
  select * into i from public.meta_creative_execution_intents where command=p_command;$new$;
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Creative capacity patch differs';end if;
 d:=replace(d,old_text,new_text);
 execute d;
end$owner_bounds$;
-- These are the current names of the learning and retained-baseline wrappers.
-- Preserve their checks/delegation; exempt only the size predicate for the
-- current exact root owner plan, never a caller-supplied ownerReview marker.
do $owner_outer_bounds$
declare d text;signature text;prior text;old_text text:='octet_length(p_payload::text)>14000';new_text text;
begin
 new_text:=$patch$octet_length(p_payload::text)>(case when c.owner_proposal#>>'{plan,ownerReview,kind}'='owner_directed_independent_review_v1'
  and c.owner_proposal#>>'{plan,purpose}'='formal_experiment'and c.owner_proposal#>>'{plan,experiment}'=p_experiment::text
  and(c.owner_proposal->>'expiresAt')::timestamptz>clock_timestamp()
  and((p_stage='prepare'and c.owner_proposal->'plan'=p_payload->'plan'and c.owner_proposal->>'planHash'=p_payload->>'planHash')
   or(p_stage='admit'and p_payload#>>'{intent,kind}'='create_creative'and exists(select 1 from public.meta_creative_execution owner_capacity_execution where owner_capacity_execution.experiment=p_experiment and owner_capacity_execution.plan=c.owner_proposal->'plan'and owner_capacity_execution.plan_hash=c.owner_proposal->>'planHash')))
  then 20000 else 14000 end)$patch$;
 for signature,prior in select * from(values
  ('public.meta_creative_executor_without_ambiguity(text,uuid,uuid,text,jsonb)','9364d536b3b6a2c2a19c1ad1d7a889e4'),
  ('public.meta_creative_executor_without_retention(text,uuid,uuid,text,jsonb)','a690a5eecbdde434de3dd639903e0221'))v(signature,prior)loop
  d:=pg_get_functiondef(signature::regprocedure);
  if md5(d)<>prior then raise exception 'Owner outer capacity predecessor differs';end if;
  if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Owner outer capacity patch differs';end if;
  execute replace(d,old_text,new_text);
 end loop;
end$owner_outer_bounds$;
-- Same complete owner-copy projection in application and native retention.
do $owner_mirrors$
declare d text;old_text text;new_text text;
begin
 d:=pg_get_functiondef('public.meta_creative_winning_control(jsonb,text)'::regprocedure);
 if md5(d)<>'de931b266c4edd73c30eb2ad7f5c0327'then raise exception 'Owner mirror predecessor differs';end if;
 old_text:=$old$source text;$old$;new_text:=$new$source text;k text;entries jsonb;expected jsonb;$new$;
 if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Owner mirror patch differs';end if;d:=replace(d,old_text,new_text);
 old_text:=$old$  media:=edit->'media';$old$;new_text:=$new$  for k in select unnest(array['bodies','titles'])loop
   entries:=p_plan#>array['control','payload','media_sourcing_spec',k];
   if entries is not null then
    expected:=case when k='bodies'then p_plan#>'{control,payload,object_story_spec,video_data,message}'else p_plan#>'{control,payload,object_story_spec,video_data,title}'end;
    if jsonb_typeof(entries)is distinct from'array'or jsonb_array_length(entries)<>1 or entries->0 is distinct from jsonb_build_object('text',expected)then raise exception 'Reviewed source copy mirror differs';end if;
    result:=jsonb_set(result,array['payload','media_sourcing_spec',k],jsonb_build_array(jsonb_build_object('text',case when k='bodies'then p_plan->'challengerPrimary'else edit->'headline'end)));
   end if;
  end loop;
  media:=edit->'media';$new$;
 if(length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'Owner mirror patch differs';end if;d:=replace(d,old_text,new_text);execute d;
end$owner_mirrors$;
commit;
