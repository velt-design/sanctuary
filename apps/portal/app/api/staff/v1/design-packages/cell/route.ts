import { NextResponse } from 'next/server';
import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { normalizeDesignListCellInput } from '@/lib/designPackages/editing';
import { isMissingSchemaError, loadDesignPackageRow } from '@/lib/designPackages/server';
import { applyDesignListCellMutation } from '@/lib/designPackages/writeOps';
import type { DesignListCellMutationRequest } from '@/lib/designPackages/types';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = (parsed.body ?? {}) as Partial<DesignListCellMutationRequest>;

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const rowVersion = typeof body.rowVersion === 'string' ? body.rowVersion.trim() : '';
  const key = typeof body.key === 'string' ? body.key.trim() : '';

  if (!requestId) return jsonError('requestId is required', 400);
  if (!rowVersion) return jsonError('rowVersion is required', 400);

  let requestUuid: string;
  try {
    requestUuid = uuidFromAppId(requestId, 'dpr');
  } catch {
    return jsonError('Invalid requestId', 400);
  }

  const normalized = normalizeDesignListCellInput(key as any, body.value);
  if (!normalized.ok) return jsonError(normalized.error, 400);

  try {
    const currentRow = await loadDesignPackageRow(requestUuid);
    if (!currentRow) return jsonError('Design request not found', 404);

    if (currentRow.rowVersion !== rowVersion) {
      return NextResponse.json({ error: 'Row conflict', currentRow }, { status: 409 });
    }

    const response = await applyDesignListCellMutation({
      requestId,
      requestUuid,
      currentRow,
      key: key as any,
      value: normalized.value,
    });

    return jsonOk(response);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Design list schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    const message = error instanceof Error ? error.message : 'Failed to update design-list cell.';
    return jsonError(message, 500);
  }
}
