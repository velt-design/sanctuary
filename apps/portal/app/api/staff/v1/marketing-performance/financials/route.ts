import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { readPortalFinancials } from '@/lib/xero/financials/readPortal.server';

export const runtime = 'nodejs';
export const maxDuration = 60;
function privateResponse(response: Response) {
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
  const result=await readPortalFinancials(new URL(request.url).searchParams,request.signal,staff.session.user.id);
  return privateResponse(result.ok?jsonOk({report:result.report}):jsonError(result.error,result.status));
}
