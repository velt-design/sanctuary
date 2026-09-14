import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function readDeliveryCompletion(supabase: SupabaseClient, projectId: string) {
  const [project, schedule, events, financial] = await Promise.all([
    supabase.from('projects').select('id,pipeline_stage,archived_at').eq('id', projectId).single(),
    supabase.from('scheduled_jobs').select('id,status,actual_finish').eq('job_id', projectId).maybeSingle(),
    supabase.from('project_confirmation_events').select('id,event_kind,retracts_event_id,occurred_at,delivery_details')
      .eq('project_id', projectId).eq('confirmation_type', 'DELIVERY_COMPLETED'),
    supabase.rpc('commercial_project_financial_truth', { p_project_id: projectId }),
  ]);
  for (const result of [project, schedule, events, financial]) if (result.error) throw result.error;
  const rows = events.data ?? [];
  const retracted = new Set(rows.map((row) => row.retracts_event_id).filter(Boolean));
  const manual = rows.find((row) => row.event_kind === 'CONFIRMED' && !retracted.has(row.id));
  const completed = schedule.data
    ? schedule.data.status === 'done' && Boolean(schedule.data.actual_finish)
    : Boolean(manual);
  const truth = Array.isArray(financial.data) ? financial.data[0] : financial.data;
  const blockers: string[] = [];
  if (!completed) blockers.push('Delivery has not been confirmed.');
  if (Number(truth?.accepted_total_inc_gst_cents ?? 0) <= 0) blockers.push('No current billable project value.');
  if (Number(truth?.open_invoice_inc_gst_cents ?? 0) > 0) blockers.push('Open invoices remain unpaid.');
  if (Number(truth?.paid_inc_gst_cents ?? 0) < Number(truth?.accepted_total_inc_gst_cents ?? 0)) blockers.push('The project balance is not fully paid.');
  return {
    scheduled: Boolean(schedule.data), completed, archived: Boolean(project.data?.archived_at),
    completedDate: schedule.data?.actual_finish ?? (manual?.occurred_at
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date(manual.occurred_at))
      : null),
    confirmationId: manual?.id ?? null, closureBlockers: blockers,
  };
}
