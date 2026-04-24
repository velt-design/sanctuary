import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const STAGES = new Set(['NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTING', 'SENT', 'DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID']);

function normaliseStage(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!raw) return null;
  return STAGES.has(raw) ? raw : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};
  const toStage = normaliseStage(body.toStage ?? body.stage);
  if (!toStage) return jsonError('Invalid toStage', 400);

  const reason = typeof body.reason === 'string' ? body.reason : null;
  const meta = body.meta ?? null;
  const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
  const tierRaw = body.site_visit_priority_tier ?? body.siteVisitPriorityTier ?? null;
  const siteVisitTier = tierRaw === 1 || tierRaw === '1' ? 1 : tierRaw === 2 || tierRaw === '2' ? 2 : null;
  if (toStage === 'SITE_VISIT' && !siteVisitTier) {
    return jsonError('Site visit priority tier is required.', 400);
  }

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prevRes = await supabase.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prevRes.error || !prevRes.data) return jsonError('Project not found', 404);

  const fromStage = normaliseStage(prevRes.data.pipeline_stage) ?? 'NEW';

  const updatePayload: Record<string, unknown> = { pipeline_stage: toStage };
  if (toStage === 'SITE_VISIT') {
    updatePayload.site_visit_priority_tier = siteVisitTier;
  }

  const updateRes = await supabase
    .from('projects')
    .update(updatePayload as any)
    .eq('id', projectUuid)
    .select('*')
    .single();
  if (updateRes.error || !updateRes.data) return jsonError(updateRes.error?.message ?? 'Failed to update project stage', 500);

  await automationRunner.runEvent({
    type: 'pipeline.stage_changed',
    projectId: projectUuid,
    stage: toStage,
    primaryId: quoteId,
    payload: { fromStage, toStage, reason, meta, quoteId },
  });

  return jsonOk({ project: updateRes.data });
}
