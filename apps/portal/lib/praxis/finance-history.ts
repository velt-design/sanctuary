import 'server-only';
import { z } from 'zod';
import { authorizePraxisRequest, loadPraxisConnectorConfig, createPraxisErrorResponse, praxisRequestId, praxisResponseHeaders, PraxisConnectorError } from './server';
import { customerHistoryQuery } from '../xero/customerHistoryContract';
import { readCustomerHistory } from '../xero/customerHistory';
import { readHistoryPage } from '../xero/customerHistoryProvider';
import { financeCustomerHistoryBinding } from '../invoices/financeMappingRepository';

const dependencies = { connector: loadPraxisConnectorConfig, binding: financeCustomerHistoryBinding, read: readHistoryPage,
  env: (): Record<string, string | undefined> => process.env, now: () => new Date() };
/** Delegated finance identity is explicit deployment configuration, never supplied by the caller. */
export async function financeHistoryResponse(request: Request, deps = dependencies) {
  const requestId = praxisRequestId();
  try {
    const source = deps.connector(); authorizePraxisRequest(request, source);
    const env = deps.env();
    const actor = z.string().uuid().safeParse(env.PRAXIS_XERO_FINANCE_ACTOR_ID);
    const tenant = z.string().uuid().safeParse(env.XERO_TENANT_ID);
    if (env.PRAXIS_XERO_FINANCE_READ_ENABLED !== 'true' || env.XERO_PAYMENT_MATCHING_ENABLED !== 'true' || !actor.success || !tenant.success) {
      throw new PraxisConnectorError(403, 'UNAUTHORIZED', 'The source finance-read capability is not enabled.');
    }
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Invalid finance history query.');
    const parsed = customerHistoryQuery.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose a project and 1–90 accounting dates.');
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(75000)]);
    const binding = async (signal: AbortSignal) => {
      // Re-read gate/config as well as database authority, before every broker read and before publication.
      const current = deps.env();
      if (current.PRAXIS_XERO_FINANCE_READ_ENABLED !== 'true' || current.XERO_PAYMENT_MATCHING_ENABLED !== 'true'
        || current.PRAXIS_XERO_FINANCE_ACTOR_ID !== actor.data || current.XERO_TENANT_ID !== tenant.data) throw new Error('HISTORY_AUTHORITY_UNAVAILABLE');
      signal.throwIfAborted();
      return deps.binding(actor.data, parsed.data.projectId, tenant.data, { sourceKey: source.sourceKey, connectionId: source.connectionId, environment: source.environment }, signal);
    };
    const evidence = await readCustomerHistory(parsed.data, { binding, read: deps.read, now: deps.now }, deadline);
    const finalBinding = await binding(deadline);
    if (Object.entries(finalBinding).some(([key, value]) => evidence.identity[key as keyof typeof finalBinding] !== value)) throw new Error('HISTORY_IDENTITY_CHANGED');
    return Response.json({ ...evidence, requestId, source: { sourceKey: source.sourceKey, connectionId: source.connectionId,
      environment: source.environment, authority: 'canonical', retrievedAt: evidence.checkedAt } }, { headers: praxisResponseHeaders(requestId) });
  } catch (error) {
    const safeError = error instanceof Error && error.message === 'HISTORY_INVALID_QUERY'
      ? new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose dates through today in New Zealand.') : error;
    return createPraxisErrorResponse(safeError, requestId);
  }
}
