import {
  authorizePraxisRequest, createPraxisErrorResponse, loadPraxisConnectorConfig,
  praxisRequestId, praxisResponseHeaders,
} from '../../../../../../lib/praxis/server';
import { parseEnquiryIdentityQuery } from '../../../../../../lib/praxis/enquiryIdentity.contract';
import { readEnquiryIdentities } from '../../../../../../lib/praxis/enquiryIdentity.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const requestId = praxisRequestId();
  try {
    const config = loadPraxisConnectorConfig();
    authorizePraxisRequest(request, config);
    const response = await readEnquiryIdentities(parseEnquiryIdentityQuery(new URL(request.url)), config, requestId);
    return Response.json(response, { headers: praxisResponseHeaders(requestId) });
  } catch (error) {
    return createPraxisErrorResponse(error, requestId);
  }
}
