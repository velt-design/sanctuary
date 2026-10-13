import 'server-only';
import { supabaseServiceRole } from '../../supabaseClient';
import type { MetaCredentialConfig } from './config';
export type CredentialCommand = (action: string, input?: Record<string, unknown>, operation?: string) => Promise<unknown>;
export function metaCredentialStore(config: MetaCredentialConfig, signal: AbortSignal): CredentialCommand {
  return async (action, input = {}, operation) => {
    const result = await supabaseServiceRole.rpc('meta_credential_command', { p_actor: config.identity.actorId,
      p_capability: config.identity.capability, p_binding: config.binding, p_action: action, p_operation: operation ?? null, p_input: input })
      .abortSignal(['finish','failed','activate'].includes(action) ? AbortSignal.timeout(10000) : signal);
    if (result.error) throw new Error('Meta credential source unavailable');
    return result.data;
  };
}
