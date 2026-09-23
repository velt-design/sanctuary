import 'server-only';
import { z } from 'zod';
import { authorizePraxisRequest, loadPraxisConnectorConfig, createPraxisErrorResponse, praxisRequestId, praxisResponseHeaders, PraxisConnectorError } from './server';
import { financePositionQuery, financePositionResponseSchema, FINANCE_POSITION_MAX_BYTES } from '../xero/financePositionContract';
import { readFinancePosition } from '../xero/financePosition';
import { readPositionPage, PositionReadError } from '../xero/financePositionProvider';
import { financePositionBinding } from '../xero/financePositionAuthority';

const dependencies = { connector: loadPraxisConnectorConfig, binding: financePositionBinding, read: readPositionPage,
  env: (): Record<string, string | undefined> => process.env, now: () => new Date() };
export async function financePositionResponse(request: Request, deps = dependencies) {
  const requestId = praxisRequestId();
  try {
    const source = deps.connector(); authorizePraxisRequest(request, source);
    const env = deps.env(); const actor = z.string().uuid().safeParse(env.PRAXIS_XERO_FINANCE_ACTOR_ID), tenant = z.string().uuid().safeParse(env.XERO_TENANT_ID);
    const enabled = (value: Record<string, string | undefined>) => value.PRAXIS_XERO_FINANCE_POSITION_ENABLED === 'true'
      && value.XERO_PAYMENT_MATCHING_ENABLED === 'true';
    if (!enabled(env) || !actor.success || !tenant.success) throw new PraxisConnectorError(403, 'UNAUTHORIZED', 'The source organisation finance-read capability is not enabled.');
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Invalid finance query.');
    const parsed = financePositionQuery.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose a basis and 1–366 accounting dates.');
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
    const providerDeadline = AbortSignal.any([deadline, AbortSignal.timeout(40000)]);
    const binding = async (signal: AbortSignal) => {
      const current = deps.env();
      if (!enabled(current) || current.PRAXIS_XERO_FINANCE_ACTOR_ID !== actor.data || current.XERO_TENANT_ID !== tenant.data) throw new Error('POSITION_AUTHORITY_UNAVAILABLE');
      return deps.binding(actor.data, tenant.data, source, signal);
    };
    const evidence = await readFinancePosition(parsed.data, { binding, now: deps.now, read: async input => {
      try { providerDeadline.throwIfAborted(); return await deps.read(input, providerDeadline); }
      catch (error) { deadline.throwIfAborted(); if (providerDeadline.aborted) throw new PositionReadError('provider_unavailable'); throw error; }
    } }, deadline);
    const body = financePositionResponseSchema.parse({ ...evidence, requestId, source: { sourceKey: source.sourceKey,
      connectionId: source.connectionId, environment: source.environment, authority: 'canonical', retrievedAt: evidence.checkedAt } });
    if (Buffer.byteLength(JSON.stringify(body)) > FINANCE_POSITION_MAX_BYTES) throw new PositionReadError('limit_exceeded');
    return Response.json(body, { headers: praxisResponseHeaders(requestId) });
  } catch (error) {
    return createPraxisErrorResponse(error instanceof Error && error.message === 'POSITION_INVALID_QUERY'
      ? new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose dates through today in New Zealand.') : error, requestId);
  }
}
