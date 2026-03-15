insert into public.schedule_crews (name, color, sort_order, short_code)
select 'Jayden', '#7A3B3B', 1, 'JW'
where not exists (select 1 from public.schedule_crews);

insert into public.schedule_crews (name, color, sort_order, short_code)
select 'David', '#1F6E8C', 2, 'DH'
where not exists (select 1 from public.schedule_crews where name='David');

insert into public.schedule_crews (name, color, sort_order, short_code)
select 'Alistair', '#2A9D8F', 3, 'AW'
where not exists (select 1 from public.schedule_crews where name='Alistair');

insert into public.schedule_crews (name, color, sort_order, short_code)
select 'Eder', '#E09F3E', 4, null
where not exists (select 1 from public.schedule_crews where name='Eder');

insert into public.schedule_crews (name, color, sort_order, short_code)
select 'Jesse', '#6D597A', 5, 'JI'
where not exists (select 1 from public.schedule_crews where name='Jesse');

select pg_notify('pgrst', 'reload schema');
