import {authorizePraxisRequest,createPraxisErrorResponse,loadPraxisConnectorConfig,praxisRequestId,praxisResponseHeaders} from '../../../../../../lib/praxis/server';
import {parseBriefingQuery,readPraxisBriefing} from '../../../../../../lib/praxis/briefing-read';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request):Promise<Response> {
  const requestId=praxisRequestId();
  try {const config=loadPraxisConnectorConfig();authorizePraxisRequest(request,config);parseBriefingQuery(new URL(request.url));
    return Response.json(await readPraxisBriefing(config,requestId),{headers:praxisResponseHeaders(requestId)});
  }catch(error){return createPraxisErrorResponse(error,requestId);}
}
