import 'server-only';
import type { requireStaffContext } from '@/lib/api/staffApi';
import { studioIdentifier } from '@/lib/designStudio/identifiers';

type StaffClient = Extract<Awaited<ReturnType<typeof requireStaffContext>>, { ok: true }>['supabase'];

/** Uses the page's authenticated client so project visibility remains RLS-owned. */
export async function loadStudioProject(supabase: StaffClient, projectUuid: string) {
  const visible = await supabase.from('projects').select('id,name').eq('id', projectUuid).maybeSingle();
  if (!visible.data) return null;
  const result = await supabase.from('estimates')
    .select('id,version,internal_name,status,outputs,created_at')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  const designs = (result.data ?? []).filter(row => row.outputs?.studio_authored).map(row => ({
    id: studioIdentifier(row.id, 'est').appId,
    label: row.internal_name || `Design ${row.version}`,
    status: row.status,
  }));
  return { project: visible.data, designs, loadError: Boolean(result.error) };
}
