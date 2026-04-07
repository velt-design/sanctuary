-- Portal security hardening:
-- - remove legacy blanket anon/authenticated table grants
-- - reassert RLS across app-owned public tables
-- - keep enquiry_requests service-only
-- - revoke anon execute on staff-only schedule RPCs

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array ARRAY[
    'audit_events',
    'company_closures',
    'contacts',
    'crew_downtimes',
    'crew_schedule_items',
    'deposit_invoice_send_logs',
    'deposit_invoices',
    'design_package_requests',
    'design_package_tickets',
    'email_outbox',
    'email_templates',
    'enquiry_requests',
    'estimates',
    'file_artifacts',
    'followup_plans',
    'followup_tasks',
    'install_action_minutes_overrides',
    'install_driver_curve_overrides',
    'job_pack_generations',
    'job_pack_sheet_overrides',
    'material_cost_overrides',
    'nz_holidays',
    'planned_commitment_history',
    'portal_user_theme_presets',
    'portal_user_theme_settings',
    'portal_users',
    'project_running_job_meta',
    'project_task_checks',
    'projects',
    'quote_line_items',
    'quote_send_logs',
    'quote_versions',
    'quotes',
    'running_job_legacy_import_batches',
    'running_job_legacy_rows',
    'schedule_crews',
    'schedule_events',
    'schedule_items',
    'scheduled_jobs',
    'site_visit_events',
    'tasks'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('revoke all on table public.%I from anon', tbl);
      execute format('revoke all on table public.%I from authenticated', tbl);
    end if;
  end loop;
end $$;

do $$
declare
  tbl text;
begin
  foreach tbl in array ARRAY[
    'audit_events',
    'company_closures',
    'contacts',
    'crew_downtimes',
    'crew_schedule_items',
    'deposit_invoice_send_logs',
    'deposit_invoices',
    'design_package_requests',
    'design_package_tickets',
    'email_outbox',
    'email_templates',
    'estimates',
    'file_artifacts',
    'followup_plans',
    'followup_tasks',
    'install_action_minutes_overrides',
    'install_driver_curve_overrides',
    'job_pack_generations',
    'job_pack_sheet_overrides',
    'material_cost_overrides',
    'nz_holidays',
    'planned_commitment_history',
    'project_running_job_meta',
    'project_task_checks',
    'projects',
    'quote_line_items',
    'quote_send_logs',
    'quote_versions',
    'quotes',
    'running_job_legacy_import_batches',
    'running_job_legacy_rows',
    'schedule_crews',
    'schedule_events',
    'schedule_items',
    'scheduled_jobs',
    'site_visit_events',
    'tasks'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);
      execute format('alter table public.%I enable row level security', tbl);
      execute format('drop policy if exists portal_access_all on public.%I', tbl);
      execute format(
        'create policy portal_access_all on public.%I for all using (public.has_portal_access()) with check (public.has_portal_access())',
        tbl
      );
    end if;
  end loop;
end $$;

alter table if exists public.portal_users enable row level security;
grant select on table public.portal_users to authenticated;

alter table if exists public.portal_user_theme_settings enable row level security;
grant select, insert, update on table public.portal_user_theme_settings to authenticated;

alter table if exists public.portal_user_theme_presets enable row level security;
grant select, insert, update, delete on table public.portal_user_theme_presets to authenticated;

alter table if exists public.enquiry_requests enable row level security;
revoke all on table public.enquiry_requests from authenticated;
drop policy if exists portal_access_all on public.enquiry_requests;

revoke execute on function public.schedule_v2_reorder_queue(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_reorder_queue(uuid, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_set_days_remaining(uuid, integer, jsonb) from public, anon;
grant execute on function public.schedule_v2_set_days_remaining(uuid, integer, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_unassign_job(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_unassign_job(uuid, uuid, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_delete_downtime(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_delete_downtime(uuid, uuid, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_mark_done(uuid, date, date, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_mark_done(uuid, date, date, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_assign_job(uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_assign_job(uuid, integer, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_create_downtime(uuid, integer, text, text, integer, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_create_downtime(uuid, integer, text, text, integer, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_update_downtime(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_update_downtime(uuid, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_apply_job_patch(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_apply_job_patch(uuid, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_apply_commitment(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_apply_commitment(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.schedule_v2_ack_client_update(uuid, timestamptz, text) from public, anon;
grant execute on function public.schedule_v2_ack_client_update(uuid, timestamptz, text) to authenticated, service_role;

notify pgrst, 'reload schema';
