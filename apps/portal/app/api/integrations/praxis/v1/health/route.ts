import {
  authorizePraxisRequest,
  createPraxisErrorResponse,
  loadPraxisConnectorConfig,
  praxisRequestId,
  praxisResponseHeaders,
  readPraxisHealth,
} from '../../../../../../lib/praxis/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const requestId = praxisRequestId();
  try {
    const config = loadPraxisConnectorConfig();
    authorizePraxisRequest(request, config);
    const response = await readPraxisHealth(config, requestId);
    return Response.json(response, { headers: praxisResponseHeaders(requestId) });
  } catch (error) {
    return createPraxisErrorResponse(error, requestId);
  }
}
