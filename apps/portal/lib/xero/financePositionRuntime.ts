import 'server-only';
import { z } from 'zod';
import { loadPraxisConnectorConfig, PraxisConnectorError } from '../praxis/server';
import { financePositionBinding } from './financePositionAuthority';
import { readPositionPage, createPositionReadWindow, PositionReadError } from './financePositionProvider';

const runtimeDefaults = { connector: loadPraxisConnectorConfig, binding: financePositionBinding, read: readPositionPage,
  env: (): Record<string, string | undefined> => process.env, now: () => new Date(), openRead: createPositionReadWindow };
export const positionRuntimeDependencies: Omit<typeof runtimeDefaults,'openRead'> & Partial<Pick<typeof runtimeDefaults,'openRead'>> = runtimeDefaults;
type RuntimeDependencies = typeof positionRuntimeDependencies;

/** Shared source authority and provider budget for Portal and machine consumers. */
export function positionRuntime(requestSignal: AbortSignal, deps: RuntimeDependencies = positionRuntimeDependencies, recheck?: () => Promise<void>, reuseConnection = false) {
  const source = deps.connector(), env = deps.env();
  const actor = z.string().uuid().safeParse(env.PRAXIS_XERO_FINANCE_ACTOR_ID), tenant = z.string().uuid().safeParse(env.XERO_TENANT_ID);
  const enabled = (value: Record<string, string | undefined>) => value.PRAXIS_XERO_FINANCE_POSITION_ENABLED === 'true' && value.XERO_PAYMENT_MATCHING_ENABLED === 'true';
  if (!enabled(env) || !actor.success || !tenant.success) throw new PraxisConnectorError(403, 'UNAUTHORIZED', 'The source organisation finance-read capability is not enabled.');
  const deadline = AbortSignal.any([requestSignal, AbortSignal.timeout(45000)]);
  const providerDeadline = AbortSignal.any([deadline, AbortSignal.timeout(40000)]);
  const window = reuseConnection ? deps.openRead?.() : undefined;
  return { source, deadline, close: () => window?.close() ?? Promise.resolve(), deps: {
    now: deps.now,
    binding: async (signal: AbortSignal) => {
      const current = deps.env();
      if (!enabled(current) || current.PRAXIS_XERO_FINANCE_ACTOR_ID !== actor.data || current.XERO_TENANT_ID !== tenant.data) throw new Error('POSITION_AUTHORITY_UNAVAILABLE');
      // Both independent authorities must pass before a provider read. Neither
      // authorizes the other; keep every fresh recheck and the final check.
      const [, binding] = await Promise.all([recheck?.(), deps.binding(actor.data, tenant.data, source, signal)]);
      signal.throwIfAborted();
      return binding;
    },
    read: async (input: Parameters<typeof readPositionPage>[0]) => {
      try { providerDeadline.throwIfAborted(); return await (window?.read ?? deps.read)(input, providerDeadline); }
      catch (error) { deadline.throwIfAborted(); if (providerDeadline.aborted) throw new PositionReadError('provider_unavailable'); throw error; }
    },
  } };
}
