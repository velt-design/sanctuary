import 'server-only';
import { supabaseServiceRole } from '../../supabaseClient';
import type { AdsConfig } from './config';
export type GoogleCommand = (action: string, input?: Record<string, unknown>, runId?: string) => Promise<unknown>;
export function googleStore(config: AdsConfig, signal: AbortSignal): GoogleCommand {
  return async (action, input = {}, runId) => {
    const completed = ['complete', 'finish', 'credential_settled'].includes(action);
    const request = action === 'credential_settled'
      ? supabaseServiceRole.rpc('google_ads_credential_settled', { p_actor: config.actorId, p_binding: config.binding, p_run: runId })
      : supabaseServiceRole.rpc('google_ads_command', { p_actor: config.actorId, p_binding: config.binding, p_action: action, p_run: runId ?? null, p_input: input });
    const result = await request.abortSignal(completed ? AbortSignal.timeout(10000) : signal);
    if (result.error) throw new Error('Google source command unavailable.');
    return result.data;
  };
}
