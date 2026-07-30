import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { POST as confirmScheduleActionRoute } from '@/app/api/staff/v1/projects/[projectId]/action/confirm_schedule/route';
import { POST as markCompletedActionRoute } from '@/app/api/staff/v1/projects/[projectId]/action/mark_completed/route';
import { POST as markDepositReceivedActionRoute } from '@/app/api/staff/v1/projects/[projectId]/action/mark_deposit_received/route';
import { POST as markPaidActionRoute } from '@/app/api/staff/v1/projects/[projectId]/action/mark_paid/route';
import { POST as assignScheduleJobRoute } from '@/app/api/staff/v1/schedule/job/assign/route';
import { POST as markScheduleJobDoneRoute } from '@/app/api/staff/v1/schedule/job/mark-done/route';
import { POST as markScheduleJobInProgressRoute } from '@/app/api/staff/v1/schedule/job/mark-in-progress/route';
import { POST as pinScheduleJobRoute } from '@/app/api/staff/v1/schedule/job/pin/route';
import { POST as setScheduleDurationRoute } from '@/app/api/staff/v1/schedule/job/set-duration/route';
import { isMissingColumnError, missingColumnFromError, salespersonSchemaMismatchMessage } from '@/lib/api/siteVisitsServer';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { SALES_PEOPLE } from '@/src/config/salesPeople';
import { getRunningJobCellEditability, type NormalizedRunningJobCellValue } from './editing';
import { loadRunningJobRow } from './server';
import type { RunningJobCellMutationResponse, RunningJobEditableCellKey, RunningJobRow } from './types';

class RouteInvocationError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'RouteInvocationError';
    this.status = status;
    this.body = body;
  }
}

class RunningJobFactConflictError extends Error {
  constructor(message = 'Running-job facts changed before this save completed.') {
    super(message);
    this.name = 'RunningJobFactConflictError';
  }
}

