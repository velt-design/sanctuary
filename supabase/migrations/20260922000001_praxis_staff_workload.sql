begin;

-- One project inventory row even when it has no work items. No auth metadata, notes,
-- event payloads, financial details or specialist schedules cross this view.
create or replace view praxis_reporting.workload_v1
with (security_barrier = true)
as
with staff_names as (
  -- Existing staff_project_assignees roster name precedence, without email fallback.
  select staff.user_id,coalesce(nullif(trim(account.raw_user_meta_data->>'full_name'),''),
    nullif(trim(account.raw_user_meta_data->>'name'),''),nullif(trim(account.raw_user_meta_data->>'display_name'),'')) as display_name
  from public.portal_users staff join auth.users account on account.id=staff.user_id
  where account.deleted_at is null and (account.banned_until is null or account.banned_until<=now())
)
select p.id as project_id, item.id as work_item_id,
  safe.payload, safe.omission_count
from public.projects p
left join public.project_work_model_versions model on model.project_id=p.id
left join public.project_operational_states state on state.project_id=p.id
left join public.project_owner_assignments owner on owner.project_id=p.id
left join public.project_work_items item on item.project_id=p.id
left join staff_names assignee on assignee.user_id=item.assignee_user_id
left join staff_names recorder on recorder.user_id=item.completed_by
cross join lateral praxis_reporting.safe_payload_v1(jsonb_build_object(
  'projectName',p.name,'modelVersion',model.model_version,'projectState',
    case when p.archived_at is not null then 'ARCHIVED' else state.state end,
  'statePresent',state.project_id is not null,
  'title',item.title,'status',item.status,'dueAt',item.due_at,
  'manual',item.origin='MANUAL' and item.source_type='MANUAL',
  -- Same word/space/hyphen/underscore policy as isRetiredProjectWorkIdentity.
  'retired',coalesce(concat_ws(' ',item.title,item.source_type,item.source_key,item.series_key) ~* '\m(call|site[[:space:]_-]*visits?)\M',false),
  'assigneeUserId',item.assignee_user_id,'ownerKey',owner.owner_key,
  'assigneeName',assignee.display_name,'completedAt',item.completed_at,'completedBy',item.completed_by,'completedByName',recorder.display_name,
  'recordedAt',greatest(p.updated_at,state.updated_at,owner.updated_at,item.updated_at)
)) safe;

revoke all on praxis_reporting.workload_v1 from public, anon, authenticated, service_role;
grant select on praxis_reporting.workload_v1 to sanctuary_praxis_reader;
comment on view praxis_reporting.workload_v1 is
  'Explicit recorded manual work and source coverage only. Completion recorder is not proof of performer. No staff capacity or performance inference.';
commit;
