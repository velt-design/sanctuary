-- Seed default schedule crews (run after supabase/schedule.sql).

insert into public.schedule_crews (name, color, sort_order)
select 'Jayden', '#7A3B3B', 1
where not exists (select 1 from public.schedule_crews);

insert into public.schedule_crews (name, color, sort_order)
select 'David', '#1F6E8C', 2
where not exists (select 1 from public.schedule_crews where name='David');

insert into public.schedule_crews (name, color, sort_order)
select 'Alistair', '#2A9D8F', 3
where not exists (select 1 from public.schedule_crews where name='Alistair');

insert into public.schedule_crews (name, color, sort_order)
select 'Eder', '#E09F3E', 4
where not exists (select 1 from public.schedule_crews where name='Eder');

insert into public.schedule_crews (name, color, sort_order)
select 'Jesse', '#6D597A', 5
where not exists (select 1 from public.schedule_crews where name='Jesse');

select pg_notify('pgrst', 'reload schema');
