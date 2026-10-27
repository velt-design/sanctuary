-- Additive owner-only reporting projection. No source facts, grants or eligibility rules change.
-- Retain correction basis so owner-authorised assumptions stay visible in report inspection.
create or replace function private.designer_visit_fact(v jsonb) returns jsonb
language plpgsql stable set search_path=pg_catalog,pg_temp as $$
declare d jsonb:=coalesce(v#>'{correction,details}','{}'); people jsonb;
  kind text:=v->>'kind'; day date; at_time timestamptz; reasons jsonb;
begin
  people:=coalesce(d->'staff',v->'staff','[]');
  if v->'correction' is not null and v->'correction'<>'null' then
    kind:=case when coalesce((v->>'withdrawn')::boolean,false) or kind='excluded' then 'excluded'
      when v->>'kindOverride'='review' then 'review' when d->>'status'='provisional' then 'provisional'
      when d->>'status' in ('booked','attended') then 'visit' else kind end;
    reasons:=coalesce(v#>'{correction,questions}','[]');
    if coalesce(v->>'origin','outlook')<>'history' and kind<>'excluded'
      and coalesce(d->>'status','') not in ('cancelled','not_attended') then
      if jsonb_array_length(people)=0 or nullif(btrim(coalesce(d->>'address',v->>'address')),'') is null
        or (d#>>'{timing,mode}'='unknown' and coalesce(d->>'status','')<>'attended')
        or (d#>>'{timing,mode}'='date' and coalesce(d->>'status','') not in ('attended','not_attended'))
      then reasons:=reasons||'["review-required"]'::jsonb; end if;
    end if;
  else reasons:=coalesce(v->'reviewReasons','[]'); end if;
  if d ? 'timing' then
    day:=nullif(d#>>'{timing,date}','')::date;
    if d#>>'{timing,mode}'='agreed' and day is not null then
      at_time:=(day::text||' '||(d#>>'{timing,time}'))::timestamp at time zone 'Pacific/Auckland';
    end if;
  elsif (v->>'isAllDay')::boolean is true then day:=(v->>'allDayStartDate')::date;
  else at_time:=(v->>'startsAt')::timestamptz; day:=(at_time at time zone 'Pacific/Auckland')::date; end if;
  return jsonb_build_object('id',v->>'id','projectId',v->'projectId','origin',coalesce(v->>'origin','outlook'),
    'day',day,'at',at_time,'purpose',d->>'purpose','status',d->>'status','kind',kind,
    'staff',coalesce((select jsonb_agg(distinct p->>'staffId' order by p->>'staffId') from jsonb_array_elements(people) p where p->>'staffId' is not null),'[]'),
    'unmappedStaff',(select count(*) from jsonb_array_elements(people) p where p->>'staffId' is null),
    'removed',coalesce((v->>'removed')::boolean,false),'withdrawn',coalesce((v->>'withdrawn')::boolean,false),
    'cancelled',case when d ? 'status' then d->>'status' in ('cancelled','not_attended') else coalesce((v->>'cancelled')::boolean,false) end,
    'duplicate',coalesce((v->>'duplicate')::boolean,false),'changed',coalesce((v#>>'{correction,sourceChanged}')::boolean,false),
    'questions',jsonb_array_length(reasons),'basis',v#>>'{correction,basis}');
end $$;
revoke all on function private.designer_visit_fact(jsonb) from public,anon,authenticated,service_role;

