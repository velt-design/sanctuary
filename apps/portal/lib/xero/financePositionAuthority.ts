import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import { financeOrganisationBinding } from './financePositionContract';

export async function financePositionBinding(actor: string, tenantId: string,
  source: { sourceKey: string; connectionId: string; environment: string }, signal: AbortSignal) {
  signal.throwIfAborted();
  const result = await supabaseServiceRole.rpc('xero_finance_position_binding', { p_actor: actor, p_tenant_id: tenantId,
    p_source_key: source.sourceKey, p_connection_id: source.connectionId, p_environment: source.environment }).abortSignal(signal);
  const parsed = financeOrganisationBinding.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.tenantId !== tenantId) throw new Error('POSITION_AUTHORITY_UNAVAILABLE');
  return parsed.data;
}
