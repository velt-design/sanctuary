import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createDesignRequest, isMissingSchemaError } from '@/lib/designPackages/server';
import type { DesignRequestPriorityTier, DesignRequestSource } from '@/lib/designPackages/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const estimateId = typeof body.estimateId === 'string' ? body.estimateId.trim() : '';
  const requestSource = typeof body.requestSource === 'string' ? body.requestSource.trim() : '';
  const requestNote = typeof body.requestNote === 'string' ? body.requestNote : null;
  const priorityTierRaw = typeof body.priorityTier === 'string' ? body.priorityTier.trim().toUpperCase() : '';

  if (!projectId) return jsonError('projectId is required', 400);
  if (!estimateId) return jsonError('estimateId is required', 400);
  if (requestSource !== 'calculator_generate' && requestSource !== 'estimates_tab') {
    return jsonError('requestSource is invalid', 400);
  }
  if (
    priorityTierRaw &&
    priorityTierRaw !== 'TIER_1' &&
    priorityTierRaw !== 'TIER_2' &&
    priorityTierRaw !== 'TIER_3' &&
    priorityTierRaw !== 'TIER_4' &&
    priorityTierRaw !== 'UNPRICED'
  ) {
    return jsonError('priorityTier is invalid', 400);
  }

  try {
    const created = await createDesignRequest({
      projectId,
      estimateId,
      requestSource: requestSource as Exclude<DesignRequestSource, 'legacy_backfill'>,
      requestNote,
      priorityTier: (priorityTierRaw || null) as DesignRequestPriorityTier | null,
    });
    return jsonOk({ ok: true, requestId: created.requestId }, 201);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Design list schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to create design request';
    const status = message.toLowerCase().includes('already exists') ? 409 : message === 'Estimate not found' ? 404 : 500;
    return jsonError(message, status);
  }
}
