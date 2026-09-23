import 'server-only';
import { supabaseServiceRole } from '../../supabaseClient';
import type { ConnectorConfig } from '../../praxis/server';
import type { metaControlConfig } from './config';

export type MetaCommand = 'claim' | 'before' | 'after' | 'complete' | 'failed' | 'read' | 'delete' | 'deliver';
const sqlStates = new Set(['42501', '57014', '23505', '23514', '23503', '22023', '22P02', 'P0001', '42883', '42P01', '42703', '40001', '40P01', '08006']);
export class MetaStoreFailure extends Error {
  readonly sqlState: string;
  constructor(code: unknown) {
    super('Meta source authority unavailable.');
    this.sqlState = typeof code === 'string' && sqlStates.has(code) ? code : 'unknown';
  }
}
export function metaStore(control: ReturnType<typeof metaControlConfig>, source: ConnectorConfig) {
  return async (action: MetaCommand, operation: string | null, signal: AbortSignal, input: { query?: string; step?: string; payload?: string } = {}): Promise<unknown> => {
    signal.throwIfAborted();
    const result = await supabaseServiceRole.rpc('sanctuary_meta_command', { p_actor: control.actor, p_account: control.account,
      p_binding: control.binding, p_source: source.sourceKey, p_connection: source.connectionId, p_environment: source.environment,
      p_action: action, p_operation: operation, p_query: input.query ?? null, p_step: input.step ?? null, p_payload: input.payload ?? null }).abortSignal(signal);
    if (result.error) throw new MetaStoreFailure(result.error.code);
    return result.data;
  };
}
export type MetaStore = ReturnType<typeof metaStore>;
