import 'server-only';

import { portalTodayYmd } from '@/lib/format/portalDateTime';
import { portalDueDateToIso } from '@/lib/projects/commandCentre/actionResolver';
import { isProjectWorkModelV2 } from '@/lib/projects/workItems/modelBoundary';
import { addDaysYmd } from '@/lib/scheduling/date';
import { buildWorkingDayIndex, nextWorkingDay } from '@/lib/scheduling/workingDays';
import { supabaseServiceRole } from '@/lib/supabaseClient';

type AutomationTaskType =
  | 'CREATE_DESIGN_PACKAGE'
  | 'REVIEW_NEW_LEAD'
  | 'BOOK_SITE_VISIT'
  | 'ATTEND_SITE_VISIT'
  | 'FINALIZE_SEND_QUOTE'
  | 'FOLLOWUP_CALL'
  | 'FOLLOWUP_EMAIL'
  | 'SCHEDULE_INSTALL_WINDOW'
  | 'UPLOAD_COMPLETION_PHOTOS';

function isUniqueViolation(error: unknown): boolean {
  const raw = error as { code?: unknown; message?: unknown };
  return raw?.code === '23505' || (typeof raw?.message === 'string' && /duplicate|unique/i.test(raw.message));
}

export async function nextPortalBusinessDueAt(days: number, from = new Date()): Promise<string> {
  const [holidayResult, closureResult] = await Promise.all([
    supabaseServiceRole.from('nz_holidays').select('date,name,scope,region'),
    supabaseServiceRole.from('company_closures').select('date,name,region'),
  ]);
  if (holidayResult.error) throw holidayResult.error;
  if (closureResult.error) throw closureResult.error;
  const calendar = buildWorkingDayIndex(holidayResult.data ?? [], closureResult.data ?? []);
  let dueDate = portalTodayYmd(from);
  for (let index = 0; index < Math.max(1, Math.trunc(days)); index += 1) {
    dueDate = nextWorkingDay(addDaysYmd(dueDate, 1), 'Auckland', calendar);
  }
  const dueAt = portalDueDateToIso(dueDate);
  if (!dueAt) throw new Error('Failed to resolve Auckland business due date');
  return dueAt;
}

export async function upsertAutomationTask(params: {
  projectId: string;
  type: AutomationTaskType;
  title: string;
  dueAt?: string | null;
  details?: string | null;
  meta?: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  if (await isProjectWorkModelV2(supabaseServiceRole, params.projectId)) return;
  const { error } = await supabaseServiceRole.from('tasks').upsert({
    project_id: params.projectId,
    type: params.type,
    status: 'OPEN',
    title: params.title,
    due_at: params.dueAt ?? null,
    details: params.details ?? null,
    meta: params.meta ?? {},
    idempotency_key: params.idempotencyKey,
    updated_at: new Date().toISOString(),
  } as any, { onConflict: 'idempotency_key' });
  if (error) throw error;
}

export async function insertAutomationFollowupTask(params: {
  planId: string;
  projectId: string;
  type: 'FOLLOWUP_CALL' | 'FOLLOWUP_EMAIL';
  dueAt: string;
  idempotencyKey: string;
}): Promise<void> {
  if (await isProjectWorkModelV2(supabaseServiceRole, params.projectId)) return;
  const { error } = await supabaseServiceRole.from('followup_tasks').insert({
    plan_id: params.planId,
    project_id: params.projectId,
    type: params.type,
    status: 'OPEN',
    due_at: params.dueAt,
    idempotency_key: params.idempotencyKey,
  } as any);
  if (!error || isUniqueViolation(error)) return;
  throw error;
}
