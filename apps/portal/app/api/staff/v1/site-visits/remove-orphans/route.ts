import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST() {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const listRes = await supabaseServer.from('site_visit_events').select('id, projects ( id )');
  if (listRes.error) return jsonError('Failed to scan site_visit_events', 500);

  const rows = Array.isArray(listRes.data) ? listRes.data : [];
  const orphanIds = rows
    .filter((r: any) => r && !r.projects)
    .map((r: any) => (typeof r.id === 'string' ? r.id : null))
    .filter(Boolean) as string[];

  if (!orphanIds.length) return jsonOk({ removed: 0 });

  const delRes = await supabaseServer.from('site_visit_events').delete().in('id', orphanIds).select('id');
  if (delRes.error) return jsonError('Failed to delete orphaned site visits', 500);

  const removed = Array.isArray(delRes.data) ? delRes.data.length : orphanIds.length;
  return jsonOk({ removed });
}

