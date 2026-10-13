begin;
-- Synthetic raw-fact fixtures. Disable only this disposable seed transaction's
-- business triggers; restore origin before all application/role read tests.
set local session_replication_role = replica;
insert into public.projects(id,name,pipeline_stage,archived_at)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'Native queue fixture '||n, case when n=1 then 'SITE_VISIT' else 'QUOTING' end,
  case when n=4 then '2026-01-01T00:00:00Z'::timestamptz else null end
from generate_series(1,6) n;
insert into public.project_work_model_versions(project_id,model_version,reason)
select id,2,'REVIEWED_MIGRATION' from public.projects where id <> '20000000-0000-4000-8000-000000000005';
insert into public.project_operational_states(project_id,state,waiting_until,waiting_reason,closed_outcome)
select id,case when id::text like '%000002' then 'WAITING' when id::text like '%000003' then 'CLOSED' else 'ACTIVE' end,
  case when id::text like '%000002' then '2027-01-01T00:00:00Z'::timestamptz else null end,
  case when id::text like '%000002' then 'Synthetic wait' else null end,
  case when id::text like '%000003' then 'CANCELLED' else null end
from public.projects where id <> '20000000-0000-4000-8000-000000000006';
insert into public.project_owner_assignments(project_id,owner_key)
values ('20000000-0000-4000-8000-000000000001','jordan');
insert into public.estimates(id,project_id,created_at,status,version) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-01-01','draft',1),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','2026-01-02','archived',2);
insert into public.quotes(id,project_id,quote_ref) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','SYNTHETIC-1');
insert into public.quote_versions(id,quote_id,version_number,status,source_estimate_version_id,created_at,sent_at,total_inc_gst_cents) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,'SENT','30000000-0000-4000-8000-000000000001','2026-01-01','2026-01-02',120000),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',2,'DECLINED','30000000-0000-4000-8000-000000000002','2026-01-03','2026-01-04',125000);
insert into public.quote_send_logs(id,project_id,quote_version_id,status,created_at,sent_at) values
('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','FAILED','2026-01-01',null),
('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','SENT','2026-01-02','2026-01-02');
insert into public.project_confirmation_events(id,project_id,command_id,event_kind,confirmation_type,occurred_at,reason) values
('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','CONFIRMED','SITE_VISIT_COMPLETED','2026-01-01',null);
insert into public.project_confirmation_events(id,project_id,command_id,event_kind,confirmation_type,retracts_event_id,occurred_at,reason) values
('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','RETRACTED','SITE_VISIT_COMPLETED','70000000-0000-4000-8000-000000000001','2026-01-02','Synthetic retraction fixture');
set local session_replication_role = origin;
commit;
