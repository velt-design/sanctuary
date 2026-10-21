begin;
-- Dedicated, default-off capability. No ads, pricing, customer or email writes.
create table public.landing_experiment_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 publishing boolean not null default false, binding text not null check(binding ~ '^[a-f0-9]{64}$'),
 template text not null, generation bigint not null default 1, campaign text not null,
 adset text not null, ads text[] not null, admitted_until timestamptz not null,
 control_outdoor jsonb not null default '{}', control_acrylic jsonb not null default '{}',
 check(control_outdoor <@ '{"design":"explore","help":"project","support":"estimate"}'::jsonb),
 check(control_acrylic <@ '{"design":"explore","help":"project","support":"estimate"}'::jsonb)
);
create table public.landing_experiments (
 id uuid primary key, path text not null check(path in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland')),
 lane text not null default 'landing' check(lane='landing'), template text not null,
 copy text not null check(copy in('explore','project','estimate')), control_copy jsonb not null,
 state text not null check(state in('candidate','rejected','reviewed','ready','live','retained','reverted','inconclusive')),
 candidate_hash text not null check(candidate_hash ~ '^[a-f0-9]{64}$'), evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$'),
 generator text not null, reviewer text, visual_hash text, created_at timestamptz not null default clock_timestamp(),
 started_at timestamptz, ends_at timestamptz, lease_until timestamptz, verified_at timestamptz,
 minimum_exposures integer not null check(minimum_exposures between 100 and 100000),
 duration_days integer not null check(duration_days between 7 and 28),
 check(control_copy <@ '{"design":"explore","help":"project","support":"estimate"}'::jsonb)
);
-- This single lane-independent index is the reservation for future creative tests.
create unique index landing_one_active_experiment on public.landing_experiments((true)) where state in('candidate','reviewed','ready','live');
create table public.landing_experiment_receipts (
 command uuid primary key, experiment uuid references public.landing_experiments(id), stage text not null,
 request_hash text not null, result jsonb not null, recorded_at timestamptz not null default clock_timestamp()
);
create table public.landing_experiment_assignments (
 id uuid primary key, experiment uuid not null references public.landing_experiments(id),
 arm text not null check(arm in('control','challenger')), ad text not null,
 created_at timestamptz not null default clock_timestamp(), exposed_at timestamptz,
 revoked_at timestamptz
);
create table public.landing_experiment_enquiries (
 enquiry_id uuid primary key references public.enquiry_requests(id), assignment uuid not null references public.landing_experiment_assignments(id),
 created_at timestamptz not null default clock_timestamp()
);
-- Short-lived serving diagnostics never enter visitor or enquiry tables.
create table public.landing_experiment_probes (
 id uuid primary key, experiment uuid not null references public.landing_experiments(id),
 mode text not null check(mode in('prepare','live')),generation bigint not null,
 candidate_hash text not null,template text not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,enrolled_at timestamptz,
 assignments integer not null default 0,exposures integer not null default 0,reloads integer not null default 0,
 verified_at timestamptz,check(assignments between 0 and 6),check(exposures between 0 and 6)
);
alter table public.landing_experiment_probes enable row level security;
revoke all on public.landing_experiment_probes from public,anon,authenticated,service_role;
-- One common eligibility predicate for ordinary visitors and live diagnostics.
create function public.landing_experiment_eligible(c public.landing_experiment_control,e public.landing_experiments,p_path text,p_template text,p_existing boolean)
returns boolean language sql stable set search_path='' as $$
 select coalesce(c.enabled and c.publishing and c.admitted_until>statement_timestamp() and c.template=p_template and e.template=p_template
 and e.path=p_path and e.state='live' and e.lease_until>statement_timestamp()
 and (e.ends_at>statement_timestamp() or(p_existing and e.ends_at+interval '72 hours'>statement_timestamp())),false)
$$;
revoke all on function public.landing_experiment_eligible(public.landing_experiment_control,public.landing_experiments,text,text,boolean) from public,anon,authenticated,service_role;
alter table public.landing_experiment_control enable row level security;
alter table public.landing_experiments enable row level security;
alter table public.landing_experiment_receipts enable row level security;
alter table public.landing_experiment_assignments enable row level security;
alter table public.landing_experiment_enquiries enable row level security;
revoke all on public.landing_experiment_control,public.landing_experiments,public.landing_experiment_receipts,public.landing_experiment_assignments,public.landing_experiment_enquiries from public,anon,authenticated,service_role;
create function public.landing_experiment_generation() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.enabled,new.publishing,new.binding,new.template,new.campaign,new.adset,new.ads,new.admitted_until) is distinct from row(old.enabled,old.publishing,old.binding,old.template,old.campaign,old.adset,old.ads,old.admitted_until) then new.generation:=old.generation+1;else new.generation:=old.generation;end if;return new;
end $$;
create trigger landing_experiment_generation before update on public.landing_experiment_control for each row execute function public.landing_experiment_generation();
revoke all on function public.landing_experiment_generation() from public,anon,authenticated,service_role;

