import { requireStaffContext } from '@/lib/api/staffApi';
import { jsonError, jsonOk } from '@/lib/api/adminApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) {
    auth.response.headers.set('cache-control', 'private, no-store');
    return auth.response;
  }
  let projectId: string;
  try { projectId = uuidFromAppId((await ctx.params).projectId, 'proj'); }
  catch { return jsonError('Invalid project.', 400); }
  const result = await auth.supabase.rpc('marketing_enquiry_staff_receipts', { p_project_id: projectId });
  if (result.error) return jsonError('Original enquiry records are unavailable. Please retry or contact your administrator.', 503);
  return jsonOk({ receipts: result.data ?? [] });
}
