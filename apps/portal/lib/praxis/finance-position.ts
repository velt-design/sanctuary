import 'server-only';
import { authorizePraxisRequest, createPraxisErrorResponse, praxisRequestId, praxisResponseHeaders, PraxisConnectorError } from './server';
import { financePositionQuery, financePositionResponseSchema, FINANCE_POSITION_MAX_BYTES } from '../xero/financePositionContract';
import { readFinancePosition } from '../xero/financePosition';
import { PositionReadError } from '../xero/financePositionProvider';
import { positionRuntime, positionRuntimeDependencies } from '../xero/financePositionRuntime';

const dependencies = positionRuntimeDependencies;
export async function financePositionResponse(request: Request, deps = dependencies) {
  const requestId = praxisRequestId();
  try {
    const source = deps.connector(); authorizePraxisRequest(request, source);
    const runtime = positionRuntime(request.signal, { ...deps, connector: () => source });
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Invalid finance query.');
    const parsed = financePositionQuery.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose a basis and 1–366 accounting dates.');
    const evidence = await readFinancePosition(parsed.data, runtime.deps, runtime.deadline);
    const body = financePositionResponseSchema.parse({ ...evidence, requestId, source: { sourceKey: source.sourceKey,
      connectionId: source.connectionId, environment: source.environment, authority: 'canonical', retrievedAt: evidence.checkedAt } });
    if (Buffer.byteLength(JSON.stringify(body)) > FINANCE_POSITION_MAX_BYTES) throw new PositionReadError('limit_exceeded');
    return Response.json(body, { headers: praxisResponseHeaders(requestId) });
  } catch (error) {
    return createPraxisErrorResponse(error instanceof Error && error.message === 'POSITION_INVALID_QUERY'
      ? new PraxisConnectorError(400, 'INVALID_QUERY', 'Choose dates through today in New Zealand.') : error, requestId);
  }
}
