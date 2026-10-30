import 'server-only';
import type { requireStaffContext } from '@/lib/api/staffApi';
import { studioIdentifier } from '@/lib/designStudio/identifiers';
import { buildVersionLabelMap } from '@/lib/estimates/server';
import { loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';

type StaffClient = Extract<Awaited<ReturnType<typeof requireStaffContext>>, { ok: true }>['supabase'];

export async function loadStudioProjectName(supabase: StaffClient, projectUuid: string, signal?: AbortSignal): Promise<string | null> {
  signal?.throwIfAborted();
  const query = supabase.from('projects').select('id,name').eq('id', projectUuid);
  const result = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  signal?.throwIfAborted();
  return !result.error && result.data?.id === projectUuid && typeof result.data.name === 'string' ? result.data.name : null;
}

/** Uses the page's authenticated client so project visibility remains RLS-owned. */
export async function loadStudioProject(supabase: StaffClient, projectUuid: string) {
  const visible = await supabase.from('projects').select('id,name').eq('id', projectUuid).maybeSingle();
  if (!visible.data) return null;
  const result = await supabase.from('estimates')
    .select('id,internal_name,status,outputs,created_at,commercial_scope_id')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  if (result.error) return { project: visible.data, designs: [], loadError: true };
  const rows = result.data ?? [];
  // Match Project metadata and detail-label queries: legacy row.version is not
  // part of their version projection. Include every project row before filtering.
  const labels = buildVersionLabelMap(rows);
  const flow = await loadProjectEstimateFlowMaps(projectUuid, rows, supabase).catch(() => null);
  const designs = rows.filter(row => row.outputs?.studio_authored).map(row => {
    const lock = flow?.editabilityByEstimateId.get(row.id);
    const quoted = Boolean(lock?.isLocked || lock?.hasDraftQuotes || lock?.draftQuoteCount);
    return {
    id: studioIdentifier(row.id, 'est').appId,
    label: row.internal_name || 'Untitled Studio design',
    versionLabel: labels.get(row.id) ?? 'V-',
    createdAt: row.created_at,
    history: !flow ? 'Quote history unavailable' : quoted ? 'Used by a quote' : row.status === 'archived' ? 'Archived design' : flow.flowByEstimateId.get(row.id)?.isActiveDraft ? 'Current draft' : 'Saved draft',
    quoteLabel: lock?.lockedByQuoteRef ? `${lock.lockedByQuoteRef} · quote revision ${lock.lockedByQuoteVersionNumber ?? 'unavailable'}` : null,
    // The authoring loader still rechecks actual authority before any command.
    canOpenEditor: Boolean(lock && !quoted && row.status === 'draft'),
    status: row.status,
  };});
  return { project: visible.data, designs, loadError: Boolean(result.error) };
}
