import { rebaseStudioDuplications } from './pergolaDuplicationRebase';
import { createStudioAuthoringEdit, parseStudioAuthoringEdit, type StudioAuthoringEdit, type StudioAuthoringView } from './authoringView';
import type { StudioPendingCommand, StudioSaveScope, StudioSaveReceipt } from './saveTransport';

export type { StudioSaveReceipt } from './saveTransport';
export type StudioSaveSession = {
  scope: StudioSaveScope;
  baseRevision: number;
  baselinePergolaIds?: string[];
  baselineObjectOptions?: StudioAuthoringEdit['objectOptions'];
  baseUpdatedAt: string | null;
  edit: StudioAuthoringEdit;
  generation: number;
  dirty: boolean;
  status: 'idle' | 'pending' | 'uncertain' | 'conflict' | 'rejected';
  pending: { command: StudioPendingCommand; generation: number } | null;
};

/** Safe DTO only; private server envelopes never belong in a working copy. */
export function createStudioSaveSession(scope: StudioSaveScope, view: StudioAuthoringView, updatedAt: string | null): StudioSaveSession {
  const parsed = parseStudioAuthoringEdit(createStudioAuthoringEdit(view));
  if (!parsed.ok || scope.designId !== view.designId || (updatedAt !== null && !Number.isFinite(Date.parse(updatedAt)))) throw new Error('Invalid saved design');
  return { scope: structuredClone(scope), baseRevision: view.revision, baseUpdatedAt: updatedAt,
    baselinePergolaIds: view.spatial.pergolas.map(p => p.id), baselineObjectOptions: structuredClone(view.objectOptions), edit: parsed.value, generation: 0, dirty: false, status: 'idle', pending: null };
}

/** Edits may continue during a request; its frozen command remains unchanged. */
export function changeStudioSaveSession(state: StudioSaveSession, edit: StudioAuthoringEdit): StudioSaveSession {
  if (state.pending) {
    const existing = new Map((state.edit.duplications ?? []).map(op => [op.targetId, JSON.stringify(op)]));
    if ((edit.duplications ?? []).some(op => existing.get(op.targetId) !== JSON.stringify(op))) throw Error('Finish saving before making another copy.');
  }
  const parsed = parseStudioAuthoringEdit(edit);
  if (!parsed.ok || edit.designId !== state.scope.designId || edit.revision !== state.baseRevision) throw new Error('Invalid working design');
  if (!Number.isSafeInteger(state.generation + 1)) throw new Error('Reload before continuing this editing session');
  return { ...structuredClone(state), edit: parsed.value, generation: state.generation + 1, dirty: true };
}

/** Transport must durably retain this command before sending it. Calling again
 * during uncertainty returns the original command, even after further edits. */
export function prepareStudioSave(state: StudioSaveSession, requestId: string): StudioSaveSession {
  if (state.status === 'conflict' || state.status === 'rejected') throw new Error('Resolve the previous save before continuing');
  if (state.pending) return structuredClone(state);
  if (!state.dirty) return structuredClone(state);
  if (state.status !== 'idle') throw new Error('Resolve the previous save before continuing');
  return { ...structuredClone(state), status: 'pending', pending: { generation: state.generation,
    command: { requestId, expectedUpdatedAt: state.baseUpdatedAt, expectedRevision: state.baseRevision, edit: structuredClone(state.edit) } } };
}

function remainingDeletions(current: StudioAuthoringEdit['deletions'], sent: StudioAuthoringEdit['deletions']) {
  return current.flatMap<StudioAuthoringEdit['deletions'][number]>(deletion => {
    if (deletion.scope === 'object-options') return sent.some(item => item.scope === deletion.scope && item.objectId === deletion.objectId) ? [] : [deletion];
    if (deletion.scope === 'object-option') return sent.some(item => item.scope === deletion.scope && item.objectId === deletion.objectId && item.field === deletion.field) ? [] : [deletion];
    const acknowledged = sent.filter(item => item.scope === deletion.scope && 'collection' in item && item.collection === deletion.collection
      && (item.scope !== 'object' || (deletion.scope === 'object' && item.objectId === deletion.objectId)));
    const ids = deletion.ids.filter(id => !acknowledged.some(item => 'ids' in item && item.ids.includes(id)));
    return ids.length ? [{ ...deletion, ids }] : [];
  });
}

export function settleStudioSave(state: StudioSaveSession, requestId: string,
  result: { kind: 'success'; receipt: StudioSaveReceipt } | { kind: 'uncertain' | 'conflict' | 'rejected' }): StudioSaveSession {
  if (!state.pending || state.pending.command.requestId !== requestId) return structuredClone(state);
  if (result.kind !== 'success') return { ...structuredClone(state), status: result.kind };
  const { receipt } = result;
  if (!Number.isSafeInteger(receipt.revision) || ![state.baseRevision, state.baseRevision + 1].includes(receipt.revision)
    || !Number.isFinite(Date.parse(receipt.savedAt)) || typeof receipt.alreadyExisted !== 'boolean') {
    return { ...structuredClone(state), status: 'uncertain' };
  }
  const edit = structuredClone(state.edit);
  try { if (edit.duplications) edit.duplications = rebaseStudioDuplications(edit, state.pending.command.edit); }
  catch { return { ...structuredClone(state), status: 'uncertain' }; }
  edit.revision = receipt.revision;
  edit.deletions = remainingDeletions(edit.deletions, state.pending.command.edit.deletions);
  return { ...structuredClone(state), edit, baselinePergolaIds: state.pending.command.edit.spatial.pergolas.map(p => p.id), baselineObjectOptions: structuredClone(state.pending.command.edit.objectOptions), baseRevision: receipt.revision, baseUpdatedAt: receipt.savedAt,
    dirty: state.generation !== state.pending.generation, pending: null, status: 'idle' };
}

/** Only a definitive validation rejection can discard its request identity.
 * Conflict resolution requires a fresh saved base; uncertain sends must retry. */
export function discardRejectedStudioRequest(state: StudioSaveSession): StudioSaveSession {
  if (state.status !== 'rejected') throw new Error('This request must be reconciled with the server');
  return { ...structuredClone(state), pending: null, status: 'idle' };
}
