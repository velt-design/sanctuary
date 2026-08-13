import 'server-only';

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
  const result = await supabaseServiceRole.rpc('commercial_mark_quote_superseded', {
    p_quote_version_id: quoteVersionUuid,
    p_actor: actor,
  } as any);
  if (result.error) throw new Error(errorMessage(result.error, 'Failed to mark quote superseded'));
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const previousStatus = String((row as any)?.previous_status ?? '').toUpperCase();
  if (!['SENT', 'ACCEPTED', 'SUPERSEDED'].includes(previousStatus)) {
    throw new Error('Quote supersede command returned an invalid state');
  }
  return {
    changed: (row as any)?.changed === true,
    previousStatus: previousStatus as SupersedeResult['previousStatus'],
  };
}
