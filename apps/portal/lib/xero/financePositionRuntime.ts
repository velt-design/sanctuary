import 'server-only';
import { z } from 'zod';
import { loadPraxisConnectorConfig, PraxisConnectorError } from '../praxis/server';
import { financePositionBinding } from './financePositionAuthority';
import { readPositionPage, PositionReadError } from './financePositionProvider';

export const positionRuntimeDependencies = { connector: loadPraxisConnectorConfig, binding: financePositionBinding, read: readPositionPage,
  env: (): Record<string, string | undefined> => process.env, now: () => new Date() };

/** Shared source authority and provider budget for Portal and machine consumers. */
export function positionRuntime(requestSignal: AbortSignal, deps = positionRuntimeDependencies, recheck?: () => Promise<void>) {
  const source = deps.connector(), env = deps.env();
  const actor = z.string().uuid().safeParse(env.PRAXIS_XERO_FINANCE_ACTOR_ID), tenant = z.string().uuid().safeParse(env.XERO_TENANT_ID);
  const enabled = (value: Record<string, string | undefined>) => value.PRAXIS_XERO_FINANCE_POSITION_ENABLED === 'true' && value.XERO_PAYMENT_MATCHING_ENABLED === 'true';
  if (!enabled(env) || !actor.success || !tenant.success) throw new PraxisConnectorError(403, 'UNAUTHORIZED', 'The source organisation finance-read capability is not enabled.');
  const deadline = AbortSignal.any([requestSignal, AbortSignal.timeout(45000)]);
  const providerDeadline = AbortSignal.any([deadline, AbortSignal.timeout(40000)]);
  return { source, deadline, deps: {
    now: deps.now,
    binding: async (signal: AbortSignal) => {
      const current = deps.env();
      if (!enabled(current) || current.PRAXIS_XERO_FINANCE_ACTOR_ID !== actor.data || current.XERO_TENANT_ID !== tenant.data) throw new Error('POSITION_AUTHORITY_UNAVAILABLE');
      await recheck?.();
      return deps.binding(actor.data, tenant.data, source, signal);
    },
    read: async (input: Parameters<typeof readPositionPage>[0]) => {
      try { providerDeadline.throwIfAborted(); return await deps.read(input, providerDeadline); }
      catch (error) { deadline.throwIfAborted(); if (providerDeadline.aborted) throw new PositionReadError('provider_unavailable'); throw error; }
    },
  } };
}