create function public.landing_experiment_command(p_binding text,p_command uuid,p_stage text,p_experiment uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.landing_experiment_control; e public.landing_experiments; r public.landing_experiment_receipts;
 stamp timestamptz:=clock_timestamp(); h text; result jsonb; previous_copy jsonb; selected_slot text;
begin
 if p_command is null or p_payload is null or octet_length(p_payload::text)>16000 or p_stage not in('read','receipt','prepare','review','visual','publish','probe','verify','renew','evaluate','rollback') then raise exception 'Invalid experiment command';end if;
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.landing_experiment_control where singleton for update;
 if not found or c.binding is distinct from p_binding then raise exception 'Experiment authority unavailable';end if;
 if p_stage='receipt' then
   select * into r from public.landing_experiment_receipts where command=(p_payload->>'command')::uuid and experiment=p_experiment;
   if not found then return null;end if;
   h:=encode(sha256(convert_to(jsonb_build_array(p_payload->>'stage',p_experiment,p_payload->'payload')::text,'UTF8')),'hex');
   if r.request_hash<>h then raise exception 'Receipt context differs';end if;
   return r.result;
 end if;
 h:=encode(sha256(convert_to(jsonb_build_array(p_stage,p_experiment,p_payload)::text,'UTF8')),'hex');
 select * into r from public.landing_experiment_receipts where command=p_command;
 if found then if r.request_hash<>h then raise exception 'Command conflict';end if;return r.result;end if;
 if p_stage='read' then
   return jsonb_build_object('enabled',c.enabled and c.admitted_until>stamp,'publishing',c.publishing,'template',c.template,'generation',c.generation,
     'controls',jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic),
     'experiment',(select to_jsonb(x) from (select * from public.landing_experiments order by created_at desc limit 1)x),
     'counts',public.landing_experiment_counts((select id from public.landing_experiments order by created_at desc limit 1)),
     'decision',public.landing_experiment_decision((select id from public.landing_experiments order by created_at desc limit 1)))
     ||public.landing_experiment_quality((select id from public.landing_experiments order by created_at desc limit 1));
 end if;
 if not c.enabled or c.admitted_until<=stamp or (p_payload->>'generation')::bigint is distinct from c.generation then raise exception 'Experiment disabled';end if;
 if p_stage='prepare' then
   if p_payload->>'template' is distinct from c.template or p_experiment is null then raise exception 'Template changed';end if;
   if exists(select 1 from public.landing_experiments where created_at>stamp-interval '7 days') then raise exception 'Candidate cadence exceeded';end if;
   previous_copy:=case when p_payload->>'path'='/auckland-outdoor-living' then c.control_outdoor else c.control_acrylic end;
   selected_slot:=case p_payload->>'copy' when 'explore' then 'design' when 'project' then 'help' when 'estimate' then 'support' end;
   if selected_slot is null or previous_copy->>selected_slot=p_payload->>'copy' then raise exception 'Unchanged candidate';end if;
   insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days)
    values(p_experiment,p_payload->>'path',c.template,p_payload->>'copy',previous_copy,'candidate',p_payload->>'candidateHash',p_payload->>'evidenceHash',p_payload->>'generator',
      (p_payload->>'minimumExposures')::integer,(p_payload->>'durationDays')::integer);
 else
   select * into e from public.landing_experiments where id=p_experiment for update;
   if not found or p_payload->>'candidateHash' is distinct from e.candidate_hash then raise exception 'Candidate changed';end if;
   if p_stage='probe' then
     if e.template<>c.template or p_payload->>'template' is distinct from c.template or p_payload->>'mode' not in('prepare','live') then raise exception 'Probe template changed';end if;
     if p_payload->>'mode'='prepare' and e.state not in('candidate','reviewed') then raise exception 'Preparation unavailable';end if;
     if p_payload->>'mode'='live' and not public.landing_experiment_eligible(c,e,e.path,c.template,
       exists(select 1 from public.landing_experiment_probes prior where prior.experiment=e.id and prior.mode='live' and prior.enrolled_at<e.ends_at and prior.verified_at is not null)) then raise exception 'Live serving unavailable';end if;
     delete from public.landing_experiment_probes where created_at<stamp-interval '2 days';
     if (select count(*) from public.landing_experiment_probes where mode=p_payload->>'mode' and (created_at at time zone 'Pacific/Auckland')::date=(stamp at time zone 'Pacific/Auckland')::date)>=(case when p_payload->>'mode'='prepare' then 1 else 6 end) then raise exception 'Probe daily limit';end if;
     insert into public.landing_experiment_probes(id,experiment,mode,generation,candidate_hash,template,expires_at,enrolled_at)
       values((p_payload->>'probe')::uuid,e.id,p_payload->>'mode',c.generation,e.candidate_hash,c.template,stamp+case when p_payload->>'mode'='prepare' then interval '100 seconds' else interval '25 seconds' end,
       case when p_payload->>'mode'='live' and e.ends_at<=stamp then (select min(prior.enrolled_at) from public.landing_experiment_probes prior where prior.experiment=e.id and prior.mode='live' and prior.enrolled_at<e.ends_at and prior.verified_at is not null) else null end);
   elsif p_stage='rollback' then
     if e.state not in('candidate','live','ready','reviewed','retained') then raise exception 'Cannot rollback';end if;
     if e.state='retained' then
       selected_slot:=case e.copy when 'explore' then 'design' when 'project' then 'help' else 'support' end;
       if (case when e.path='/auckland-outdoor-living' then c.control_outdoor else c.control_acrylic end) is distinct from (e.control_copy||jsonb_build_object(selected_slot,e.copy)) then raise exception 'Control changed';end if;
       update public.landing_experiment_control set control_outdoor=case when e.path='/auckland-outdoor-living' then e.control_copy else control_outdoor end,
         control_acrylic=case when e.path='/acrylic-roof-pergolas-auckland' then e.control_copy else control_acrylic end where singleton;
     end if;
     update public.landing_experiments set state='reverted',lease_until=stamp where id=e.id;
   elsif p_stage='review' then
     if e.state<>'candidate' or nullif(p_payload->>'reviewer','') is null or p_payload->>'reviewer'=e.generator then raise exception 'Independent review required';end if;
     update public.landing_experiments set reviewer=p_payload->>'reviewer',state=case when p_payload->>'verdict'='pass' then 'reviewed' else 'rejected' end where id=e.id;
   elsif p_stage='visual' then
     if e.state<>'reviewed' or coalesce(p_payload->>'visualHash','')!~'^[a-f0-9]{64}$' or p_payload->>'template' is distinct from c.template then raise exception 'Visual proof required';end if;
     update public.landing_experiments set state='ready',visual_hash=p_payload->>'visualHash' where id=e.id;
   elsif p_stage='publish' then
     if not c.publishing or e.state<>'ready' or e.template<>c.template or e.visual_hash is null
       or e.control_copy is distinct from (case when e.path='/auckland-outdoor-living' then c.control_outdoor else c.control_acrylic end) then raise exception 'Publication not admitted';end if;
     update public.landing_experiments set state='live',started_at=stamp,ends_at=((stamp at time zone 'Pacific/Auckland')::date+e.duration_days+1)::timestamp at time zone 'Pacific/Auckland',lease_until=stamp+interval '5 hours' where id=e.id;
   elsif p_stage in('verify','renew') then
     if not public.landing_experiment_eligible(c,e,e.path,c.template,true) or p_payload->>'servedHash' is distinct from e.candidate_hash
       or not exists(select 1 from public.landing_experiment_probes p where p.id=(p_payload->>'probe')::uuid and p.experiment=e.id and p.mode='live'
       and p.generation=c.generation and p.candidate_hash=e.candidate_hash and p.template=c.template and p.expires_at>stamp and p.assignments>=2 and p.exposures>=2 and p.reloads>=1 and p.verified_at is null)
       then raise exception 'Served candidate differs';end if;
     update public.landing_experiment_probes set verified_at=stamp where id=(p_payload->>'probe')::uuid;
     update public.landing_experiments set verified_at=stamp,lease_until=least(ends_at+interval '72 hours',stamp+interval '5 hours') where id=e.id;
   elsif p_stage='evaluate' then
     if e.state<>'live' or e.ends_at+interval '72 hours'>stamp or p_payload->>'decision' not in('retain','revert','inconclusive') then raise exception 'Evaluation unavailable';end if;
     -- Retention needs the exact source-owned evaluation, never a model winner.
     if p_payload->>'decision'='retain' and (public.landing_experiment_decision(e.id)<>'retain' or p_payload->>'qualityGuard'<>'pass') then raise exception 'Retention not supported';end if;
     update public.landing_experiments set state=case p_payload->>'decision' when 'retain' then 'retained' when 'revert' then 'reverted' else 'inconclusive' end,lease_until=stamp where id=e.id;
     if p_payload->>'decision'='retain' then
       selected_slot:=case e.copy when 'explore' then 'design' when 'project' then 'help' else 'support' end;
       update public.landing_experiment_control set
       control_outdoor=case when e.path='/auckland-outdoor-living' then e.control_copy||jsonb_build_object(selected_slot,e.copy) else control_outdoor end,
       control_acrylic=case when e.path='/acrylic-roof-pergolas-auckland' then e.control_copy||jsonb_build_object(selected_slot,e.copy) else control_acrylic end where singleton;end if;
   else raise exception 'Invalid transition';end if;
 end if;
 result:=jsonb_build_object('experiment',p_experiment,'state',(select state from public.landing_experiments where id=p_experiment));
 if p_stage='probe' then result:=result||jsonb_build_object('probe',p_payload->>'probe','mode',p_payload->>'mode','path',e.path,'expires',(select expires_at from public.landing_experiment_probes where id=(p_payload->>'probe')::uuid),'utm',jsonb_build_object('utm_source','facebook','utm_medium','paid_social','utm_campaign',c.campaign,'utm_term',c.adset,'utm_content',c.ads[1]));end if;
 if p_stage='evaluate' then result:=result||jsonb_build_object('formal',jsonb_build_object('decision',p_payload->>'decision','counts',public.landing_experiment_counts(p_experiment),'qualityGuard',p_payload->>'qualityGuard','qualityHash',p_payload->>'qualityHash','observedAt',stamp));end if;
 insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result)values(p_command,p_experiment,p_stage,h,result);
 return result;
