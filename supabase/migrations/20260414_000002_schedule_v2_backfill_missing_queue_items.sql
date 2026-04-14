-- Repair scheduled_jobs rows that were created without their crew queue item.
-- This migration only inserts missing crew_schedule_items; it does not delete or
-- reorder existing schedule data.

with orphaned_jobs as (
  select
    sj.id as scheduled_job_id,
    sj.crew_id,
    row_number() over (
      partition by sj.crew_id
      order by sj.created_at, sj.id
    ) as repair_order
  from public.scheduled_jobs sj
  where not exists (
    select 1
    from public.crew_schedule_items csi
    where csi.item_type = 'job'
      and csi.job_id = sj.id
  )
),
crew_tail_positions as (
  select
    c.id as crew_id,
    coalesce(max(csi.position), -1) as max_position
  from public.schedule_crews c
  left join public.crew_schedule_items csi on csi.crew_id = c.id
  group by c.id
)
insert into public.crew_schedule_items (
  crew_id,
  item_type,
  job_id,
  position
)
select
  orphaned_jobs.crew_id,
  'job',
  orphaned_jobs.scheduled_job_id,
  crew_tail_positions.max_position + orphaned_jobs.repair_order
from orphaned_jobs
join crew_tail_positions on crew_tail_positions.crew_id = orphaned_jobs.crew_id
where not exists (
  select 1
  from public.crew_schedule_items csi
  where csi.item_type = 'job'
    and csi.job_id = orphaned_jobs.scheduled_job_id
);

notify pgrst, 'reload schema';
