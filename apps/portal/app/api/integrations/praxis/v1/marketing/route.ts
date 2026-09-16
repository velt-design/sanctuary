import { authorizePraxisRequest, createPraxisErrorResponse, loadPraxisConnectorConfig, praxisRequestId, praxisResponseHeaders } from '../../../../../../lib/praxis/server';
import { parseMarketingQuery, readPraxisMarketing } from '../../../../../../lib/praxis/marketing-read';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> {
  const requestId = praxisRequestId();
  try {
    const config = loadPraxisConnectorConfig();
    authorizePraxisRequest(request, config);
    const result = await readPraxisMarketing(parseMarketingQuery(new URL(request.url)), config, requestId);
    return Response.json(result, { headers: praxisResponseHeaders(requestId) });
  } catch (error) { return createPraxisErrorResponse(error, requestId); }
}
