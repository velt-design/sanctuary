begin;
-- Synthetic already-terminal database rows only. No provider/credential read,
-- native acceptance or live result is inferred from these fixtures.
create function pg_temp.learn_assert(ok boolean)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Creative learning assertion failed';end if;end$$;
create function pg_temp.learn_reject(statement text,reason text)returns void language plpgsql as $$declare actual text;begin
 begin execute statement;exception when others then get stacked diagnostics actual=message_text;if actual=reason then return;end if;raise exception 'Wrong rejection: %',actual;end;
 raise exception 'Unexpected creative admission';end$$;
update public.meta_creative_control set enabled=true,authority_current=true,global_stop=false;
update public.landing_experiment_control set template=repeat('a',64);
create function pg_temp.learn_control()returns jsonb language sql as $$select jsonb_build_object('id','8801','page',scope->>'page','format','image','primary','Approved public control.','path','/acrylic-roof-pergolas-auckland','imageHash',repeat('a',32),'headline','Approved title','description','','action','LEARN_MORE','urlTags','utm_source=facebook')from public.meta_creative_control$$;
create function pg_temp.learn_plan(e uuid,copy text,change jsonb default '{}')returns jsonb language sql as $$
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',control_hash,'nativeContractHash',native_contract_hash,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','formal_experiment','currency','NZD','timezone','Pacific/Auckland',
 'generator','resp_synthetic_author','reviewer','resp_synthetic_reviewer','approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval'1 day',
 'controlAd','21','control',pg_temp.learn_control(),'challengerPrimary',copy,'start',floor(extract(epoch from clock_timestamp()-interval'18 days')),'end',floor(extract(epoch from clock_timestamp()-interval'4 days')))||change from public.meta_creative_control
$$;
create function pg_temp.learn_seed(copy text,change jsonb default '{}',analysis_change jsonb default '{}')returns uuid language plpgsql as $$
declare e uuid:=gen_random_uuid();h text;plan jsonb;a jsonb;stamp text;begin
 h:=encode(sha256(convert_to(e::text,'UTF8')),'hex');plan:=pg_temp.learn_plan(e,copy,change);stamp:=to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 insert into public.meta_creative_plans(id,plan,plan_hash,created_at)values(e,'{}',h,clock_timestamp()-interval'10 days');
 insert into public.meta_creative_execution(experiment,plan,plan_hash,created_at)values(e,plan,h,clock_timestamp()-interval'10 days');
 a:=jsonb_build_object('version',1,'experiment',e,'planHash',h,'policy','native-saved-enquiry-per-dollar-v1','observedAt',stamp,'cohortHash',repeat('a',64),'spendHash',repeat('b',64),'deliveryHash',repeat('c',64),'sourceDates',jsonb_build_object('cohort',stamp,'spend',stamp,'delivery',stamp),'allSavedCoverage','complete','coverageCounts',jsonb_build_object('websiteGenuine',0,'nativeMatched',0,'knownOtherRegistered',0,'unknownAttribution',0,'unlinkedNative',0),'unresolvedLate',0,
 'arms',jsonb_build_array(jsonb_build_object('arm','control','ad','8201','enquiries',0,'spend',10,'canonical',0,'correspondence',0,'intake',0,'assessed',0,'concerns',0,'conflicting',0,'unknown',0),jsonb_build_object('arm','challenger','ad','8202','enquiries',0,'spend',20,'canonical',0,'correspondence',0,'intake',0,'assessed',0,'concerns',0,'conflicting',0,'unknown',0)),'decision','inconclusive','reason','no_enquiries','interval',null,'quality','unknown_or_fails');
 insert into public.meta_creative_formal_analysis(experiment,command,payload)values(e,gen_random_uuid(),a||analysis_change);return e;
end$$;
create function pg_temp.learn_read(change jsonb default '{}')returns jsonb language sql as $$
 select public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),null,'history',jsonb_build_object('generation',generation,'controlAd','21','control',pg_temp.learn_control(),'template',repeat('a',64))||change)from public.meta_creative_control
