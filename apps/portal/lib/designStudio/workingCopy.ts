import { get, keys, update } from 'idb-keyval';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import { parseStudioAuthoringEdit, parseStudioObjectOptions } from './authoringView';
import { isStudioObject } from './contracts';
import { studioIdentifier } from './identifiers';
import type { StudioSaveSession } from './saveSession';
import { listStudioPendingCommands, studioPendingCommandKey, type StudioPendingDiscovery, type StudioSaveScope } from './saveTransport';

const VERSION = 'studio_working_copy.v1';
const MAX_BYTES = 5 * 1024 * 1024;
const probe = { expectedRevision: 1, requestId: '00000000-0000-4000-8000-000000000001' };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => isStudioObject(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && Number(value) >= minimum;
const timestamp = (value: unknown) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)));
const owner = (scope: StudioSaveScope) => getLocalFirstStoreOwner() === scope.actorId;
function scopeValue(raw: StudioSaveScope): StudioSaveScope {
  studioPendingCommandKey(raw, probe); // Existing journal owns scope validation.
  return { actorId: raw.actorId, projectId: studioIdentifier(raw.projectId, 'proj').appId, estimateId: studioIdentifier(raw.estimateId, 'est').appId, designId: raw.designId };
}
export function studioWorkingCopyKey(raw: StudioSaveScope): string {
  const scope = scopeValue(raw);
  return `sanctuary-studio-working-copy:v1:${[scope.actorId, scope.projectId, scope.estimateId, scope.designId].map(encodeURIComponent).join(':')}`;
}

export type StudioWorkingCopyRead =
  | { state: 'absent' }
  | { state: 'valid'; session: StudioSaveSession; token: string }
  | { state: 'recovery'; session: StudioSaveSession | null; token: string | null; journal: Extract<StudioPendingDiscovery, { state: 'available' }>; message: string }
  | { state: 'corrupt' | 'unsupported' | 'unavailable'; message: string };
export type StudioWorkingCopyWrite = { state: 'persisted'; token: string } | { state: 'conflict' | 'invalid' | 'unavailable'; message: string };

/** Validate the existing controller state, without introducing a second editor schema. */
function sessionValue(value: unknown, scope: StudioSaveScope): StudioSaveSession | null {
  if (!exact(value, ['scope', 'baseRevision', 'baseUpdatedAt', 'edit', 'generation', 'dirty', 'status', 'pending', ...(isStudioObject(value) && Object.hasOwn(value, 'baselinePergolaIds') ? ['baselinePergolaIds'] : []), ...(isStudioObject(value) && Object.hasOwn(value, 'baselineObjectOptions') ? ['baselineObjectOptions'] : [])]) || !same(value.scope, scope) ||
    !integer(value.baseRevision, 1) || !integer(value.generation) || !timestamp(value.baseUpdatedAt) || typeof value.dirty !== 'boolean' ||
    typeof value.status !== 'string' || !['idle', 'pending', 'uncertain', 'conflict', 'rejected'].includes(value.status)) return null;
  if (value.baselinePergolaIds !== undefined && (!Array.isArray(value.baselinePergolaIds) || value.baselinePergolaIds.some(id => typeof id !== 'string' || !id.trim() || id.trim() !== id) || new Set(value.baselinePergolaIds).size !== value.baselinePergolaIds.length)) return null;
  const edit = parseStudioAuthoringEdit(value.edit);
  if (value.baselineObjectOptions !== undefined) {
    if (!edit.ok) return null;
    const baseline = parseStudioObjectOptions(value.baselineObjectOptions);
    if (!baseline.ok || (baseline.value.length > 0 && !Array.isArray(value.baselinePergolaIds))) return null;
    if (baseline.value.some(row => !(value.baselinePergolaIds as string[]).includes(row.objectId))) return null;
  }
  if (!edit.ok || edit.value.designId !== scope.designId || edit.value.revision !== value.baseRevision) return null;
  if (value.pending === null) {
    if (value.status !== 'idle') return null;
  } else {
    const pending = value.pending;
    if (!exact(pending, ['command', 'generation']) || !integer(pending.generation) || pending.generation > value.generation || !value.dirty || value.status === 'idle' ||
      !exact(pending.command, ['requestId', 'expectedUpdatedAt', 'expectedRevision', 'edit'])) return null;
    const command = pending.command;
    if (typeof command.requestId !== 'string' || command.expectedRevision !== value.baseRevision || command.expectedUpdatedAt !== value.baseUpdatedAt) return null;
    try { studioPendingCommandKey(scope, { requestId: command.requestId, expectedRevision: value.baseRevision }); } catch { return null; }
    const sent = parseStudioAuthoringEdit(command.edit);
    if (!sent.ok || sent.value.designId !== scope.designId || sent.value.revision !== value.baseRevision ||
      (pending.generation === value.generation && !same(sent.value, edit.value))) return null;
  }
  return structuredClone(value) as StudioSaveSession;
}
function inspect(value: unknown, scope: StudioSaveScope): Exclude<StudioWorkingCopyRead, { state: 'recovery' }> {
  if (value === undefined) return { state: 'absent' };
  try {
    if (typeof value !== 'string' || new TextEncoder().encode(value).length > MAX_BYTES) throw Error();
    const stored: unknown = JSON.parse(value);
    if (isStudioObject(stored) && typeof stored.schemaVersion === 'string' && stored.schemaVersion !== VERSION) return { state: 'unsupported', message: 'A newer working-copy format is retained for recovery.' };
    if (!exact(stored, ['schemaVersion', 'session']) || stored.schemaVersion !== VERSION) throw Error();
    const session = sessionValue(stored.session, scope);
    if (!session) throw Error();
    return { state: 'valid', session, token: value };
  } catch { return { state: 'corrupt', message: 'This working copy could not be verified and has been kept unchanged.' }; }
}

