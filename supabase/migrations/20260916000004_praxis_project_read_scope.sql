-- Filter each source by project before combining expensive safe payloads.
begin;
create or replace function praxis_reporting.context_page_v1(
  p_resource text,
  p_project_id uuid,
  p_changed_after timestamptz,
  p_as_of timestamptz,
  p_after_recorded_at timestamptz,
  p_after_resource text,
  p_after_id uuid,
  p_limit integer
)
returns table (
  resource text,
  id uuid,
  project_id uuid,
  parent_id uuid,
  recorded_at timestamptz,
  record_version text,
  payload jsonb,
  policy_version text,
  redaction_count integer,
  omission_count integer,
  redaction_categories text[]
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_resource not in (
    'all', 'enquiry_request', 'contact', 'project', 'estimate', 'quote',
    'quote_version', 'quote_line_item', 'invoice', 'invoice_plan_item',
    'payment', 'payment_allocation', 'project_financial_truth'
  ) then
    raise exception 'unsupported resource' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 101 then
    raise exception 'limit must be between 1 and 101' using errcode = '22023';
  end if;
  if p_as_of is null then
    raise exception 'as-of timestamp is required' using errcode = '22023';
  end if;
  if num_nonnulls(p_after_recorded_at, p_after_resource, p_after_id) not in (0, 3) then
    raise exception 'cursor components must be supplied together' using errcode = '22023';
  end if;

  return query
  with records as (
    select * from praxis_reporting.enquiry_requests_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.contacts_v1 scoped where p_project_id is null or scoped.id in (select project.parent_id from praxis_reporting.projects_v1 project where project.id=p_project_id)
    union all select * from praxis_reporting.projects_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.estimates_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.quotes_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.quote_versions_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.quote_line_items_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.invoices_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.invoice_plan_items_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.payments_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.payment_allocations_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
    union all select * from praxis_reporting.project_financial_truth_v1 scoped where p_project_id is null or scoped.project_id=p_project_id
  )
  select row.resource, row.id, row.project_id, row.parent_id,
    row.recorded_at, row.record_version, row.payload, row.policy_version,
    row.redaction_count, row.omission_count, row.redaction_categories
  from records row
  where (p_resource = 'all' or row.resource = p_resource)
    and row.recorded_at <= p_as_of
    and (p_changed_after is null or row.recorded_at > p_changed_after)
    and (
      p_project_id is null
      or row.project_id = p_project_id
      or (
        row.resource = 'contact'
        and exists (
          select 1 from praxis_reporting.projects_v1 project
          where project.id = p_project_id
            and project.parent_id = row.id
        )
      )
    )
    and (
      p_after_recorded_at is null
      or (row.recorded_at, row.resource, row.id)
        > (p_after_recorded_at, p_after_resource, p_after_id)
    )
  order by row.recorded_at, row.resource, row.id
  limit p_limit;
end;
$$;
commit;


