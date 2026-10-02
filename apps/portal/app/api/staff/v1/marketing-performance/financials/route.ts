import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { positionRuntime } from '@/lib/xero/financePositionRuntime';
import { readFinancials } from '@/lib/xero/financials/read';
import { financialsQuery, nzDay } from '@/lib/xero/financials/contract';

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
  const finance = await getPaymentPilotSession();
  if (!finance || finance.user.id !== staff.session.user.id) return denied();
  const params = new URL(request.url).searchParams;
  const parsed = financialsQuery.safeParse(Object.fromEntries(params));
  if ([...params.keys()].some(key => params.getAll(key).length !== 1) || !parsed.success || parsed.data.to > nzDay())
    return privateResponse(jsonError('Choose a basis and 1–366 accounting dates ending today or earlier.', 400));
  try {
    const source = positionRuntime(request.signal, undefined, async () => {
      const current = await getPaymentPilotSession();
      if (!current || current.user.id !== finance.user.id || !isDeveloper(current.user)) throw new Error('FINANCIALS_ACCESS_CHANGED');
    });
    const report = await readFinancials(parsed.data, source.deps, source.deadline);
    return privateResponse(jsonOk({ report }));
  } catch (error) {
    if (error instanceof Error && error.message === 'FINANCIALS_ACCESS_CHANGED') return denied();
    return privateResponse(jsonError('Xero reports could not be verified. Retry; if this continues, check the existing finance connection and report access.', 503));
  }
}
