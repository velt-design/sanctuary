import { apiJson } from '@/lib/repo/apiClient';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import type { StudioAuthoringResponse } from './authoringRequest.server';
import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { parseStudioWebsiteDesign } from './websiteDesign';
import { createStudioSaveSession, type StudioSaveSession } from './saveSession';
import { retireRejectedStudioCommand, type StudioSaveScope } from './saveTransport';
import { canUseSavedStudioWorkingCopy, readStudioWorkingCopy, retainStudioSession, retainStudioWorkingCopy, persistStudioWorkingCopy, type StudioRetainedCopy } from './workingCopy';

/** Explicit local recovery only: preserve first, then load the fresh saved basis.
 * No server write, pending replay, or merge of commercial/deletion provenance. */
export async function useSavedStudioDesign(scope: StudioSaveScope, expectedToken: string, localSession?: StudioSaveSession, canAct: () => boolean = () => true) {
  const found = await readStudioWorkingCopy(scope);
  if (!canAct() || !canUseSavedStudioWorkingCopy(found, localSession) || (found.state !== 'valid' && found.state !== 'recovery') || !found.session || !found.token ||
    (found.token !== expectedToken && !localSession)) throw Error('The retained work changed or has an unresolved save. Nothing was replaced.');
  const token = found.token;
  const retainedCopies: StudioRetainedCopy[] = [];
  // Preserve both the accepted in-memory edit and any different durable edit.
  if (localSession && JSON.stringify(localSession) !== JSON.stringify(found.session)) retainedCopies.push(await retainStudioSession(scope, localSession));
  const retained = await retainStudioWorkingCopy(scope, token);
  retainedCopies.push(retained);
  if (!canAct()) throw Error('Recovery is paused. Your retained work is kept.');
  const { authoring } = await apiJson<{ authoring: StudioAuthoringResponse }>(`/api/projects/${encodeURIComponent(scope.projectId)}/estimates/${encodeURIComponent(scope.estimateId)}/studio`);
  if (!canAct() || getLocalFirstStoreOwner() !== scope.actorId || authoring.state !== 'ready' || authoring.nextAction !== 'edit' || !authoring.view || authoring.view.designId !== scope.designId || authoring.estimate.id !== scope.estimateId || authoring.estimate.projectId !== scope.projectId || authoring.estimate.requiresNewRevision || authoring.view.revision < Math.max(retained.session.baseRevision, localSession?.baseRevision ?? 0)) throw Error('The saved design could not be verified for editing. Your retained work is kept.');
  const session = createStudioSaveSession(scope, authoring.view, authoring.estimate.updatedAt);
  session.generation = Math.max(retained.session.generation, localSession?.generation ?? 0);
  const result = await persistStudioWorkingCopy(scope, session, token, canAct);
  if (result.state !== 'persisted') throw Error(result.message);
  // Never retire before the clean replacement commits, and never retire unknown
  // outcomes or a journal body/receipt concurrently changed by another editor.
  if (found.state === 'recovery') {
    for (const entry of found.journal.entries) {
      if (entry.recovery.state !== 'valid' || !(await retireRejectedStudioCommand(scope, entry.recovery, canAct))) throw Error('Your copies are kept. Reload to finish reconciling the retained request.');
    }
  }
  const current = await readStudioWorkingCopy(scope);
  if (!canAct() || current.state !== 'valid' || current.token !== result.token) throw Error('Newer local work or another retained request needs reconciliation. Your copies are kept.');
  return { session, token: result.token, retained, retainedCopies, updatedAt: authoring.estimate.updatedAt };
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
