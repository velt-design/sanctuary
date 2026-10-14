import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { isDeveloper } from '@/lib/developerAccess';
import { metaSaleStatusSchema } from '@/lib/marketingIntegrations/metaSales/contract';
export const runtime = 'nodejs';
const privateResponse = <T extends Response>(response: T): T => { response.headers.set('Cache-Control', 'private, no-store'); return response; };
export async function GET(request: Request) {
  const staff = await requireStaffContext();
  if (!staff.ok) return privateResponse(staff.response);
  if (!isDeveloper(staff.session.user)) return privateResponse(jsonError('Developer access is required.', 403));
  if (new URL(request.url).search || request.body) return privateResponse(jsonError('This read accepts no filters or actions.', 400));
  try {
    const result = await staff.supabase.rpc('meta_sale_staff_read').abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
    if (result.error) throw new Error();
    return privateResponse(jsonOk({ evidence: metaSaleStatusSchema.parse(result.data) }));
  } catch { return privateResponse(jsonError('Meta sale evidence is unavailable.', 503)); }
}
