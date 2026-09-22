begin;
-- Source-owned specialist records only. No legacy task mirrors, notes, prices,
-- schedule mutation fields, staff authentication metadata or customer contact data.
create view praxis_reporting.specialist_workload_v1 with (security_barrier=true) as
select 'installation'::text as domain,j.id as record_id,j.job_id as project_id,safe.payload,safe.omission_count
from public.scheduled_jobs j
left join public.projects p on p.id=j.job_id
left join public.schedule_crews c on c.id=j.crew_id
cross join lateral praxis_reporting.safe_payload_v1(jsonb_build_object(
  'projectName',p.name,'projectPresent',p.id is not null,'archived',p.archived_at is not null,
  'status',j.status,'identityKey',j.crew_id,'identityName',c.name,'identityActive',c.is_active,
  'plannedStart',j.planned_start,'forecastStart',j.forecast_start,'forecastEndExclusive',j.forecast_end_exclusive,
  'actualStart',j.actual_start,'actualFinish',j.actual_finish,
  'recordedAt',greatest(j.updated_at,p.updated_at,c.updated_at)
)) safe
union all
select 'design'::text,d.id,d.project_id,safe.payload,safe.omission_count
from public.design_package_requests d
left join public.projects p on p.id=d.project_id
cross join lateral praxis_reporting.safe_payload_v1(jsonb_build_object(
  'projectName',p.name,'projectPresent',p.id is not null,'archived',p.archived_at is not null,
  'status',d.status,'identityKey',d.assigned_designer,'identityName',null,'identityActive',null,
  'requestedAt',d.requested_at,'dueAt',d.due_at,'startedAt',d.started_at,'completedAt',d.completed_at,'cancelledAt',d.cancelled_at,
  'recordedAt',greatest(d.updated_at,p.updated_at)
)) safe;
revoke all on praxis_reporting.specialist_workload_v1 from public,anon,authenticated,service_role;
grant select on praxis_reporting.specialist_workload_v1 to sanctuary_praxis_reader;
comment on view praxis_reporting.specialist_workload_v1 is 'Recorded installation and design assignments only; completion is not performer, duration, capacity or performance evidence.';
commit;