function journalMatches(session: StudioSaveSession, journal: Extract<StudioPendingDiscovery, { state: 'available' }>): boolean {
  if (!session.pending) return journal.entries.length === 0;
  return journal.entries.length === 1 && journal.entries[0].recovery.state === 'valid' &&
    journal.entries[0].recovery.body === JSON.stringify(session.pending.command) &&
    journal.entries[0].recovery.receipt === null && journal.entries[0].recovery.rejectedStatus === null;
}

/** A recovery result is evidence for explicit reconciliation, never permission to replay. */
export async function readStudioWorkingCopy(rawScope: StudioSaveScope): Promise<StudioWorkingCopyRead> {
  try {
    const scope = scopeValue(rawScope), key = studioWorkingCopyKey(scope);
    if (!owner(scope)) throw Error();
    const value = await get<unknown>(key);
    if (!owner(scope)) throw Error();
    const found = inspect(value, scope);
    if (found.state !== 'valid' && found.state !== 'absent') return found;
    const journal = await listStudioPendingCommands(scope);
    if (!owner(scope) || journal.state === 'unavailable') throw Error();
    if (found.state === 'absent' ? journal.entries.length === 0 : journalMatches(found.session, journal)) return found;
    return { state: 'recovery', session: found.state === 'valid' ? found.session : null, token: found.state === 'valid' ? found.token : null, journal,
      message: 'The working copy and retained save need reconciliation before editing or saving. Both have been preserved.' };
  } catch { return { state: 'unavailable', message: 'The working copy is unavailable for the current signed-in owner.' }; }
}

/** Compare-and-swap prevents an older tab or delayed write replacing newer work.
 * Persist a settled session before acknowledging its separate journal receipt.
 * This API does not stage, acknowledge, send or replay requests. */
export async function persistStudioWorkingCopy(rawScope: StudioSaveScope, rawSession: StudioSaveSession, expectedToken: string | null): Promise<StudioWorkingCopyWrite> {
  try {
    const scope = scopeValue(rawScope), session = sessionValue(rawSession, scope), key = studioWorkingCopyKey(scope);
    if (!session) return { state: 'invalid', message: 'The working copy is not a valid safe editing session.' };
    const token = JSON.stringify({ schemaVersion: VERSION, session });
    if (new TextEncoder().encode(token).length > MAX_BYTES) return { state: 'invalid', message: 'The working copy exceeds the supported size.' };
    if (!owner(scope)) throw Error();
    let conflict = false;
    await update<unknown>(key, previous => {
      if (!owner(scope)) throw Error();
      const found = inspect(previous, scope);
      if ((expectedToken === null ? found.state !== 'absent' : found.state !== 'valid' || found.token !== expectedToken) ||
        (found.state === 'valid' && (session.generation < found.session.generation || session.baseRevision < found.session.baseRevision))) {
        conflict = true; return previous;
      }
      return token;
    });
    if (!owner(scope)) throw Error();
    return conflict ? { state: 'conflict', message: 'Existing recovery data or newer local work was retained. Reload and reconcile before replacing it.' } : { state: 'persisted', token };
  } catch { return { state: 'unavailable', message: 'The working copy could not be durably stored. Keep this editor open.' }; }
}

