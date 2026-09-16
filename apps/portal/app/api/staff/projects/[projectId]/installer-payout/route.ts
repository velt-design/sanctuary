import { requireStaffContext } from '@/lib/api/staffApi';
import { jsonError, jsonOk } from '@/lib/api/adminApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';



type Context = { params: Promise<{ projectId: string }> };
export async function GET(_req: Request, ctx: Context) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  try {
    const projectId = uuidFromAppId((await ctx.params).projectId, 'proj');
    const result = await auth.supabase.rpc('installer_payout_read', { p_project_id: projectId });
    if (result.error) return jsonError('Installer payout storage is unavailable. Check that the workflow migration has been applied.', 503);
    return jsonOk({ events: result.data ?? [], canEdit: auth.session.role === 'admin' });
  } catch { return jsonError('Invalid project.', 400); }
}
