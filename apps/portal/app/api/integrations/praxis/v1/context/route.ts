import {
  authorizePraxisRequest,
  createPraxisErrorResponse,
  loadPraxisConnectorConfig,
  parsePraxisContextQuery,
  praxisRequestId,
  praxisResponseHeaders,
  readPraxisContext,
} from '../../../../../../lib/praxis/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const requestId = praxisRequestId();
  try {
    const config = loadPraxisConnectorConfig();
    authorizePraxisRequest(request, config);
    const response = await readPraxisContext(parsePraxisContextQuery(new URL(request.url)), config, requestId);
    return Response.json(response, { headers: praxisResponseHeaders(requestId) });
  } catch (error) {
    return createPraxisErrorResponse(error, requestId);
  }
}