$$;
do $$declare prior uuid;before_row jsonb;history jsonb;copy text:=E'A quoted "hook".\nKeep approved café text.';expected text;e uuid;plan jsonb;begin
 prior:=pg_temp.learn_seed(copy);select to_jsonb(a)into before_row from public.meta_creative_formal_analysis a where experiment=prior;
 -- This JSON-string hash is the same rendered-primary identity used in Velt.
 expected:=encode(sha256(convert_to(to_jsonb(copy)::text,'UTF8')),'hex');
 perform pg_temp.learn_assert(expected='e02084918e55f92818fade7464c0c99e7cf14429a9a77db75a19d87a281180c9');
 perform pg_temp.learn_seed('Later hook '||n)from generate_series(1,6)n;
 history:=pg_temp.learn_read();perform pg_temp.learn_assert(history->'complete'='true'::jsonb and jsonb_array_length(history->'previous')=4 and history->'excluded'?expected);
 perform pg_temp.learn_assert(not exists(select 1 from jsonb_array_elements(history->'previous')v where v->>'copyHash'=expected));
 perform pg_temp.learn_assert(history#>>'{previous,0,result}'='inconclusive'and history#>'{previous,0,enquiries}'='[0,0]'::jsonb and history#>'{previous,0,spend}'='[10,20]'::jsonb);
 perform pg_temp.learn_assert(history#>>'{previous,0,hookPrefix}'like'Later hook %');
 -- Equal matched arm counts are not equivalent all-saved evidence. Preserve
 -- unknown attribution and unresolved late records in the bounded projection.
 perform pg_temp.learn_seed('Known zero.','{}','{"reason":"evidence_incomplete"}');
 perform pg_temp.learn_seed('Unassigned outcomes.','{}','{"reason":"evidence_incomplete","allSavedCoverage":"unknown","unresolvedLate":1,"coverageCounts":{"websiteGenuine":3,"nativeMatched":0,"knownOtherRegistered":0,"unknownAttribution":2,"unlinkedNative":0}}');
 history:=pg_temp.learn_read();
 perform pg_temp.learn_assert(history#>'{previous,0,enquiries}'='[0,0]'::jsonb and history#>'{previous,1,enquiries}'='[0,0]'::jsonb);
 perform pg_temp.learn_assert(history#>'{previous,0,coverage}'='{"allSaved":"unknown","unassigned":3}'::jsonb and history#>'{previous,1,coverage}'='{"allSaved":"complete","unassigned":0}'::jsonb);
 perform pg_temp.learn_assert(history#>'{previous,0,reason}'=history#>'{previous,1,reason}');
 e:=gen_random_uuid();plan:=pg_temp.learn_plan(e,copy);
 perform pg_temp.learn_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',plan,'planHash',repeat('e',64))),'Previously evaluated creative copy');
 perform pg_temp.learn_assert(pg_temp.learn_read(jsonb_build_object('controlAd','22'))->'excluded'='[]'::jsonb);
 perform pg_temp.learn_assert(pg_temp.learn_read(jsonb_build_object('control',pg_temp.learn_control()||'{"primary":"Changed approved control."}'))->'excluded'='[]'::jsonb);
 perform pg_temp.learn_assert(pg_temp.learn_read(jsonb_build_object('control',pg_temp.learn_control()||'{"imageHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'))->'excluded'='[]'::jsonb);
 perform pg_temp.learn_assert((select public.meta_creative_learning(scope||'{"campaign":"999"}',original_ads,native_contract_hash,'21',repeat('a',64),pg_temp.learn_control())->'excluded'='[]'::jsonb from public.meta_creative_control));
 perform pg_temp.learn_assert((select public.meta_creative_learning(scope,original_ads,case when native_contract_hash=repeat('e',64)then repeat('f',64)else repeat('e',64)end,'21',repeat('a',64),pg_temp.learn_control())->'excluded'='[]'::jsonb from public.meta_creative_control));
 perform pg_temp.learn_reject('select pg_temp.learn_read(''{"template":"bad"}'')','Creative history unavailable');
 perform pg_temp.learn_reject('select pg_temp.learn_read(''{"generation":0}'')','Creative history unavailable');
 perform pg_temp.learn_reject('select pg_temp.learn_read(''{"controlAd":"999"}'')','Creative history unavailable');
 update public.meta_creative_control set global_stop=true;perform pg_temp.learn_reject('select pg_temp.learn_read()','Creative history unavailable');update public.meta_creative_control set global_stop=false;
 -- Many unrelated-domain rows cannot evict the durable match.
 perform pg_temp.learn_seed('Other history '||n,jsonb_build_object('controlAd','22'))from generate_series(1,160)n;
 perform pg_temp.learn_assert(pg_temp.learn_read()->'excluded'?expected);
 perform pg_temp.learn_assert((select to_jsonb(a)=before_row from public.meta_creative_formal_analysis a where experiment=prior));
 -- Different public copy still reaches the original reservation. Exact replay
 -- preserves that reservation and plan; a changed replay remains rejected.
 begin
  plan:=pg_temp.learn_plan(e,'A genuinely different approved hook.');
  perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',plan,'planHash',repeat('e',64)));
  perform pg_temp.learn_assert(exists(select 1 from public.acquisition_experiment_reservation where experiment=e));
  perform pg_temp.learn_assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',plan,'planHash',repeat('e',64)))->'prepared'='true'::jsonb);
  perform pg_temp.learn_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',plan||'{"challengerPrimary":"Mutated replay."}','planHash',repeat('e',64))),'Plan conflict');
  raise sqlstate 'Z0001'; -- Roll back only this successful synthetic admission.
 exception when sqlstate 'Z0001'then null;
 end;
 -- Missing/overflow coverage never silently drops an old exclusion and enables a retry.
 perform pg_temp.learn_seed('Distinct old hook '||n)from generate_series(1,58)n;
 history:=pg_temp.learn_read();perform pg_temp.learn_assert(history->'complete'='false'::jsonb and history->'excluded'='[]'::jsonb and jsonb_array_length(history->'previous')=4);
 perform pg_temp.learn_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',plan||'{"challengerPrimary":"Different copy."}','planHash',repeat('e',64))),'Creative history coverage bound');
end$$;
select pg_temp.learn_assert(not has_function_privilege(role_name,'public.meta_creative_learning(jsonb,jsonb,text,text,text,jsonb)','EXECUTE')and not has_function_privilege(role_name,'public.meta_creative_executor_without_learning(text,uuid,uuid,text,jsonb)','EXECUTE'))from unnest(array['anon','authenticated','service_role'])role_name;
rollback;
