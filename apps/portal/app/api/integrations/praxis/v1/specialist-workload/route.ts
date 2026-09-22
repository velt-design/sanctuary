import {authorizePraxisRequest,createPraxisErrorResponse,loadPraxisConnectorConfig,praxisRequestId,praxisResponseHeaders} from '../../../../../../lib/praxis/server';
import {parseSpecialistQuery,readPraxisSpecialistWorkload} from '../../../../../../lib/praxis/specialist-workload-read';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request):Promise<Response> {
  const requestId=praxisRequestId();
  try {
    const config=loadPraxisConnectorConfig();authorizePraxisRequest(request,config);
    return Response.json(await readPraxisSpecialistWorkload(parseSpecialistQuery(new URL(request.url)),config,requestId),{headers:praxisResponseHeaders(requestId)});
  }catch(error){return createPraxisErrorResponse(error,requestId);}
}