/** Only a clean, non-pending exact copy may be cleared. Dirty-work discard and
 * sign-out policy belong to the future caller; this is not a broad erase API. */
export async function clearStudioWorkingCopy(rawScope: StudioSaveScope, expectedToken: string): Promise<boolean> {
  try {
    const scope = scopeValue(rawScope), key = studioWorkingCopyKey(scope);
    if (!owner(scope)) return false;
    const journal = await listStudioPendingCommands(scope);
    if (!owner(scope) || journal.state !== 'available' || journal.entries.length) return false;
    let cleared = false;
    await update<unknown>(key, previous => {
      if (!owner(scope)) throw Error();
      const found = inspect(previous, scope);
      if (found.state !== 'valid' || found.token !== expectedToken || found.session.dirty || found.session.pending) return previous;
      cleared = true; return undefined;
    });
    return owner(scope) && cleared;
  } catch { return false; }
}


export type StudioRetainedCopy = { key: string; createdAt: string; session: StudioSaveSession };
const retainedPrefix = (scope: StudioSaveScope) => `${studioWorkingCopyKey(scope)}:retained:`;
function retainedValue(raw: unknown, scope: StudioSaveScope, key: string): StudioRetainedCopy | null {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BYTES) return null;
  const row: unknown = JSON.parse(raw);
  if (!exact(row, ['schemaVersion', 'createdAt', 'workingCopyToken']) || row.schemaVersion !== 'studio_retained_copy.v1' || typeof row.createdAt !== 'string' || !timestamp(row.createdAt)) return null;
  const found = inspect(row.workingCopyToken, scope);
  return found.state === 'valid' ? { key, createdAt: row.createdAt, session: found.session } : null;
}

/** Backups are immutable, owner-bound safe DTOs; they never replay a command. */
export async function listStudioRetainedCopies(rawScope: StudioSaveScope): Promise<StudioRetainedCopy[]> {
  const scope = scopeValue(rawScope); if (!owner(scope)) throw Error('The retained choices are unavailable for this owner.');
  const names = (await keys()).filter((key): key is string => typeof key === 'string' && key.startsWith(retainedPrefix(scope)));
  const copies: StudioRetainedCopy[] = [];
  for (const key of names) {
    const copy = retainedValue(await get(key), scope, key);
    if (!copy || !owner(scope)) throw Error('A retained copy could not be verified; it has been kept.');
    copies.push(copy);
  }
  if (!owner(scope)) throw Error('The retained choices are unavailable for this owner.');
  return copies.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Complete and read back preservation before allowing an explicit replacement. */
export async function retainStudioWorkingCopy(rawScope: StudioSaveScope, expectedToken: string): Promise<StudioRetainedCopy> {
  const scope = scopeValue(rawScope), found = await readStudioWorkingCopy(scope);
  if (!owner(scope) || found.state !== 'valid' || found.token !== expectedToken || found.session.pending || found.session.status !== 'idle') throw Error('The retained work changed or has an unresolved save. Nothing was replaced.');
  const key = `${retainedPrefix(scope)}${crypto.randomUUID()}`;
  const raw = JSON.stringify({ schemaVersion: 'studio_retained_copy.v1', createdAt: new Date().toISOString(), workingCopyToken: expectedToken });
  if (new TextEncoder().encode(raw).length > MAX_BYTES) throw Error('The retained work is too large to preserve safely. Nothing was replaced.');
  await update(key, previous => { if (!owner(scope) || previous !== undefined) throw Error('The retained copy could not be preserved.'); return raw; });
  const stored = await get(key);
  if (!owner(scope) || stored !== raw) throw Error('The retained copy could not be verified. Nothing was replaced.');
  const copy = retainedValue(stored, scope, key);
  if (!copy) throw Error('The retained copy could not be verified. Nothing was replaced.');
  return copy;
}
