import { apiJson } from '@/lib/repo/apiClient';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import type { StudioAuthoringResponse } from './authoringRequest.server';
import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { parseStudioWebsiteDesign } from './websiteDesign';
import { createStudioSaveSession } from './saveSession';
import type { StudioSaveScope } from './saveTransport';
import { retainStudioWorkingCopy, persistStudioWorkingCopy, type StudioRetainedCopy } from './workingCopy';

/** Explicit local recovery only: preserve first, then load the fresh saved basis.
 * No server write, pending replay, or merge of commercial/deletion provenance. */
export async function useSavedStudioDesign(scope: StudioSaveScope, expectedToken: string) {
  const retained = await retainStudioWorkingCopy(scope, expectedToken);
  const { authoring } = await apiJson<{ authoring: StudioAuthoringResponse }>(`/api/projects/${encodeURIComponent(scope.projectId)}/estimates/${encodeURIComponent(scope.estimateId)}/studio`);
  if (getLocalFirstStoreOwner() !== scope.actorId || authoring.state !== 'ready' || authoring.nextAction !== 'edit' || !authoring.view || authoring.view.designId !== scope.designId || authoring.estimate.id !== scope.estimateId || authoring.estimate.projectId !== scope.projectId || authoring.estimate.requiresNewRevision || authoring.view.revision < retained.session.baseRevision) throw Error('The saved design could not be verified for editing. Your retained work is kept.');
  const session = createStudioSaveSession(scope, authoring.view, authoring.estimate.updatedAt);
  session.generation = retained.session.generation;
  const result = await persistStudioWorkingCopy(scope, session, expectedToken);
  if (result.state !== 'persisted') throw Error(result.message);
  return { session, token: result.token, retained, updatedAt: authoring.estimate.updatedAt };
}

/** Restore just this supported object's complete website intent onto today's
 * saved basis. Site/commercial values, positions and deletion history stay put. */
export function restoreRetainedWebsiteChoices(current: StudioAuthoringEdit, retained: StudioRetainedCopy): StudioAuthoringEdit {
  const source = retained.session.edit;
  if (source.designId !== current.designId || source.spatial.pergolas.length !== 1 || current.spatial.pergolas.length !== 1) throw Error('This retained copy needs separate design reconciliation; it has not been changed.');
  const objectId = current.spatial.pergolas[0].id;
  if (source.spatial.pergolas[0].id !== objectId) throw Error('These retained choices belong to a different object.');
  const sourceRow = source.objectOptions.find(row => row.objectId === objectId), target = current.objectOptions.find(row => row.objectId === objectId);
  const parsed = parseStudioWebsiteDesign(sourceRow?.values.websiteDesign, objectId);
  if (!parsed.ok || !target?.values.websiteDesign) throw Error('This retained copy is not a supported website design.');
  const next = structuredClone(current);
  next.objectOptions.find(row => row.objectId === objectId)!.values.websiteDesign = structuredClone(sourceRow!.values.websiteDesign!);
  next.spatial.pergolas[0].family = parsed.value.selection.roof.family;
  const safe = parseStudioAuthoringEdit(next);
  if (!safe.ok) throw Error(safe.message);
  return safe.value;
}