type RouteHandler = (...args: any[]) => Promise<Response>;

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function callRoute(handler: RouteHandler, body?: Record<string, unknown>, ctx?: any): Promise<any> {
  const req = new Request('http://localhost/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : null),
  });

  const res = ctx === undefined ? await handler(req) : await handler(req, ctx);
  const payload = await parseJsonSafe(res);
  if (!res.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Request failed (${res.status})`;
    throw new RouteInvocationError(message, res.status, payload);
  }
  return payload;
}

async function refreshRow(projectUuid: string): Promise<RunningJobRow> {
  const row = await loadRunningJobRow(projectUuid);
  if (!row) throw new Error('Running job row disappeared after save.');
  return row;
}

async function updateContactField(contactId: string | null, patch: { name?: string; phone?: string }) {
  if (!contactId) throw new Error('This project does not have a linked contact.');
  const supabase = await getSupabaseServerAuth();
  const contactUuid = uuidFromAppId(contactId, 'ct');
  const payload: Record<string, unknown> = {
    ...(typeof patch.name === 'string' ? { name: patch.name.trim() || null } : null),
    ...(typeof patch.phone === 'string' ? { phone: patch.phone.trim() || null } : null),
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('contacts').update(payload as any).eq('id', contactUuid).select('id').maybeSingle();
  if (res.error) throw new Error(res.error.message ?? 'Failed to update contact.');
}

async function updateProjectField(projectUuid: string, patch: Record<string, unknown>) {
  const supabase = await getSupabaseServerAuth();
  const res = await supabase.from('projects').update(patch as any).eq('id', projectUuid).select('id').maybeSingle();
  if (res.error) throw new Error(res.error.message ?? 'Failed to update project.');
}

async function upsertRunningJobMeta(projectUuid: string, patch: Record<string, unknown>) {
  const supabase = await getSupabaseServerAuth();
  const payload = { project_id: projectUuid, ...patch };
  const res = await supabase.from('project_running_job_meta').upsert(payload as any, { onConflict: 'project_id' }).select('project_id').maybeSingle();
  if (res.error) throw new Error(res.error.message ?? 'Failed to update running-job metadata.');
}

function isRunningJobFactConflict(error: unknown): boolean {
  const raw = error as { code?: unknown; message?: unknown; details?: unknown };
  const text = [raw?.message, raw?.details]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return raw?.code === '40001'
    || raw?.code === 'P0001' && /conflict|stale|row.?version/.test(text)
    || /running.job.*(?:conflict|stale)|stale.*running.job|row.?version.*(?:conflict|stale)/.test(text);
}

async function setRunningJobFact(input: {
  projectUuid: string;
  fact: 'materials_ordered' | 'roofing_ordered';
  value: boolean;
  expectedRowVersion: number;
}) {
  const supabase = await getSupabaseServerAuth();
  const result = await supabase.rpc('project_running_job_fact_command', {
    p_project_id: input.projectUuid,
    p_command_id: randomUUID(),
    p_fact: input.fact,
    p_value: input.value,
    p_expected_row_version: input.expectedRowVersion,
  });
  if (!result.error) return;
  if (isRunningJobFactConflict(result.error)) throw new RunningJobFactConflictError();
  throw new Error(result.error.message ?? 'Failed to update running-job fact.');
}

async function updateSiteVisitRep(projectUuid: string, salespersonId: string | null) {
  const supabase = await getSupabaseServerAuth();
  const existingRes = await supabase
    .from('site_visit_events')
    .select('id')
    .eq('project_id', projectUuid)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingRes.error) throw new Error(existingRes.error.message ?? 'Failed to load site visit.');

  const patch: Record<string, unknown> = {
    assigned_sales_owner_id: salespersonId,
    assigned_sales_owner: salespersonId,
  };

  if (existingRes.data?.id) {
    const updatePayload = { ...patch };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const updateRes = await supabase.from('site_visit_events').update(updatePayload as any).eq('id', existingRes.data.id);
      if (!updateRes.error) return;
      if (isMissingColumnError(updateRes.error)) {
        const missing = missingColumnFromError(updateRes.error);
        if (missing && missing in updatePayload) {
          delete updatePayload[missing];
          continue;
        }
        delete updatePayload.assigned_sales_owner_id;
        delete updatePayload.assigned_sales_owner;
        continue;
      }
      const schemaMsg = salespersonSchemaMismatchMessage(updateRes.error);
      throw new Error(schemaMsg ?? updateRes.error.message ?? 'Failed to update site visit.');
    }
    throw new Error('Failed to update site visit after retries.');
  }

  const insertPayload: Record<string, unknown> = {
    project_id: projectUuid,
    status: 'UNSCHEDULED',
    ...patch,
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const insertRes = await supabase.from('site_visit_events').insert(insertPayload as any);
    if (!insertRes.error) return;
    if (isMissingColumnError(insertRes.error)) {
      const missing = missingColumnFromError(insertRes.error);
      if (missing && missing in insertPayload) {
        delete insertPayload[missing];
        continue;
      }
      delete insertPayload.assigned_sales_owner_id;
      delete insertPayload.assigned_sales_owner;
      continue;
    }
    const schemaMsg = salespersonSchemaMismatchMessage(insertRes.error);
    throw new Error(schemaMsg ?? insertRes.error.message ?? 'Failed to create site visit.');
  }
  throw new Error('Failed to create site visit after retries.');
}

async function ensureCrewExists(crewId: string) {
  const supabase = await getSupabaseServerAuth();
  const crewRes = await supabase.from('schedule_crews').select('id').eq('id', crewId).maybeSingle();
  if (crewRes.error) throw new Error(crewRes.error.message ?? 'Failed to load crew.');
  if (!crewRes.data) throw new Error('Crew not found.');
}

async function maybeAdvanceToDeposit(projectId: string, beforeRow: RunningJobRow, value: NormalizedRunningJobCellValue) {
  if (beforeRow.stage === 'SENT' && typeof value === 'string' && value) {
    await callRoute(markDepositReceivedActionRoute, undefined, { params: Promise.resolve({ projectId }) });
  }
}

async function maybeAdvanceToPaid(projectId: string, beforeRow: RunningJobRow, value: NormalizedRunningJobCellValue) {
  if (beforeRow.stage === 'COMPLETED' && typeof value === 'string' && value) {
    await callRoute(markPaidActionRoute, undefined, { params: Promise.resolve({ projectId }) });
  }
}

async function maybeAdvanceToScheduled(projectId: string, projectUuid: string) {
  const nextRow = await refreshRow(projectUuid);
  if (nextRow.stage === 'DEPOSIT' && nextRow.state.hasCrewAssigned && nextRow.state.hasEstimatedStartDate) {
    await callRoute(confirmScheduleActionRoute, undefined, { params: Promise.resolve({ projectId }) });
  }
}

async function maybeAdvanceToCompleted(projectId: string, beforeRow: RunningJobRow) {
  if (beforeRow.stage === 'SCHEDULED') {
    await callRoute(markCompletedActionRoute, undefined, {
      params: Promise.resolve({ projectId }),
    });
  }
}

async function runScheduleMutation(
  key: RunningJobEditableCellKey,
  projectUuid: string,
  value: NormalizedRunningJobCellValue,
  opts: { force?: boolean; finishEarlyAction?: 'pull_forward' | 'keep_schedule' },
) {
  switch (key) {
    case 'job_assigned_to':
      return callRoute(assignScheduleJobRoute, {
        job_id: projectUuid,
        crew_id: value,
        position: 9999,
        force: Boolean(opts.force),
      });
    case 'estimated_start_date':
      return callRoute(pinScheduleJobRoute, {
        job_id: projectUuid,
        requested_start_date: value,
        force: Boolean(opts.force),
      });
    case 'install_days':
      return callRoute(setScheduleDurationRoute, {
        job_id: projectUuid,
        forecast_duration_days: value,
        force: Boolean(opts.force),
      });
    case 'job_completed':
      if (value) {
        return callRoute(markScheduleJobDoneRoute, {
          job_id: projectUuid,
          force: Boolean(opts.force),
          ...(opts.finishEarlyAction ? { finish_early_action: opts.finishEarlyAction } : null),
        });
      }
      return callRoute(markScheduleJobInProgressRoute, {
        job_id: projectUuid,
        force: Boolean(opts.force),
      });
    default:
      throw new Error(`Unsupported schedule mutation for ${key}.`);
  }
}

export async function applyRunningJobCellMutation(input: {
  projectId: string;
  projectUuid: string;
  actorUserId: string;
  currentRow: RunningJobRow;
  key: RunningJobEditableCellKey;
  value: NormalizedRunningJobCellValue;
  force?: boolean;
  finishEarlyAction?: 'pull_forward' | 'keep_schedule';
}): Promise<RunningJobCellMutationResponse> {
  const editability = getRunningJobCellEditability(input.currentRow, input.key);
  if (!editability.editable) throw new Error(editability.reason ?? 'This cell is not editable.');
  if (!input.actorUserId) throw new Error('A staff actor is required.');
  const isV2WorkModel = input.currentRow.state.workModelVersion === 2;
  switch (input.key) {
    case 'client_name':
      await updateContactField(input.currentRow.contactId, { name: String(input.value ?? '') });
      break;
    case 'phone_number':
      await updateContactField(input.currentRow.contactId, { phone: typeof input.value === 'string' ? input.value : '' });
      break;
    case 'site_address':
      await updateProjectField(input.projectUuid, { site_address: input.value });
      break;
    case 'site_visit_rep':
      if (typeof input.value === 'string' && input.value && !SALES_PEOPLE.some((person) => person.id === input.value)) {
        throw new Error('Salesperson not found.');
      }
      await updateSiteVisitRep(input.projectUuid, typeof input.value === 'string' ? input.value : null);
      break;
    case 'deposit_paid_date':
      await updateProjectField(input.projectUuid, { deposit_paid_date: input.value });
      await maybeAdvanceToDeposit(input.projectId, input.currentRow, input.value);
      break;
    case 'materials_ordered':
      await setRunningJobFact({
        projectUuid: input.projectUuid,
        fact: 'materials_ordered',
        value: Boolean(input.value),
        expectedRowVersion: input.currentRow.state.meta.rowVersion,
      });
      break;
    case 'final_payment_date':
      await updateProjectField(input.projectUuid, { final_payment_date: input.value });
      await maybeAdvanceToPaid(input.projectId, input.currentRow, input.value);
      break;
    case 'lights_status':
      await upsertRunningJobMeta(input.projectUuid, { lights_status: input.value });
      break;
    case 'roofing_ordered':
      await setRunningJobFact({
        projectUuid: input.projectUuid,
        fact: 'roofing_ordered',
        value: Boolean(input.value),
        expectedRowVersion: input.currentRow.state.meta.rowVersion,
      });
      break;
    case 'running_notes':
      await upsertRunningJobMeta(input.projectUuid, { notes: input.value });
      break;
    case 'job_assigned_to':
      if (typeof input.value !== 'string' || !input.value) throw new Error('Crew is required.');
      await ensureCrewExists(input.value);
      {
        const scheduleRes = await runScheduleMutation(input.key, input.projectUuid, input.value, input);
        if (scheduleRes?.requires_confirmation || scheduleRes?.requires_finish_early) return scheduleRes;
      }
      await maybeAdvanceToScheduled(input.projectId, input.projectUuid);
      break;
    case 'estimated_start_date':
    case 'install_days':
      {
        const scheduleRes = await runScheduleMutation(input.key, input.projectUuid, input.value, input);
        if (scheduleRes?.requires_confirmation || scheduleRes?.requires_finish_early) return scheduleRes;
      }
      if (input.key === 'estimated_start_date') {
        await maybeAdvanceToScheduled(input.projectId, input.projectUuid);
      }
      break;
    case 'job_completed':
      {
        const scheduleRes = await runScheduleMutation(input.key, input.projectUuid, Boolean(input.value), input);
        if (scheduleRes?.requires_confirmation || scheduleRes?.requires_finish_early) return scheduleRes;
        if (!isV2WorkModel && input.value) {
          await maybeAdvanceToCompleted(input.projectId, input.currentRow);
        }
      }
      break;
    default: {
      const exhaustive: never = input.key;
      throw new Error(`Unsupported cell ${exhaustive}`);
    }
  }

  return {
    ok: true,
    updatedRow: await refreshRow(input.projectUuid),
  };
}

export { RouteInvocationError, RunningJobFactConflictError };
