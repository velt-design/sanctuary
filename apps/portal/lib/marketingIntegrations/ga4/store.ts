import 'server-only';
import { supabaseServiceRole } from '../../supabaseClient';
import type { ConnectorConfig } from '../../praxis/server';
import type { Ga4Evidence, Ga4LifecycleStore, Ga4Step } from './lifecycle';
import type { ReportQuery } from './report/report';

export type Ga4Control = { actor: string; property: string; binding: string };
export type Ga4Command = 'claim' | 'before' | 'after' | 'finish' | 'complete' | 'read' | 'delete' | 'deliver';
const sqlStates = new Set(['42501', '57014', '23505', '23514', '23503', '22023', '22P02', 'P0001', '42883', '42P01', '42703', '40001', '40P01', '08006']);
export class Ga4StoreFailure extends Error {
  readonly sqlState: string;
  constructor(code: unknown) {
    super('GA4 source authority unavailable.');
    this.sqlState = typeof code === 'string' && sqlStates.has(code) ? code : 'unknown';
  }
}
export function ga4Store(control: Ga4Control, source: ConnectorConfig) {
  return async (action: Ga4Command, operation: string | null, signal: AbortSignal, input: {
    query?: ReportQuery; step?: Ga4Step; evidence?: Ga4Evidence | { outcome: 'connected' | 'report_failed' | 'uncertain' }; payload?: string;
  } = {}): Promise<unknown> => {
    signal.throwIfAborted();
    const result = await supabaseServiceRole.rpc('sanctuary_ga4_command', {
      p_actor: control.actor, p_property: control.property, p_binding: control.binding,
      p_source: source.sourceKey, p_connection: source.connectionId, p_environment: source.environment,
      p_action: action, p_operation: operation, p_query: input.query ?? null,
      p_step: input.step ?? null, p_evidence: input.evidence ?? null, p_payload: input.payload ?? null,
    }).abortSignal(signal);
    if (result.error) throw new Ga4StoreFailure(result.error.code);
    return result.data;
  };
}
export type Ga4Store = ReturnType<typeof ga4Store>;

/** Result recording has its own bounded deadline so request cancellation cannot
 * erase a known credential outcome. Failure still leaves a durable pending intent. */
export function ga4LifecycleStore(command: Ga4Store, operation: string, signal: AbortSignal): Ga4LifecycleStore {
  return {
    before: async (step, evidence) => { await command('before', operation, signal, { step, evidence }); },
    after: async (step, evidence) => { await command('after', operation, AbortSignal.timeout(10_000), { step, evidence }); },
    finish: async outcome => { await command('finish', operation, AbortSignal.timeout(10_000), { evidence: { outcome } }); },
  };
}
