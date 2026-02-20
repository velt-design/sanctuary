alter table if exists public.quote_versions
  add column if not exists customer_name text;

update public.quote_versions qv
set customer_name = c.name
from public.quotes q
join public.projects p on p.id = q.project_id
left join public.contacts c on c.id = p.contact_id
where qv.quote_id = q.id
  and (qv.customer_name is null or btrim(qv.customer_name) = '')
  and c.name is not null
  and btrim(c.name) <> '';

select pg_notify('pgrst', 'reload schema');
