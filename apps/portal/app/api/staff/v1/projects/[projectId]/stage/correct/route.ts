import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { PIPELINE_STAGES } from '@/lib/projects/pipelineDefinition';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const STAGE_ORDER = PIPELINE_STAGES.map((stage) => stage.key.toUpperCase());

function normaliseStage(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!raw) return null;
  return STAGE_ORDER.includes(raw) ? raw : null;
}

async function parseOptionalJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const body = await parseOptionalJson(req);
  const toStage = normaliseStage(body?.toStage ?? body?.stage);
  if (!toStage) return jsonError('Invalid toStage', 400);

  let projectUuid: string;
  let projectAppId: string;
  try {
    const params = await ctx.params;
    projectAppId = params.projectId;
    projectUuid = uuidFromAppId(projectAppId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prevRes = await supabase
    .from('projects')
    .select('id, pipeline_stage, name')
    .eq('id', projectUuid)
    .single();
  if (prevRes.error || !prevRes.data) return jsonError('Project not found', 404);

  const fromStage = normaliseStage(prevRes.data.pipeline_stage) ?? 'NEW';
  const fromIndex = STAGE_ORDER.indexOf(fromStage);
  const toIndex = STAGE_ORDER.indexOf(toStage);
  const rollback = fromIndex !== -1 && toIndex !== -1 && toIndex < fromIndex;

  const updatePayload: Record<string, unknown> = { pipeline_stage: toStage };
  if (toStage === 'SITE_VISIT') {
    const tierRaw = body?.site_visit_priority_tier ?? body?.siteVisitPriorityTier ?? null;
    const siteVisitTier = tierRaw === 1 || tierRaw === '1' ? 1 : tierRaw === 2 || tierRaw === '2' ? 2 : null;
    if (siteVisitTier) updatePayload.site_visit_priority_tier = siteVisitTier;
  }

  const updateRes = await supabase
    .from('projects')
    .update(updatePayload as any)
    .eq('id', projectUuid)
    .select('*')
    .single();
  if (updateRes.error || !updateRes.data) {
    return jsonError(updateRes.error?.message ?? 'Failed to update project stage', 500);
  }

  const reasonRaw = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const auditRes = await supabase.from('audit_events').insert({
    project_id: projectUuid,
    type: 'project.stage_corrected',
    idempotency_key: `project.stage_corrected:${projectUuid}:${crypto.randomUUID()}`,
    payload: {
      projectId: projectAppId,
      fromStage,
      toStage,
      rollback,
      reason: reasonRaw || null,
      silent: true,
      actorUserId: auth.session.user.id,
      correctedAt: new Date().toISOString(),
    },
  });
  if (auditRes.error) {
    console.error('[project_stage_corrected] failed to insert audit event', auditRes.error);
  }

  return jsonOk({
    project: updateRes.data,
    rollback,
    silent: true,
  });
}
