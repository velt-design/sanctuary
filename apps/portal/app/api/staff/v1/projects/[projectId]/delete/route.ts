import { jsonError, jsonOk, requireAdminContext } from '@/lib/api/adminApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

const STAGE_ORDER = ['NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTING', 'SENT', 'DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID'] as const;
const DEPOSIT_INDEX = STAGE_ORDER.indexOf('DEPOSIT');

function normaliseStage(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return STAGE_ORDER.includes(raw as (typeof STAGE_ORDER)[number]) ? raw : 'NEW';
}

function requiresExtraConfirmation(stage: string): boolean {
  const stageIndex = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return stageIndex >= DEPOSIT_INDEX;
}

function expectedConfirmationText(projectId: string, stage: string): string {
  return requiresExtraConfirmation(stage) ? `DELETE ${projectId}` : 'DELETE';
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = typeof (error as any).code === 'string' ? (error as any).code.trim() : '';
  return code === '42P01';
}

async function parseOptionalJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let projectUuid: string;
  let projectAppId: string;
  try {
    const params = await ctx.params;
    projectAppId = params.projectId;
    projectUuid = uuidFromAppId(projectAppId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const projectRes = await supabase
    .from('projects')
    .select('id, name, pipeline_stage')
    .eq('id', projectUuid)
    .single();
  if (projectRes.error || !projectRes.data) return jsonError('Project not found', 404);

  const stage = normaliseStage(projectRes.data.pipeline_stage);
  const requiredText = expectedConfirmationText(projectAppId, stage);

  const body = await parseOptionalJson(req);
  const confirmText = typeof body?.confirmText === 'string' ? body.confirmText.trim() : '';
  if (!confirmText) return jsonError('confirmText is required', 400);
  if (confirmText.toUpperCase() !== requiredText.toUpperCase()) {
    return jsonError(`Invalid confirmation text. Expected "${requiredText}".`, 400);
  }

  const reason = typeof body?.reason === 'string' ? body.reason.trim() || null : null;

  // Project delete can fail when quote_versions rows reference estimates with RESTRICT.
  // Removing quotes first cascades quote_versions and unblocks estimate/project deletion.
  const deleteQuotesRes = await supabase.from('quotes').delete().eq('project_id', projectUuid);
  if (deleteQuotesRes.error && !isMissingTableError(deleteQuotesRes.error)) {
    return jsonError(deleteQuotesRes.error.message ?? 'Failed to delete project quotes', 500);
  }

  const deleteRes = await supabase.from('projects').delete().eq('id', projectUuid);
  if (deleteRes.error) return jsonError(deleteRes.error.message ?? 'Failed to delete project', 500);

  const tombstoneRes = await supabase.from('audit_events').insert({
    project_id: null,
    type: 'project.deleted',
    idempotency_key: `project.deleted:${projectUuid}:${crypto.randomUUID()}`,
    payload: {
      projectId: projectAppId,
      projectUuid,
      projectName: typeof projectRes.data.name === 'string' ? projectRes.data.name : null,
      stage,
      reason,
      deletedByUserId: auth.session.user.id,
      deletedAt: new Date().toISOString(),
      hardDelete: true,
    },
  });
  if (tombstoneRes.error) {
    console.error('[project_delete] failed to insert tombstone audit event', tombstoneRes.error);
  }

  return jsonOk({
    ok: true,
    deletedProjectId: projectAppId,
    stage,
    auditLogged: !tombstoneRes.error,
    requiredConfirmation: requiredText,
  });
}
