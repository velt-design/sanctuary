import 'server-only';

import { createHash } from 'crypto';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { errorMessage, missingTableError, schemaMissingError } from './serverHelpers';
import { loadQuoteFamilyByCommercialScope } from './serverLoaders';

function deterministicManualAddOnScopeId(projectUuid: string, clientIntentId: string): string {
  const hex = createHash('sha256')
    .update(`manual-quote-scope:${projectUuid}:${clientIntentId}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function resolveManualQuoteCommercialScopeId(
  projectUuid: string,
  clientIntentId: string,
): Promise<string | null> {
  const baseFamily = await loadQuoteFamilyByCommercialScope(projectUuid, null);
  if (baseFamily.error) {
    if (missingTableError(baseFamily.error)) throw schemaMissingError();
    throw new Error(errorMessage(baseFamily.error, 'Failed to load quote'));
  }
  if (!baseFamily.data?.id) return null;

  const versionsRes = await supabaseServiceRole
    .from('quote_versions')
    .select('status, accepted_at')
    .eq('quote_id', String(baseFamily.data.id));
  if (versionsRes.error) {
    throw new Error(errorMessage(versionsRes.error, 'Failed to inspect quote history'));
  }
  const hasAcceptedLifecycle = (versionsRes.data ?? []).some((version) =>
    String(version.status ?? '').toUpperCase() === 'ACCEPTED' || Boolean(version.accepted_at),
  );
  return hasAcceptedLifecycle
    ? deterministicManualAddOnScopeId(projectUuid, clientIntentId)
    : null;
}
