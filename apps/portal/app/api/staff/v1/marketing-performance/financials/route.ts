import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import {financialRequestKey,financialPanelQuery} from '@/lib/xero/financials/contract';
import {READ_PARTS_MEDIA_TYPE} from '@/lib/api/readParts';
import {financialProfitPartsResponse} from '@/lib/xero/financials/profitPartsResponse.server';
import { readPortalFinancials, startPortalFinancialProfitParts } from '@/lib/xero/financials/readPortal.server';

export const runtime = 'nodejs';
export const maxDuration = 60;
function privateResponse(response: Response) {
  response.headers.set('Vary','Accept');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  const denied = () => privateResponse(jsonError('Current developer and finance access are required.', 403));
  if (!isDeveloper(staff.session.user)) return denied();
  const params=new URL(request.url).searchParams;
  if(request.headers.get('accept')?.split(',').some(value=>value.trim()===READ_PARTS_MEDIA_TYPE)&&params.get('section')==='profit'){
    const parsed=financialPanelQuery.safeParse(Object.fromEntries(params));
    if(!parsed.success||[...params.keys()].some(key=>params.getAll(key).length!==1))return privateResponse(jsonError('Choose a basis and 1 to 366 accounting dates ending today or earlier.',400));
    return privateResponse(financialProfitPartsResponse(request,financialRequestKey(parsed.data),signal=>startPortalFinancialProfitParts(params,signal,staff.session.user.id)));
  }
  const result=await readPortalFinancials(new URL(request.url).searchParams,request.signal,staff.session.user.id);
  return privateResponse(result.ok?jsonOk({report:result.report}):jsonError(result.error,result.status));
}
