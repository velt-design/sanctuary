-- Disposable fixtures only; contacts retain canonical identity across project contexts.
begin;
insert into public.contacts(id, name, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000099', 'Unrelated contact', now(), now());
insert into public.projects(id, contact_id, name, pipeline_stage, version, created_at, updated_at)
select '10000000-0000-4000-8000-000000000002', contact_id, 'Shared-contact project',
  pipeline_stage, version, created_at, updated_at
from public.projects where id = '10000000-0000-4000-8000-000000000001';

set local role sanctuary_praxis_reader;
do $$
declare requested_project uuid; requested_resource text; canonical_contact record; contextual_contact record;
begin
  select * into strict canonical_contact from praxis_reporting.contacts_v1
    where id = '00000000-0000-4000-8000-000000000001';
  if canonical_contact.project_id is not null or canonical_contact.parent_id is not null then
    raise exception 'Canonical contact acquired project ownership';
  end if;
  foreach requested_project in array array[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid
  ] loop
    foreach requested_resource in array array['all', 'contact'] loop
      select * into strict contextual_contact from praxis_reporting.context_page_v1(
        requested_resource, requested_project, null, now() + interval '1 minute', null, null, null, 100
      ) where resource = 'contact';
      if contextual_contact.project_id is distinct from requested_project
         or (to_jsonb(contextual_contact) - 'project_id') is distinct from (to_jsonb(canonical_contact) - 'project_id') then
        raise exception 'Linked contact context or canonical evidence changed';
      end if;
      if exists (select 1 from praxis_reporting.context_page_v1(
        requested_resource, requested_project, null, now() + interval '1 minute', null, null, null, 100
      ) where project_id is distinct from requested_project
        or (resource = 'contact' and id <> canonical_contact.id)) then
        raise exception 'Unrelated record escaped the exact project scope';
      end if;
      if requested_resource = 'contact' and (select count(*) from praxis_reporting.context_page_v1(
        requested_resource, requested_project, null, now() + interval '1 minute', null, null, null, 100
      )) <> 1 then raise exception 'Contact-only scope duplicated or lost its linked contact'; end if;
    end loop;
  end loop;
  if (select count(*) from praxis_reporting.context_page_v1(
    'contact', null, null, now() + interval '1 minute', null, null, null, 100
  ) where id = canonical_contact.id and project_id is null) <> 1 then
    raise exception 'Global contact semantics changed';
  end if;
  if (select count(distinct resource) from praxis_reporting.context_page_v1(
    'all', null, null, now() + interval '1 minute', null, null, null, 100
  )) <> 12 then raise exception 'Full context lost a resource'; end if;
  if exists (select 1 from praxis_reporting.context_page_v1(
    'all', '10000000-0000-4000-8000-000000000099', null, now() + interval '1 minute', null, null, null, 100
  )) then raise exception 'Nonexistent project returned records'; end if;
  if exists (select 1 from praxis_reporting.context_page_v1(
    'all', '10000000-0000-4000-8000-000000000001', null, '1970-01-01', null, null, null, 100
  )) then raise exception 'Project context ignored as-of'; end if;
  if (select count(*) from praxis_reporting.context_page_v1(
    'all', '10000000-0000-4000-8000-000000000001', null, now() + interval '1 minute', null, null, null, 1
  )) <> 1 then raise exception 'Project context ignored its row limit'; end if;
end;
$$;
rollback;
