import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const TIERS = new Set(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4']);

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const tierRaw = typeof body.tier === 'string' ? body.tier.trim().toUpperCase() : '';
  const tier = TIERS.has(tierRaw) ? tierRaw : 'TIER_2';

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const prev = await supabaseServer.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const fromStage = String(prev.data.pipeline_stage ?? '').toUpperCase();
  if (fromStage !== 'SITE_VISIT') return jsonError('Invalid stage transition (expected SITE_VISIT)', 409);

  const updateRes = await supabaseServer
    .from('projects')
    .update({ pipeline_stage: 'QUOTING' } as any)
    .eq('id', projectUuid)
    .select('id, pipeline_stage')
    .single();
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update project', 500);

  await automationRunner.runEvent({
    type: 'pipeline.stage_changed',
    projectId: projectUuid,
    stage: 'QUOTING',
    payload: { fromStage: 'SITE_VISIT', toStage: 'QUOTING' },
  });

  await automationRunner.runEvent({
    type: 'ui.action.generate_cost_plan',
    projectId: projectUuid,
    stage: 'QUOTING',
    payload: { tier },
  });

  return jsonOk({ ok: true });
}

