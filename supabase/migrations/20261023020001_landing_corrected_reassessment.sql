-- Keep the signed wire contract and complete immutable receipt row shape.
-- The sole prior owner/day receipt is the exact reassessment predecessor.
begin;
drop index public.landing_owner_decision_day;
create unique index landing_owner_decision_correction on public.landing_experiment_receipts((result->>'owner'),(result->>'day'),(result->>'correction')) where stage='owner_decision';

do $patch$ declare f text;n text;begin
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 n:='digest text;';
 if position(n in f)=0 then raise exception 'Owner decision declaration differs';end if;
 f:=replace(f,n,n||'previous public.landing_experiment_receipts;');
 n:='   answer:=p_payload||jsonb_build_object(''ownerDecision'',p_command,';
 if position(n in f)=0 then raise exception 'Owner decision capacity anchor differs';end if;
 f:=replace(f,n,$body$
   select * into previous from public.landing_experiment_receipts where stage='owner_decision'
    and result->>'owner'=p_payload->>'owner' and result->>'day'=p_payload->>'day' order by recorded_at desc,command desc limit 1;
   if previous.command is not null then
    if(select count(*)from public.landing_experiment_receipts where stage='owner_decision' and result->>'owner'=p_payload->>'owner' and result->>'day'=p_payload->>'day')<>1
     or previous.result->>'correction'=p_payload->>'correction'
     or previous.result->>'request'=p_payload->>'request'
     or previous.result#>>'{funding,receiptHash}'=p_payload#>>'{funding,receiptHash}'
     or previous.result->'generation' is distinct from p_payload->'generation' or previous.result->'template' is distinct from p_payload->'template'
     or previous.result->'controls' is distinct from p_payload->'controls' or previous.result->'prior' is distinct from p_payload->'prior'
     or not exists(select 1 from public.landing_experiment_receipts where stage='owner_end' and result->>'ownerDecision'=previous.command::text and result->>'result'='no_landing_hypothesis')
     or exists(select 1 from public.landing_experiment_receipts where result->>'ownerDecision'=previous.command::text
      and(stage in('prepare','probe') or stage='owner_end' and result->>'result' is distinct from 'no_landing_hypothesis'))
     then raise exception 'Corrected reassessment unavailable';end if;
   end if;
   answer:=p_payload||jsonb_build_object('ownerDecision',p_command,
$body$);
 execute f;
end$patch$;
commit;
