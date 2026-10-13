import 'server-only';
import { supabaseServiceRole } from '../../supabaseClient';
import type { MetaSaleCommand } from './worker';
export function metaSaleStore(config: { actorId: string; binding: string }, signal: AbortSignal): MetaSaleCommand {
  return async (action, input = {}, runId) => {
    const result = await supabaseServiceRole.rpc('meta_sale_command', { p_actor: config.actorId, p_binding: config.binding,
      p_action: action, p_run: runId ?? null, p_input: input }).abortSignal(['complete','finish'].includes(action) ? AbortSignal.timeout(10000) : signal);
    if (result.error) throw new Error('Meta sale source unavailable');
    return result.data;
  };
}
