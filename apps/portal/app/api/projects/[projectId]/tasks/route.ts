import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { getTaskDefinition } from '@/lib/projects/pipelineDefinition';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const res = await supabaseServer.from('project_task_checks').select('task_key').eq('project_id', projectUuid);
  if (res.error) return jsonError(res.error.message ?? 'Failed to load tasks', 500);

  const completed = new Set<string>();
  for (const row of Array.isArray(res.data) ? res.data : []) {
    const key = typeof (row as any)?.task_key === 'string' ? String((row as any).task_key) : '';
    const def = getTaskDefinition(key);
    if (def && def.kind === 'manual') completed.add(def.key);
  }

  return jsonOk({ completed: Array.from(completed) });
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const taskKey = typeof body.taskKey === 'string' ? body.taskKey.trim() : '';
  const completed = body?.completed;

  if (!taskKey) return jsonError('taskKey is required', 400);
  if (typeof completed !== 'boolean') return jsonError('completed must be a boolean', 400);

  const definition = getTaskDefinition(taskKey);
  if (!definition) return jsonError('Invalid taskKey', 400);
  if (definition.kind !== 'manual') return jsonError('Action tasks cannot be manually completed', 400);
  if (definition.key === 'invoice_paid' && session.role !== 'admin') {
    return jsonError('Only admins can complete this task', 403);
  }

  if (definition.key === 'invoice_paid' && completed) {
    const prev = await supabaseServer.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
    if (prev.error || !prev.data) return jsonError('Project not found', 404);
    const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();
    if (fromStage !== 'SENT') return jsonError('Invalid stage transition (expected SENT)', 409);

    const openInvoiceRes = await supabaseServer
      .from('deposit_invoices')
      .select('id')
      .eq('project_id', projectUuid)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openInvoiceRes.error) return jsonError(openInvoiceRes.error.message ?? 'Failed to load deposit invoice', 500);
    if (!openInvoiceRes.data) return jsonError('No open deposit invoice found', 409);
  }

  if (completed) {
    const upsertRes = await supabaseServer.from('project_task_checks').upsert(
      {
        project_id: projectUuid,
        task_key: definition.key,
        completed_at: new Date().toISOString(),
        completed_by: null,
      },
      { onConflict: 'project_id,task_key' },
    );
    if (upsertRes.error) return jsonError(upsertRes.error.message ?? 'Failed to update task', 500);
  } else {
    const delRes = await supabaseServer
      .from('project_task_checks')
      .delete()
      .eq('project_id', projectUuid)
      .eq('task_key', definition.key);
    if (delRes.error) return jsonError(delRes.error.message ?? 'Failed to update task', 500);

    if (definition.key === 'order_materials') {
      const dependentRes = await supabaseServer
        .from('project_task_checks')
        .delete()
        .eq('project_id', projectUuid)
        .eq('task_key', 'job_complete');
      if (dependentRes.error) return jsonError(dependentRes.error.message ?? 'Failed to reset dependent task', 500);
    }
  }

  if (definition.key === 'invoice_paid' && completed) {
    const prev = await supabaseServer.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
    if (prev.error || !prev.data) return jsonError('Project not found', 404);
    const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();

    if (fromStage === 'SENT') {
      const updateRes = await supabaseServer
        .from('projects')
        .update({ pipeline_stage: 'DEPOSIT' } as any)
        .eq('id', projectUuid)
        .select('id, pipeline_stage')
        .single();
      if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update project stage', 500);

      await automationRunner.runEvent({
        type: 'pipeline.stage_changed',
        projectId: projectUuid,
        stage: 'DEPOSIT',
        payload: { fromStage: 'SENT', toStage: 'DEPOSIT', reason: 'invoice_paid' },
      });

      await automationRunner.runEvent({
        type: 'ui.action.mark_deposit_received',
        projectId: projectUuid,
        stage: 'DEPOSIT',
        payload: { source: 'task.invoice_paid' },
      });
    }
  }

  if (definition.key === 'confirm_schedule' && completed) {
    const prev = await supabaseServer.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
    if (prev.error || !prev.data) return jsonError('Project not found', 404);
    const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();

    if (fromStage === 'DEPOSIT') {
      const updateRes = await supabaseServer
        .from('projects')
        .update({ pipeline_stage: 'SCHEDULED' } as any)
        .eq('id', projectUuid)
        .select('id, pipeline_stage')
        .single();
      if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update project stage', 500);

      await automationRunner.runEvent({
        type: 'pipeline.stage_changed',
        projectId: projectUuid,
        stage: 'SCHEDULED',
        payload: { fromStage: 'DEPOSIT', toStage: 'SCHEDULED', reason: 'confirm_schedule' },
      });

      await automationRunner.runEvent({
        type: 'ui.action.confirm_schedule',
        projectId: projectUuid,
        stage: 'SCHEDULED',
        payload: {},
      });
    }
  }

  if (definition.key === 'reminder' && completed) {
    const projectPatch: Record<string, any> = {
      follow_up_date: null,
      next_action_date: null,
    };
    let payload = { ...projectPatch };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const updateRes = await supabaseServer.from('projects').update(payload).eq('id', projectUuid);
      if (!updateRes.error) break;
      const missing = missingColumnFromError(updateRes.error);
      if (missing && missing in payload) {
        delete payload[missing];
        if (!Object.keys(payload).length) break;
        continue;
      }
      return jsonError(updateRes.error.message ?? 'Failed to clear reminder date', 500);
    }
  }

  return jsonOk({ ok: true, taskKey: definition.key, completed });
}