end $$;

create function public.landing_experiment_counts(p_experiment uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with joined as (
 select a.id,a.arm,j.enquiry_id,(select state from private.enquiry_qualification_events q where q.enquiry_id=j.enquiry_id order by version desc limit 1) qualification
 from public.landing_experiment_assignments a left join public.landing_experiment_enquiries j on j.assignment=a.id
   and j.created_at<=(select ends_at+interval '72 hours' from public.landing_experiments where id=p_experiment)
 where a.experiment=p_experiment and a.exposed_at is not null and a.revoked_at is null
 ), arms(arm) as(values('control'),('challenger'))
 select jsonb_agg(x) from(select arms.arm,count(distinct j.id)::integer exposures,count(distinct j.enquiry_id)::integer enquiries,
 count(distinct j.id) filter(where j.enquiry_id is not null)::integer "convertedAssignments",
 count(distinct j.enquiry_id) filter(where qualification='qualified')::integer qualified,
 count(distinct j.id) filter(where qualification='qualified')::integer "qualifiedAssignments",
 count(distinct j.enquiry_id) filter(where qualification is null or qualification='unreviewed')::integer unreviewed
 from arms left join joined j using(arm) group by arms.arm)x
$$;
create function public.landing_experiment_quality(p_experiment uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with joined as materialized(select a.arm,j.enquiry_id,(select state from private.enquiry_qualification_events q where q.enquiry_id=j.enquiry_id order by version desc limit 1) qualification
 from public.landing_experiment_assignments a join public.landing_experiment_enquiries j on j.assignment=a.id
 where a.experiment=p_experiment and a.exposed_at is not null and a.revoked_at is null
 and j.created_at<=(select ends_at+interval '72 hours' from public.landing_experiments where id=p_experiment)),
 selected as(select arm,encode(sha256(convert_to('sp_enq_'||enquiry_id::text,'UTF8')),'hex') key,qualification from joined order by enquiry_id limit 400)
 select jsonb_build_object('quality',coalesce((select jsonb_agg(selected) from selected),'[]'),'qualityOmitted',greatest(0,(select count(*) from joined)-400))
$$;
create function public.landing_experiment_decision(p_experiment uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare e public.landing_experiments; rows jsonb; a jsonb; b jsonb; n numeric; x numeric; c_low numeric; c_high numeric; t_low numeric; t_high numeric; pc numeric; pt numeric; lower_difference numeric; upper_difference numeric;
begin
 select * into e from public.landing_experiments where id=p_experiment;
 if not found or e.ends_at is null then return 'inconclusive';end if;
 rows:=public.landing_experiment_counts(p_experiment);
 select value into a from jsonb_array_elements(rows) where value->>'arm'='control';
 select value into b from jsonb_array_elements(rows) where value->>'arm'='challenger';
 if e.ends_at+interval '72 hours'>clock_timestamp() or (a->>'exposures')::integer<e.minimum_exposures or (b->>'exposures')::integer<e.minimum_exposures
 then return 'inconclusive';end if;
 -- Predeclared conservative Wilson 95% intervals on genuine saved-enquiry
 -- conversion per exposed assignment. Quality is a separate evidence guard.
 n:=(a->>'exposures')::numeric;x:=(a->>'convertedAssignments')::numeric/n;pc:=x;
 c_low:=(x+3.8416/(2*n)-1.96*sqrt(x*(1-x)/n+3.8416/(4*n*n)))/(1+3.8416/n);
 c_high:=(x+3.8416/(2*n)+1.96*sqrt(x*(1-x)/n+3.8416/(4*n*n)))/(1+3.8416/n);
 n:=(b->>'exposures')::numeric;x:=(b->>'convertedAssignments')::numeric/n;pt:=x;
 t_low:=(x+3.8416/(2*n)-1.96*sqrt(x*(1-x)/n+3.8416/(4*n*n)))/(1+3.8416/n);
 t_high:=(x+3.8416/(2*n)+1.96*sqrt(x*(1-x)/n+3.8416/(4*n*n)))/(1+3.8416/n);
 lower_difference:=pt-pc-sqrt(power(pt-t_low,2)+power(c_high-pc,2));
 upper_difference:=pt-pc+sqrt(power(t_high-pt,2)+power(pc-c_low,2));
 return case when lower_difference>0 then 'retain' when upper_difference<0 then 'revert' else 'inconclusive' end;
end $$;
revoke all on function public.landing_experiment_counts(uuid) from public,anon,authenticated;
grant execute on function public.landing_experiment_counts(uuid) to service_role;
revoke all on function public.landing_experiment_quality(uuid) from public,anon,authenticated;
grant execute on function public.landing_experiment_quality(uuid) to service_role;

create function public.landing_experiment_visit(p_stage text,p_id uuid,p_path text,p_template text,p_ad text default null,p_campaign text default null,p_adset text default null)
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
 if p_stage='expose' then update public.landing_experiment_assignments set exposed_at=coalesce(exposed_at,stamp) where id=p_id;end if;
 return jsonb_build_object('experiment',e.id,'assignment',a.id,'path',e.path,'arm',a.arm,'copies',case when a.arm='control' then e.control_copy
   else e.control_copy||jsonb_build_object(case e.copy when 'explore' then 'design' when 'project' then 'help' else 'support' end,e.copy) end);
end $$;
revoke all on function public.landing_experiment_visit(text,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.landing_experiment_visit(text,uuid,text,text,text,text,text) to service_role;
create function public.landing_experiment_probe_visit(p_probe uuid,p_stage text,p_path text,p_template text,p_generation bigint,p_candidate text,p_mode text,p_cookie boolean,p_ad text default null,p_campaign text default null,p_adset text default null)
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
 return jsonb_build_object('experiment',e.id,'assignment',p.id,'path',e.path,'arm','challenger','copies',e.control_copy||jsonb_build_object(case e.copy when 'explore' then 'design' when 'project' then 'help' else 'support' end,e.copy));
end $$;
revoke all on function public.landing_experiment_probe_visit(uuid,text,text,text,bigint,text,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.landing_experiment_probe_visit(uuid,text,text,text,bigint,text,text,boolean,text,text,text) to service_role;
create function public.landing_experiment_public_control(p_path text,p_template text) returns jsonb language sql stable security definer set search_path='' as $$
 select case when p_path='/auckland-outdoor-living' then control_outdoor when p_path='/acrylic-roof-pergolas-auckland' then control_acrylic else '{}'::jsonb end
 from public.landing_experiment_control where singleton and enabled and template=p_template
$$;
revoke all on function public.landing_experiment_public_control(text,text) from public,anon,authenticated;
grant execute on function public.landing_experiment_public_control(text,text) to service_role;

-- Same canonical intake, same transaction; no duplicate email or business owner.
create function public.marketing_experiment_intake(p_submission_id uuid,p_upload_token_hash text,p_payload jsonb,p_assignment uuid,p_delivery jsonb default null)
returns table(contact_id uuid,project_id uuid,enquiry_request_id uuid,already_existed boolean,estimate_id uuid)
language plpgsql security definer set search_path='' as $$
declare r record; a public.landing_experiment_assignments; e public.landing_experiments;
begin
 if p_delivery is not null then select * into r from public.marketing_enquiry_intake_with_delivery(p_submission_id,p_upload_token_hash,p_payload,p_delivery);
 else select i.*,null::uuid estimate_id into r from public.marketing_enquiry_intake(p_submission_id,p_upload_token_hash,p_payload)i;end if;
 select * into a from public.landing_experiment_assignments where id=p_assignment;
 select * into e from public.landing_experiments where id=a.experiment;
 if a.exposed_at is not null and a.revoked_at is null and a.created_at>clock_timestamp()-interval '28 days'
 and p_payload#>>'{rawPayload,attribution,consent,analytics}'='true' and p_payload#>>'{rawPayload,attribution,consent,marketing}'='true'
 and (p_payload->>'page'=e.path or p_payload#>>'{rawPayload,enquiryContext,sourcePath}'=e.path)
 and exists(select 1 from public.enquiry_requests original where original.id=r.enquiry_request_id and original.created_at>=a.exposed_at)
 then insert into public.landing_experiment_enquiries(enquiry_id,assignment) values(r.enquiry_request_id,a.id) on conflict(enquiry_id) do nothing;end if;
 return query select r.contact_id,r.project_id,r.enquiry_request_id,r.already_existed,r.estimate_id;
end $$;
revoke all on function public.marketing_experiment_intake(uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.marketing_experiment_intake(uuid,text,jsonb,uuid,jsonb) to service_role;
revoke all on function public.landing_experiment_decision(uuid) from public,anon,authenticated;
revoke all on function public.landing_experiment_command(text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.landing_experiment_command(text,uuid,text,uuid,jsonb),public.landing_experiment_decision(uuid) to service_role;
commit;
