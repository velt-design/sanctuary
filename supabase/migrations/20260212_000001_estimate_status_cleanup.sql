-- Remove legacy estimate approval workflow state and metadata.

update public.estimates
set status = 'draft'
where coalesce(lower(status), 'draft') not in ('draft', 'archived');

alter table public.estimates
  drop constraint if exists estimates_status_check;

alter table public.estimates
  add constraint estimates_status_check check (status in ('draft', 'archived'));

alter table public.estimates
  drop column if exists approval_requested_at,
  drop column if exists approval_requested_by,
  drop column if exists approved_at,
  drop column if exists approved_by,
  drop column if exists rejected_at,
  drop column if exists rejected_by,
  drop column if exists approval_comment;
