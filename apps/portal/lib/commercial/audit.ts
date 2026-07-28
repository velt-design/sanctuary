import 'server-only';

import { randomUUID } from 'node:crypto';

import { supabaseServiceRole } from '../supabaseClient';

type CommercialAuditWriteResult =
  | 'inserted'
  | 'duplicate'
  | 'schema_unavailable'
  | 'failed';

function databaseCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function schemaUnavailable(error: unknown): boolean {
  const code = databaseCode(error);
  if (code === '42P01' || code === 'PGRST204' || code === 'PGRST205') {
    return true;
  }
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  return /relation .* does not exist|schema cache/i.test(message);
}

export async function insertCommercialAuditEvent(params: {
  projectId: string;
  type: string;
  payload?: unknown;
  idempotencyKey?: string;
}): Promise<CommercialAuditWriteResult> {
  const result = await supabaseServiceRole.from('audit_events').insert({
    project_id: params.projectId,
    type: params.type,
    idempotency_key:
      params.idempotencyKey ??
      `${params.type}:${params.projectId}:${randomUUID()}`,
    payload: params.payload ?? {},
  } as any);

  if (!result.error) return 'inserted';
  if (databaseCode(result.error) === '23505' && params.idempotencyKey) {
    return 'duplicate';
  }
  if (schemaUnavailable(result.error)) {
    console.error('[commercial_audit] schema unavailable', {
      type: params.type,
      code: databaseCode(result.error) || 'UNKNOWN',
      message: result.error.message ?? 'Audit schema unavailable',
    });
    return 'schema_unavailable';
  }

  console.error('[commercial_audit] failed to insert', {
    type: params.type,
    code: databaseCode(result.error) || 'UNKNOWN',
    message: result.error.message ?? 'Audit insert failed',
  });
  return 'failed';
}
