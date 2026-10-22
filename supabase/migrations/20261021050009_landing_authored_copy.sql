begin;
-- Plain authored CTA/support copy on existing surfaces. All assignment, consent,
-- windows, genuine-intake joins, single reservation and rollback remain unchanged.
create function public.landing_copy_slot(p_copy text) returns text language plpgsql immutable set search_path='' as $$
declare parts text[]; words text[]; t text;
begin
 if p_copy in('explore','project','estimate','action-first') then return case p_copy when 'explore' then 'design' when 'project' then 'help' when 'estimate' then 'support' else 'layout' end;end if;
 parts:=regexp_match(p_copy,'^copy:(design|help|support):([A-Za-z][A-Za-z ,.?!]*)$');
 if parts is null then return null;end if;t:=parts[2];
 if length(t)<4 or length(t)>(case when parts[1]='support' then 112 else 48 end) or t<>btrim(t) or t~'  |[,.?!]{2}' then return null;end if;
 words:=array_remove(regexp_split_to_array(lower(t),'[ ,.?!]+'),'');
 if cardinality(words)<2 or cardinality(words)>20 or not words<@string_to_array('a an and around choose covered deck design designed details estimate explore for get help home in installed living next of on outdoor pergola plan planning project residential roof see size space start step tell the to us with your',' ') then return null;end if;
 return parts[1];
end $$;
create function public.landing_copy_text(p_copy text) returns text language sql immutable set search_path='' as $$
 select case when public.landing_copy_slot(p_copy) is null then null when p_copy like 'copy:%' then substring(p_copy from '^copy:[^:]+:(.*)$') else case p_copy when 'explore' then 'Explore your pergola' when 'project' then 'Tell us about your project' when 'estimate' then 'Choose a size and roof. See an installed estimate.' else 'Hero action group before support on mobile' end end
$$;
create function public.landing_original_text(p_path text,p_slot text) returns text language sql immutable set search_path='' as $$
 select case p_slot when 'design' then 'Design your pergola' when 'help' then 'Tell us about your space' when 'layout' then 'Hero action group after support' when 'support' then case p_path when '/auckland-outdoor-living' then E'A place for slow mornings. Long lunches.\nAnd a little more everyday living.' when '/acrylic-roof-pergolas-auckland' then E'A covered space, with daylight above.\nDesigned around the home you love.' end end
$$;
-- Compare rendered slot/text, not the spelling of a finite/authored key. Keep
-- immutable original copy/control values in experiments and receipts untouched.
create function public.landing_copy_identity(p_copy text) returns text language sql immutable set search_path='' as $$
 select coalesce((select k from unnest(array['explore','project','estimate','action-first']) k
   where public.landing_copy_slot(k)=public.landing_copy_slot(p_copy) and public.landing_copy_text(k)=public.landing_copy_text(p_copy)),p_copy)
 where public.landing_copy_slot(p_copy) is not null
