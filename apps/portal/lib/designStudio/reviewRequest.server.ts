import 'server-only';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { loadProjectEstimateDetail } from '@/lib/estimates/loadProjectEstimateDetail';
import { getQuoteVersionDetail } from '@/lib/quotes/server';
import { studioIdentifier as canonicalId } from './identifiers';
import { parseStudioAuthored, STUDIO_OUTPUT_KEY } from './contracts';
import { buildSavedEstimateReview } from './savedReview';
import { studioPriceUuid } from './pricedCandidate';
import { projectStudioWebsiteBrief } from './websiteBrief.server';
import { loadStudioProjectName } from '@/lib/queries/studioProject.server';
import { studioDesignIdentity } from './studioDesignIdentity';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

async function readReview(request: Request, ids: { projectId: string; estimateId: string }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  if (request.method !== 'GET') return jsonError('Method not allowed', 405);
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (auth.session.role !== 'admin' && auth.session.role !== 'staff') return jsonError('Staff access is required', 403);

  let project: ReturnType<typeof canonicalId>, estimateId: ReturnType<typeof canonicalId>;
  let quoteId: ReturnType<typeof canonicalId> | null;
  try {
    project = canonicalId(ids.projectId, 'proj');
    estimateId = canonicalId(ids.estimateId, 'est');
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => key !== 'quoteVersionId') || params.getAll('quoteVersionId').length > 1) {
      return jsonError('Invalid review query', 400);
    }
    quoteId = params.has('quoteVersionId') ? canonicalId(params.get('quoteVersionId')!, 'qv') : null;
  } catch {
    return jsonError('Invalid review identifier', 400);
  }

  // This owner uses the caller's authenticated client and a project+estimate
  // predicate. Raw snapshots stay on the server and never enter the response.
  const estimate = await loadProjectEstimateDetail(project.appId, estimateId.appId);
  if (!estimate || estimate.id !== estimateId.appId || estimate.projectId !== project.appId) return jsonError('Estimate not found', 404);

  const outputs = record(record(estimate.calculatorSnapshot)?.outputs);
  const hasAuthored = Boolean(outputs && Object.hasOwn(outputs, STUDIO_OUTPUT_KEY));
  const authored = hasAuthored ? parseStudioAuthored(outputs![STUDIO_OUTPUT_KEY]) : null;
  let quote = null;
  let studioDraft: { quoteVersionId: string } | undefined;
  if (quoteId) {
    // The established detail loader is privileged. Prove caller visibility and
    // association first, then recheck its exact returned version before projection.
    const visible = await auth.supabase.from('quote_versions')
      .select('id,status,pricing_source_metadata,source_estimate_version_id,quotes!inner(project_id,commercial_scope_id)')
      .eq('id', quoteId.uuid).eq('source_estimate_version_id', estimateId.uuid)
      .eq('quotes.project_id', project.uuid).maybeSingle();
    if (visible.error) return jsonError('Could not verify quote access', 503);
    const row = record(visible.data);
    const parent = record(Array.isArray(row?.quotes) ? row.quotes[0] : row?.quotes);
    if (!row || row.id !== quoteId.uuid || row.source_estimate_version_id !== estimateId.uuid ||
      parent?.project_id !== project.uuid || (parent.commercial_scope_id ?? null) !== (estimate.commercialScopeId ?? null)) {
      return jsonError('Quote not found for this estimate', 404);
    }
    const metadata = record(row.pricing_source_metadata);
    if (metadata && Object.hasOwn(metadata, 'studioQuoteDraft')) {
      if (!hasAuthored || metadata.studioQuoteDraft !== 'studio_quote_draft.v1' || row.status !== 'DRAFT') {
        return jsonError('Protected Studio draft is unsupported', 409);
      }
      studioDraft = { quoteVersionId: quoteId.appId };
    } else {
      quote = await getQuoteVersionDetail(quoteId.appId);
      if (!quote || quote.id !== quoteId.appId || quote.projectId !== project.appId ||
        quote.sourceEstimateVersionId !== estimate.id ||
        (quote.commercialScopeId ?? null) !== (estimate.commercialScopeId ?? null) ||
        (quote.commercialScopeKind ?? 'base') !== (estimate.commercialScopeKind ?? 'base')) {
        return jsonError('Quote not found for this estimate', 404);
      }
    }
  } else if (hasAuthored) {
    // DRAFT references do not populate lockedByQuoteVersionId. Discover the
    // separate protected source through caller visibility, never a service read.
    // Do not filter by creation flag or exact marker: future markers must fail
    // explicitly rather than silently fall back to the estimate's old totals.
    const visible = await auth.supabase.from('quote_versions')
      .select('id,status,pricing_source_metadata,source_estimate_version_id,quotes!inner(project_id,commercial_scope_id)')
      .eq('source_estimate_version_id', estimateId.uuid).eq('quotes.project_id', project.uuid)
      .not('pricing_source_metadata->studioQuoteDraft', 'is', null).limit(2);
    if (visible.error) return jsonError('Could not verify Studio draft access', 503);
    if (!Array.isArray(visible.data)) return jsonError('Could not verify Studio draft access', 503);
    if (visible.data.length > 1) return jsonError('Protected Studio draft association is ambiguous', 409);
    if (visible.data.length === 1) {
      const row = record(visible.data[0]);
      const parent = record(Array.isArray(row?.quotes) ? row.quotes[0] : row?.quotes);
      if (!row || !studioPriceUuid(row.id) || row.source_estimate_version_id !== estimateId.uuid ||
        parent?.project_id !== project.uuid || (parent.commercial_scope_id ?? null) !== (estimate.commercialScopeId ?? null)) {
        return jsonError('Quote not found for this estimate', 404);
      }
      if (record(row.pricing_source_metadata)?.studioQuoteDraft !== 'studio_quote_draft.v1' || row.status !== 'DRAFT') {
        return jsonError('Protected Studio draft is unsupported', 409);
      }
      studioDraft = { quoteVersionId: `qv_${row.id}` };
    }
  }

  let sourceEstimate = null;
  if (authored?.ok && authored.value.provenance.sourceEstimateId) {
    let sourceId: ReturnType<typeof canonicalId> | null = null;
    try { sourceId = canonicalId(authored.value.provenance.sourceEstimateId, 'est'); } catch { /* Invalid historic identity remains unavailable. */ }
    if (sourceId && sourceId.appId !== estimate.id) {
      const source = await loadProjectEstimateDetail(project.appId, sourceId.appId);
      if (source?.id === sourceId.appId && source.projectId === project.appId &&
        (source.commercialScopeId ?? null) === (estimate.commercialScopeId ?? null) &&
        (source.commercialScopeKind ?? 'base') === (estimate.commercialScopeKind ?? 'base')) sourceEstimate = source;
    }
  }
  const websiteBrief = !quoteId ? projectStudioWebsiteBrief({ id: estimateId.uuid, project_id: project.uuid, outputs }) : null;
  return jsonOk({ review: { ...buildSavedEstimateReview({ estimate, quote, sourceEstimate, viewerRole: auth.session.role }),
    identity: studioDesignIdentity(estimate, await loadStudioProjectName(auth.supabase, project.uuid)),
    ...(websiteBrief ? { websiteBrief } : {}) },
    ...(studioDraft ? { studioDraft } : {}) });
}

/** GET boundary for route composition; no raw errors, snapshots or caller roles escape. */
export async function reviewStudioSavedRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  let response: Response;
  try { response = await readReview(request, ids); }
  catch { response = jsonError('Saved review is temporarily unavailable. Please retry.', 503, null, { code: 'STUDIO_REVIEW_UNAVAILABLE' }); }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
