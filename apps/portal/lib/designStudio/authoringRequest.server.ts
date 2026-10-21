import 'server-only';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { loadProjectEstimateDetail } from '@/lib/estimates/loadProjectEstimateDetail';
import { studioIdentifier } from './identifiers';
import { projectStudioAuthoringView, type StudioAuthoringView } from './authoringView';
import { STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY } from './contracts';
import {projectStudioWebsiteBrief} from './websiteBrief.server';
import type {StudioWebsiteBrief} from './websiteBrief';
import {readStudioQuoteHandoff} from './quoteSnapshot';
import { studioDesignIdentity, type StudioDesignIdentity } from './studioDesignIdentity';
import { loadStudioProjectName } from '@/lib/queries/studioProject.server';

export type StudioAuthoringResponse = {
  state: 'ready' | 'needs-import' | 'unavailable';
  estimate: { id: string; projectId: string; versionLabel: string; updatedAt: string | null; requiresNewRevision: boolean };
  view: StudioAuthoringView | null;
  reason: string | null;
  nextAction: 'edit' | 'create-revision' | 'import' | 'website-import' | 'import-required' | 'unavailable';
  websiteBrief?: StudioWebsiteBrief;
  preparedQuote?: {snapshotId:string;contentHash:string};
  identity?: StudioDesignIdentity;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

async function readAuthoring(request: Request, ids: { projectId: string; estimateId: string }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  if (request.method !== 'GET') return jsonError('Method not allowed', 405);
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (auth.session.role !== 'staff' && auth.session.role !== 'admin') return jsonError('Staff access is required', 403);
  let project: ReturnType<typeof studioIdentifier>, estimate: ReturnType<typeof studioIdentifier>;
  try {
    project = studioIdentifier(ids.projectId, 'proj');
    estimate = studioIdentifier(ids.estimateId, 'est');
    if ([...new URL(request.url).searchParams.keys()].length) return jsonError('Invalid authoring query', 400);
  } catch { return jsonError('Invalid authoring identifier', 400); }

  const result = await auth.supabase.from('estimates')
    .select('*')
    .eq('id', estimate.uuid).eq('project_id', project.uuid).maybeSingle();
  if (result.error) return jsonError('Could not load this saved design', 503);
  const row = record(result.data);
  if (!row || row.id !== estimate.uuid || row.project_id !== project.uuid) return jsonError('Estimate not found', 404);
  // Reuse the existing authenticated editability/quote association owner. Save
  // must still atomically recheck its lock and revision; a GET grants no write.
  const detail = await loadProjectEstimateDetail(project.appId, estimate.appId);
  if (!detail || detail.id !== estimate.appId || detail.projectId !== project.appId) return jsonError('Estimate not found', 404);
  const requiresNewRevision = detail.editability.isLocked || detail.editability.hasDraftQuotes ||
    detail.editability.draftQuoteCount > 0 || detail.status === 'archived' || row.status === 'archived';
  const metadata = { id: estimate.appId, projectId: project.appId, versionLabel: detail.versionLabel,
    updatedAt: typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at)) ? row.updated_at : null, requiresNewRevision };
  const outputs = record(row.outputs);
  const websiteBrief=projectStudioWebsiteBrief(row);
  let authoring: StudioAuthoringResponse;
  if (!outputs || !['draft', 'archived'].includes(String(row.status)) ||
    !(row.updated_at === null || (typeof row.updated_at === 'string' && Number.isFinite(Date.parse(row.updated_at))))) {
    authoring = { state: 'unavailable', estimate: metadata, view: null, reason: 'The saved design record is incomplete.', nextAction: 'unavailable' };
  } else if (!Object.hasOwn(outputs, STUDIO_OUTPUT_KEY)) {
    authoring = { state: 'unavailable', estimate: metadata, view: null, reason: 'This historical estimate remains available in its existing calculator and saved review. Start a new Studio design for website product choices.', nextAction: 'unavailable' };
  } else {
    const projected = projectStudioAuthoringView({ authored: outputs[STUDIO_OUTPUT_KEY], spatial: outputs[STUDIO_SPATIAL_OUTPUT_KEY] });
    authoring = projected.ok
      ? { state: 'ready', estimate: metadata, view: projected.value, reason: null, nextAction: requiresNewRevision ? 'create-revision' : 'edit' }
      : { state: 'unavailable', estimate: metadata, view: null, reason: 'This saved studio design cannot be edited by this client.', nextAction: 'unavailable' };
  }
  const handoff=authoring.state==='ready'&&!requiresNewRevision?readStudioQuoteHandoff(outputs):null;
  return jsonOk({ authoring: {...authoring,identity:studioDesignIdentity(detail,await loadStudioProjectName(auth.supabase,project.uuid)),...(websiteBrief?{websiteBrief}:{}),...(handoff?{preparedQuote:{snapshotId:handoff.snapshotId,contentHash:handoff.contentHash}}:{})} });
}

/** Caller-bound read only. The DTO owner strips opaque provenance and private
 * output fields for both staff and admins before anything reaches the browser. */
export async function loadStudioAuthoringRequest(request: Request, ids: { projectId: string; estimateId: string }) {
  let response: Response;
  try { response = await readAuthoring(request, ids); }
  catch { response = jsonError('Saved design is temporarily unavailable. Please retry.', 503, null, { code: 'STUDIO_AUTHORING_UNAVAILABLE' }); }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