$$;
create function public.landing_control_identity(p_path text,p_control jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_object_agg(slot,coalesce(public.landing_copy_text(p_control->>slot),public.landing_original_text(p_path,slot)))
 from unnest(array['design','help','support','layout']) slot
$$;

create function public.landing_copy_map_valid(p_value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(p_value) is distinct from 'object' then return false;end if;
 return not exists(select 1 from jsonb_each(p_value) x where jsonb_typeof(x.value)<>'string' or public.landing_copy_slot(x.value#>>'{}') is distinct from x.key);
end $$;
-- A bounded unsuccessful exploration guard for one unchanged control/template.
-- Retaining a genuinely different baseline starts a distinct comparison domain.
create function public.landing_authored_available(p_path text,p_template text,p_control jsonb) returns boolean language sql stable set search_path='' as $$
 select count(distinct public.landing_copy_identity(copy))<32 from public.landing_experiments where path=p_path and template=p_template
   and public.landing_control_identity(path,control_copy)=public.landing_control_identity(p_path,p_control) and copy like 'copy:%' and state in('rejected','reverted','inconclusive')
$$;
revoke all on function public.landing_copy_slot(text),public.landing_copy_text(text),public.landing_original_text(text,text),public.landing_copy_identity(text),public.landing_control_identity(text,jsonb),public.landing_copy_map_valid(jsonb),public.landing_authored_available(text,text,jsonb) from public,anon,authenticated,service_role;

-- Replace only the exact original finite-copy constraints, retaining every
-- independent path/lane/state/consent/window and attribution constraint.
do $$declare row record; removed integer:=0;begin
 for row in select conname,conrelid::regclass as relation from pg_constraint where conrelid in('public.landing_experiment_control'::regclass,'public.landing_experiments'::regclass) and contype='c' and (pg_get_constraintdef(oid) like '%control_outdoor <@%' or pg_get_constraintdef(oid) like '%control_acrylic <@%' or pg_get_constraintdef(oid) like '%control_copy <@%' or pg_get_constraintdef(oid) like '%copy = ANY%') loop
  execute format('alter table %s drop constraint %I',row.relation,row.conname);removed:=removed+1;
 end loop;
 if removed<>4 then raise exception 'Copy constraint baseline differs';end if;
end $$;
alter table public.landing_experiment_control add constraint landing_control_outdoor_authored check(public.landing_copy_map_valid(control_outdoor) and not(control_outdoor?'layout')),add constraint landing_control_acrylic_authored check(public.landing_copy_map_valid(control_acrylic));
alter table public.landing_experiments add constraint landing_copy_authored check(public.landing_copy_slot(copy) is not null),add constraint landing_control_copy_authored check(public.landing_copy_map_valid(control_copy));

-- Patch only copy semantics. Retain any installed finite recovery/technical
-- continuation, probe expiry and per-command replay protections unchanged.
do $authored$ declare f text;n text;begin
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 n:=$before$'controls',jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic)$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 1 differs';end if;
 f:=replace(f,n,$after$'authoredCopy',jsonb_build_object('/auckland-outdoor-living',public.landing_authored_available('/auckland-outdoor-living',c.template,c.control_outdoor),'/acrylic-roof-pergolas-auckland',public.landing_authored_available('/acrylic-roof-pergolas-auckland',c.template,c.control_acrylic)),
     'controls',jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic)$after$);
 n:=$before$select distinct copy from public.landing_experiments where path=$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>2 then raise exception 'Authored copy anchor 2 differs';end if;
 f:=replace(f,n,$after$select distinct public.landing_copy_identity(copy) as copy from public.landing_experiments where path=$after$);
 n:=$before$control_copy=c.control_outdoor$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 3 differs';end if;
 f:=replace(f,n,$after$public.landing_control_identity(path,control_copy)=public.landing_control_identity(path,c.control_outdoor)$after$);
 n:=$before$control_copy=c.control_acrylic$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 4 differs';end if;
 f:=replace(f,n,$after$public.landing_control_identity(path,control_copy)=public.landing_control_identity(path,c.control_acrylic)$after$);
 n:=$before$selected_slot:=case p_payload->>'copy' when 'explore' then 'design' when 'project' then 'help' when 'estimate' then 'support' when 'action-first' then 'layout' end;$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 5 differs';end if;
 f:=replace(f,n,$after$selected_slot:=public.landing_copy_slot(p_payload->>'copy');$after$);
 n:=$before$then raise exception 'Unchanged candidate';end if;$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 6 differs';end if;
 f:=replace(f,n,$after$then raise exception 'Unchanged candidate';end if;
   if p_payload->>'copy' like 'copy:%' and not public.landing_authored_available(p_payload->>'path',c.template,previous_copy) then raise exception 'Authored exploration exhausted';end if;
   if public.landing_copy_text(p_payload->>'copy')=coalesce(public.landing_copy_text(previous_copy->>selected_slot),public.landing_original_text(p_payload->>'path',selected_slot)) then raise exception 'Unchanged text';end if;$after$);
 n:=$before$prior.control_copy=previous_copy$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 7 differs';end if;
 f:=replace(f,n,$after$public.landing_control_identity(prior.path,prior.control_copy)=public.landing_control_identity(prior.path,previous_copy)$after$);
 n:=$before$prior.copy=p_payload->>'copy'$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>1 then raise exception 'Authored copy anchor 8 differs';end if;
 f:=replace(f,n,$after$public.landing_copy_identity(prior.copy)=public.landing_copy_identity(p_payload->>'copy')$after$);
 n:=$before$selected_slot:=case e.copy when 'explore' then 'design' when 'project' then 'help' when 'action-first' then 'layout' else 'support' end;$before$;
 if (length(f)-length(replace(f,n,'')))/length(n)<>2 then raise exception 'Authored copy anchor 9 differs';end if;
 f:=replace(f,n,$after$selected_slot:=public.landing_copy_slot(e.copy);$after$);
 execute f;
end$authored$;
create or replace function public.landing_experiment_visit_without_creative(p_stage text,p_id uuid,p_path text,p_template text,p_ad text default null,p_campaign text default null,p_adset text default null,p_display jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.landing_experiment_control; e public.landing_experiments; a public.landing_experiment_assignments; stamp timestamptz:=clock_timestamp();
begin
 if p_stage not in('assign','expose','revoke') or p_id is null or p_path not in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then raise exception 'Invalid visit';end if;
 select * into c from public.landing_experiment_control where singleton;
 if p_stage='revoke' then update public.landing_experiment_assignments set revoked_at=coalesce(revoked_at,stamp) where id=p_id;return '{}';end if;
 if not found or not c.enabled or not c.publishing or c.admitted_until<=stamp then return null;end if;
 -- Current server-owned bundle identity is never accepted from visitor JSON.
 -- A new unreviewed template receives original copy and no exposure credit.
 if p_template is distinct from c.template then return jsonb_build_object('control','{}'::jsonb);end if;
 if p_stage='assign' and (p_campaign is distinct from c.campaign or p_adset is distinct from c.adset or not(p_ad=any(c.ads))) then return null;end if;
 select * into a from public.landing_experiment_assignments where id=p_id and revoked_at is null;
 select * into e from public.landing_experiments x where public.landing_experiment_eligible(c,x,p_path,p_template,x.id=a.experiment);
 if not found then return jsonb_build_object('control',case when p_path='/auckland-outdoor-living' then c.control_outdoor else c.control_acrylic end);end if;
 if p_stage='assign' then
   if exists(select 1 from public.landing_experiment_assignments where id=p_id and experiment<>e.id) then p_id:=gen_random_uuid();end if;
   insert into public.landing_experiment_assignments(id,experiment,arm,ad)
   values(p_id,e.id,case when get_byte(uuid_send(p_id),0)<128 then 'control' else 'challenger' end,p_ad) on conflict(id) do nothing;
 end if;
 select * into a from public.landing_experiment_assignments where id=p_id and experiment=e.id and revoked_at is null;
 if not found then return null;end if;
 if p_stage='expose' then
   if p_display is not null and (jsonb_typeof(p_display)<>'object' or (select count(*) from jsonb_object_keys(p_display))<>2 or jsonb_typeof(p_display->'mobile') is distinct from 'boolean' or jsonb_typeof(p_display->'actionFirst') is distinct from 'boolean') then raise exception 'Invalid display receipt';end if;
   if (p_display->>'actionFirst')::boolean and (not (p_display->>'mobile')::boolean or e.path<>'/acrylic-roof-pergolas-auckland' or not(coalesce(e.control_copy->>'layout'='action-first',false) or(a.arm='challenger' and e.copy='action-first'))) then raise exception 'Invalid treatment receipt';end if;
   update public.landing_experiment_assignments set exposed_at=coalesce(exposed_at,stamp),mobile=case when exposed_at is null then (p_display->>'mobile')::boolean else mobile end,
     action_first=case when exposed_at is null then (p_display->>'actionFirst')::boolean else action_first end where id=p_id;
 end if;
 return jsonb_build_object('experiment',e.id,'assignment',a.id,'path',e.path,'arm',a.arm,'copies',case when a.arm='control' then e.control_copy
   else e.control_copy||jsonb_build_object(public.landing_copy_slot(e.copy),e.copy) end);
end $$;
create or replace function public.landing_experiment_probe_visit(p_probe uuid,p_stage text,p_path text,p_template text,p_generation bigint,p_candidate text,p_mode text,p_cookie boolean,p_ad text default null,p_campaign text default null,p_adset text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.landing_experiment_control;e public.landing_experiments;p public.landing_experiment_probes;stamp timestamptz:=clock_timestamp();begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.landing_experiment_control where singleton for update;
 select * into p from public.landing_experiment_probes where id=p_probe for update;
 select * into e from public.landing_experiments where id=p.experiment;
 if p.id is null or p_stage not in('assign','expose') or not c.enabled or c.admitted_until<=stamp or p.expires_at<=stamp or p.verified_at is not null
 or p.generation<>c.generation or p_generation<>c.generation or p.template<>c.template or p_template<>c.template or e.template<>c.template
 or p_candidate<>e.candidate_hash or p.candidate_hash<>e.candidate_hash or p.mode<>p_mode or e.path<>p_path then raise exception 'Diagnostic unavailable';end if;
 if p.mode='live' and not public.landing_experiment_eligible(c,e,p_path,p_template,p.enrolled_at<e.ends_at) then raise exception 'Normal serving unavailable';end if;
 if p.mode='prepare' and e.state not in('candidate','reviewed') then raise exception 'Preparation changed';end if;
 if p_stage='assign' then
   if p_campaign is distinct from c.campaign or p_adset is distinct from c.adset or not(p_ad=any(c.ads)) or p_ad is null or p.assignments>=(case when p.mode='prepare' then 6 else 2 end)
     or(p.assignments>0 and not p_cookie) then raise exception 'Diagnostic assignment unavailable';end if;
   update public.landing_experiment_probes set assignments=assignments+1,reloads=reloads+case when p_cookie then 1 else 0 end,enrolled_at=case when p.mode='live' then coalesce(enrolled_at,stamp) else null end where id=p.id;
 else
   if not p_cookie or p.assignments<=p.exposures then raise exception 'Diagnostic exposure unavailable';end if;
   update public.landing_experiment_probes set exposures=exposures+1 where id=p.id;
 end if;
 return jsonb_build_object('experiment',e.id,'assignment',p.id,'path',e.path,'arm','challenger','copies',e.control_copy||jsonb_build_object(public.landing_copy_slot(e.copy),e.copy));
end $$;

revoke all on function public.landing_experiment_visit_without_creative(text,uuid,text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
-- Existing public RPC ACLs are retained by CREATE OR REPLACE; helper calls run
-- only inside the existing SECURITY DEFINER owner, never as a new public API.
commit;
