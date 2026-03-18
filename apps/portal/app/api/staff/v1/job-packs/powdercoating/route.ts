import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { normalizePowdercoatStoredRow } from '@/lib/jobPacks/powdercoating';
import { estimateExists, isMissingSchemaError, listPowdercoatProfileOptions, loadPowdercoatOverrideState, savePowdercoatOverrideState } from '@/lib/jobPacks/server';
import type { JobPackPowdercoatOption, JobPackPowdercoatOverrideState, JobPackPowdercoatUpdateRequest } from '@/lib/jobPacks/types';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

function emptyOverrideState(): JobPackPowdercoatOverrideState {
  return { version: null, rows: [] };
}

function formatSchemaWarning(error: unknown): string {
  const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
  return `Powdercoating overrides are unavailable until the latest migrations are applied.${detail}`;
}

function formatProfileOptionWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Profile options could not be loaded.';
  return `Powdercoating profile options could not be loaded. ${message}`;
}

function parseEstimateUuid(estimateId: string): string | null {
  try {
    return uuidFromAppId(estimateId, 'est');
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  const estimateId = url.searchParams.get('estimateId')?.trim() || '';
  if (!estimateId) return jsonError('estimateId is required', 400);

  const estimateUuid = parseEstimateUuid(estimateId);
  if (!estimateUuid) return jsonError('Invalid estimateId', 400);

  try {
    if (!(await estimateExists(estimateUuid))) return jsonError('Estimate not found', 404);

    const warnings: string[] = [];
    let overrides: JobPackPowdercoatOverrideState = emptyOverrideState();
    let options: JobPackPowdercoatOption[] = [];
    let persistenceAvailable = true;
    let profileOptionsAvailable = true;

    try {
      overrides = await loadPowdercoatOverrideState(estimateUuid);
    } catch (error) {
      if (isMissingSchemaError(error)) {
        persistenceAvailable = false;
        warnings.push(formatSchemaWarning(error));
      } else {
        throw error;
      }
    }

    try {
      options = await listPowdercoatProfileOptions();
    } catch (error) {
      profileOptionsAvailable = false;
      warnings.push(formatProfileOptionWarning(error));
    }

    return jsonOk({
      overrides,
      options,
      persistenceAvailable,
      profileOptionsAvailable,
      warningMessage: warnings.length ? warnings.join(' ') : null,
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Job-pack override schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    return jsonError(error instanceof Error ? error.message : 'Failed to load powdercoating sheet.', 500);
  }
}

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = (parsed.body ?? {}) as Partial<JobPackPowdercoatUpdateRequest>;

  const estimateId = typeof body.estimateId === 'string' ? body.estimateId.trim() : '';
  if (!estimateId) return jsonError('estimateId is required', 400);

  const estimateUuid = parseEstimateUuid(estimateId);
  if (!estimateUuid) return jsonError('Invalid estimateId', 400);

  const expectedVersion =
    typeof body.expectedVersion === 'string' && body.expectedVersion.trim() ? body.expectedVersion.trim() : null;
  const rowsRaw = Array.isArray(body.rows) ? body.rows : null;
  if (!rowsRaw) return jsonError('rows must be an array', 400);

  const rows = rowsRaw.map(normalizePowdercoatStoredRow).filter((row): row is NonNullable<ReturnType<typeof normalizePowdercoatStoredRow>> => Boolean(row));
  if (rows.length !== rowsRaw.length) return jsonError('rows payload is invalid', 400);

  try {
    if (!(await estimateExists(estimateUuid))) return jsonError('Estimate not found', 404);

    const result = await savePowdercoatOverrideState({
      estimateUuid,
      expectedVersion,
      rows,
      updatedBy: session.user.id ?? null,
    });

    if (!result.ok) {
      return Response.json(
        {
          error: 'Powdercoating override conflict',
          currentOverrides: result.current,
        },
        { status: 409 },
      );
    }

    return jsonOk({ ok: true, overrides: result.overrides });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(error as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Job-pack override schema is not upgraded yet. Run the latest migrations then refresh.${detail}`, 501);
    }
    return jsonError(error instanceof Error ? error.message : 'Failed to save powdercoating sheet.', 500);
  }
}
