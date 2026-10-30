import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEstimateVersionLabels } from '@/lib/estimates/loadProjectEstimateDetail';
import { loadEstimateQuoteEditability } from '@/lib/estimates/flow';
import { mapEstimateDetail } from '@/lib/estimates/server';
import { loadStudioProjectName } from '@/lib/queries/studioProject.server';
import type { StudioReviewDiagnostics } from './studioReviewDiagnostics.server';
import { loadPortalThemeForUser, portalThemeStyleVars } from '@/lib/theme/server';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Exact caller-visible target and quote authority. Review does not consume
 * project active-draft/job-pack flow; keep that separate generic loader intact. */
export async function loadStudioReviewEstimateContext(client: SupabaseClient, request: Request,
  projectUuid: string, estimateUuid: string, diagnostics: StudioReviewDiagnostics, presentationActor?: string, legacyDraft = false) {
  request.signal.throwIfAborted();
  const children = new AbortController();
  const cancel = () => children.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const context = Promise.allSettled([
    diagnostics.measure('version-metadata', () => resolveEstimateVersionLabels(client, projectUuid, children.signal)),
    diagnostics.measure('quote-authority', () => loadEstimateQuoteEditability([estimateUuid], client, children.signal)),
    diagnostics.measure('project-display', () => loadStudioProjectName(client, projectUuid, children.signal)),
    legacyDraft ? diagnostics.measure('legacy-draft', () => client.from('quote_versions')
      .select('id,status,pricing_source_metadata,source_estimate_version_id,quotes!inner(project_id,commercial_scope_id)')
      .eq('source_estimate_version_id', estimateUuid).eq('quotes.project_id', projectUuid)
      .not('pricing_source_metadata->studioQuoteDraft', 'is', null).abortSignal(children.signal).limit(2)) : Promise.resolve(null),
    presentationActor ? diagnostics.measure('theme', () => loadPortalThemeForUser(presentationActor, { client, signal: children.signal }).then(portalThemeStyleVars)).catch(() => ({})) : Promise.resolve(null),
  ]);
  let complete = false;
  try {
    const target = await diagnostics.measure('target', () => client.from('estimates').select('*')
      .eq('id', estimateUuid).eq('project_id', projectUuid).abortSignal(children.signal).maybeSingle());
    if (target.error) return { state: 'unavailable' as const };
    const row = record(target.data);
    if (!row || row.id !== estimateUuid || row.project_id !== projectUuid) return { state: 'missing' as const };
    const [versions, authority, project, legacy, theme] = await context;
    request.signal.throwIfAborted();
    complete = true;
    if (versions.status === 'rejected') throw versions.reason;
    if (authority.status === 'rejected') throw authority.reason;
    if (project.status === 'rejected') throw project.reason;
    const editability = authority.value.get(estimateUuid);
    if (!editability) throw Error('Estimate quote authority is unavailable.');
    // Canonical detail projection remains unchanged. Its project flow fields
    // are not part of SavedEstimateReview and are never asserted by this owner.
    return { state: 'ready' as const,
      estimate: mapEstimateDetail(row, versions.value.get(estimateUuid) ?? 'V-', editability),
      versionLabels: versions.value, projectName: project.value,
      legacyDraft: legacy.status === 'fulfilled' ? legacy.value : {data:null,error:true},
      theme: theme.status === 'fulfilled' ? theme.value ?? {} : {} };
  } finally {
    if (!complete) children.abort();
    request.signal.removeEventListener('abort', cancel);
  }
}

/** Reference-only saved price. Never supplies edit permission for the target. */
export async function loadStudioReviewReference(client: SupabaseClient, request: Request,
  projectUuid: string, estimateUuid: string, versionLabels: Map<string, string>) {
  request.signal.throwIfAborted();
  const result = await client.from('estimates').select('*').eq('id', estimateUuid).eq('project_id', projectUuid)
    .abortSignal(request.signal).maybeSingle();
  request.signal.throwIfAborted();
  if (result.error) throw result.error;
  const row = record(result.data);
  if (!row || row.id !== estimateUuid || row.project_id !== projectUuid) return null;
  return mapEstimateDetail(row, versionLabels.get(estimateUuid) ?? 'V-');
}
