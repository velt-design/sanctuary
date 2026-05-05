import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export type RoofStyleLabel = 'Pitched' | 'Gable' | 'Hip' | 'Box' | 'Multiple Modules';
export type MaterialLabel = 'Acrylic' | 'Timber' | 'Both';

const STYLE_LABELS: Record<string, Exclude<RoofStyleLabel, 'Multiple Modules'>> = {
  pitched: 'Pitched',
  gable: 'Gable',
  hip: 'Hip',
  hip_corner: 'Hip',
  box_perimeter: 'Box',
};

function deriveRoofStyleLabel(modules: unknown): RoofStyleLabel | null {
  if (!Array.isArray(modules) || modules.length === 0) return null;
  if (modules.length > 1) return 'Multiple Modules';
  const style = String((modules[0] as { pergolaStyle?: unknown })?.pergolaStyle ?? '').toLowerCase();
  return STYLE_LABELS[style] ?? null;
}

function deriveMaterialLabel(modules: unknown): MaterialLabel | null {
  if (!Array.isArray(modules) || modules.length === 0) return null;
  const seen = new Set<string>();
  for (const mod of modules as Array<{ roofMaterial?: unknown }>) {
    const raw = String(mod?.roofMaterial ?? '').toLowerCase();
    if (raw === 'mixed') return 'Both';
    if (raw === 'acrylic' || raw === 'timber') seen.add(raw);
  }
  if (seen.has('acrylic') && seen.has('timber')) return 'Both';
  if (seen.has('acrylic')) return 'Acrylic';
  if (seen.has('timber')) return 'Timber';
  return null;
}

function modulesFromEstimateRow(row: unknown): unknown[] {
  const inputs = (row as { inputs?: unknown })?.inputs;
  const modules = (inputs as { modules?: unknown })?.modules;
  return Array.isArray(modules) ? (modules as unknown[]) : [];
}

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const projectRes = await supabase
    .from('projects')
    .select('id, contact_id, name')
    .eq('id', projectUuid)
    .maybeSingle();
  if (projectRes.error || !projectRes.data) return jsonError('Project not found', 404);
  const projectRow = projectRes.data as { contact_id?: string | null; name?: string | null };

  let clientName: string | null = null;
  if (projectRow.contact_id) {
    const contactRes = await supabase.from('contacts').select('name').eq('id', projectRow.contact_id).maybeSingle();
    if (!contactRes.error && contactRes.data) {
      const raw = (contactRes.data as { name?: unknown }).name;
      if (typeof raw === 'string' && raw.trim()) clientName = raw.trim();
    }
  }

  let totalCents: number | null = null;
  let source: 'quote' | 'estimate' | 'none' = 'none';
  let modules: unknown[] = [];

  const acceptedRes = await supabase
    .from('quote_versions')
    .select('id, total_inc_gst_cents, source_estimate_version_id, created_at, quotes!inner(project_id)')
    .eq('status', 'ACCEPTED')
    .eq('quotes.project_id', projectUuid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let acceptedEstimateUuid: string | null = null;
  if (!acceptedRes.error && acceptedRes.data) {
    const row = acceptedRes.data as { total_inc_gst_cents?: number | null; source_estimate_version_id?: string | null };
    const cents = Number(row.total_inc_gst_cents ?? 0);
    if (Number.isFinite(cents) && cents > 0) {
      totalCents = Math.round(cents);
      source = 'quote';
    }
    if (typeof row.source_estimate_version_id === 'string' && row.source_estimate_version_id) {
      acceptedEstimateUuid = row.source_estimate_version_id;
    }
  }

  if (acceptedEstimateUuid) {
    const estRes = await supabase.from('estimates').select('inputs').eq('id', acceptedEstimateUuid).maybeSingle();
    if (!estRes.error && estRes.data) {
      modules = modulesFromEstimateRow(estRes.data);
    }
  }

  if (!modules.length) {
    const latestRes = await supabase
      .from('estimates')
      .select('inputs, outputs, created_at')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestRes.error && latestRes.data) {
      modules = modulesFromEstimateRow(latestRes.data);
      if (totalCents === null) {
        const inc = Number(((latestRes.data as { outputs?: { totals?: { cost_inc_gst?: unknown } } }).outputs?.totals?.cost_inc_gst) ?? 0);
        if (Number.isFinite(inc) && inc > 0) {
          totalCents = Math.round(inc * 100);
          source = 'estimate';
        }
      }
    }
  }

  return jsonOk({
    clientName,
    roofStyleLabel: deriveRoofStyleLabel(modules),
    materialLabel: deriveMaterialLabel(modules),
    totalCents,
    source,
  });
}
