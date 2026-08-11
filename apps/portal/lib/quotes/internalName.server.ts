import 'server-only';

import { insertCommercialAuditEvent } from '@/lib/commercial/audit';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export async function seedQuoteInternalName(quoteUuid: string, internalName: string | null): Promise<void> {
  if (!internalName) return;
  const result = await supabaseServiceRole
    .from('quotes')
    .update({ internal_name: internalName } as any)
    .eq('id', quoteUuid)
    .is('internal_name', null);
  if (result.error) throw result.error;
}

export async function updateQuoteInternalNameByVersion(params: {
  quoteVersionId: string;
  internalName: string | null;
  actor: string | null;
}): Promise<{ projectUuid: string }> {
  const quoteVersionUuid = uuidFromAppId(params.quoteVersionId, 'qv');
  const version = await supabaseServiceRole
    .from('quote_versions')
    .select('quote_id, quotes!inner(project_id)')
    .eq('id', quoteVersionUuid)
    .maybeSingle();
  if (version.error) throw version.error;
  if (!version.data) throw new Error('Quote not found');

  const row = version.data as any;
  const quoteUuid = String(row.quote_id ?? '');
  const projectUuid = String(row.quotes?.project_id ?? '');
  if (!quoteUuid || !projectUuid) throw new Error('Quote not found');

  const update = await supabaseServiceRole
    .from('quotes')
    .update({ internal_name: params.internalName } as any)
    .eq('id', quoteUuid)
    .select('id')
    .single();
  if (update.error) throw update.error;

  await insertCommercialAuditEvent({
    projectId: projectUuid,
    type: 'quote.internal_name_updated',
    payload: {
      quoteId: quoteUuid,
      quoteVersionId: quoteVersionUuid,
      internalName: params.internalName,
      actor: params.actor,
    },
  });
  return { projectUuid };
}
