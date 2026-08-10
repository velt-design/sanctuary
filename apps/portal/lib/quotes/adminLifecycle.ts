import 'server-only';

import { insertCommercialAuditEvent } from '@/lib/commercial/audit';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { supabaseServiceRole } from '@/lib/supabaseClient';

type SupersedeResult = {
  changed: boolean;
  previousStatus: 'SENT' | 'ACCEPTED' | 'SUPERSEDED';
};

function errorMessage(error: unknown, fallback: string): string {
  return typeof (error as { message?: unknown })?.message === 'string'
    ? String((error as { message: string }).message)
    : fallback;
}

export async function markQuoteVersionSuperseded(
  quoteVersionId: string,
  actor: string,
): Promise<SupersedeResult> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const versionResult = await supabaseServiceRole
    .from('quote_versions')
    .select('id, status, quote_id, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .maybeSingle();

  if (versionResult.error) {
    throw new Error(errorMessage(versionResult.error, 'Failed to load quote'));
  }
  if (!versionResult.data) throw new Error('Quote not found');

  const previousStatus = String(versionResult.data.status ?? '').toUpperCase();
  if (previousStatus === 'SUPERSEDED') {
    return { changed: false, previousStatus: 'SUPERSEDED' };
  }
  if (previousStatus !== 'SENT' && previousStatus !== 'ACCEPTED') {
    throw new Error('Only sent or accepted quotes can be marked superseded');
  }

  const supersededAt = new Date().toISOString();
  const updateResult = await supabaseServiceRole
    .from('quote_versions')
    .update({
      status: 'SUPERSEDED',
      superseded_at: supersededAt,
      superseded_by: actor,
      is_current_draft: false,
      accept_token_hash: null,
      accept_token_expires_at: null,
    } as any)
    .eq('id', quoteVersionUuid)
    .eq('status', previousStatus)
    .select('id')
    .maybeSingle();

  if (updateResult.error) {
    throw new Error(errorMessage(updateResult.error, 'Failed to mark quote superseded'));
  }
  if (!updateResult.data) throw new Error('Quote changed before it could be marked superseded');

  const relation = (versionResult.data as any).quotes;
  const projectId = String((Array.isArray(relation) ? relation[0]?.project_id : relation?.project_id) ?? '');
  if (projectId) {
    await insertCommercialAuditEvent({
      projectId,
      type: 'quote.superseded',
      idempotencyKey: `quote.superseded:${quoteVersionUuid}`,
      payload: {
        quoteVersionId: quoteVersionUuid,
        previousStatus,
        supersededAt,
        actor,
      },
    });
  }

  return { changed: true, previousStatus };
}
