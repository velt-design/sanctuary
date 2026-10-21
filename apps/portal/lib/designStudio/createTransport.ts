import { get, keys, update } from 'idb-keyval';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import { ApiError, apiJson } from '@/lib/repo/apiClient';
import { isUuid } from '@/lib/supabase/mappers';
import { isStudioObject } from './contracts';
import { parseStudioCreateCommand, type StudioCreateCommand, type StudioCreateReceipt } from './createCommand';
import { studioIdentifier } from './identifiers';

export type StudioCreateScope = { actorId: string; projectId: string };
export type StudioCreateReference = { requestId: string };
type Stored = { schemaVersion: 'studio_creation_pending.v1'; scope: StudioCreateScope; body: string; receipt: StudioCreateReceipt | null; rejectedStatus: number | null };
export type StudioCreatePendingRead =
  | { state: 'absent' }
  | { state: 'valid'; key: string; body: string; command: StudioCreateCommand; receipt: StudioCreateReceipt | null; rejectedStatus: number | null }
  | { state: 'corrupt' | 'unsupported' | 'unavailable'; message: string };
export type StudioCreateTransportResult =
  | { state: 'confirmed'; key: string; body: string; receipt: StudioCreateReceipt; receiptStored: boolean }
  | { state: 'unconfirmed' | 'rejected' | 'blocked' | 'owner-changed'; message: string; status?: number };
const VERSION = 'studio_creation_pending.v1';
const REJECTED_STATUSES = [400, 409, 422];
const MAX_BODY_BYTES = 4096;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameReceipt = (a: StudioCreateReceipt, b: StudioCreateReceipt) => a.estimateId === b.estimateId && a.designId === b.designId && a.revision === b.revision && a.savedAt === b.savedAt && a.alreadyExisted === b.alreadyExisted;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  isStudioObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function owner(scope: StudioCreateScope) { return getLocalFirstStoreOwner() === scope.actorId; }
function scopeValue(scope: StudioCreateScope): StudioCreateScope {
  if (!exact(scope, ['actorId', 'projectId']) || typeof scope.actorId !== 'string' || !isUuid(scope.actorId) ||
    scope.actorId !== scope.actorId.trim().toLowerCase()) throw Error('Invalid creation scope.');
  return { actorId: scope.actorId, projectId: studioIdentifier(scope.projectId, 'proj').appId };
}
function receipt(value: unknown, command?: StudioCreateCommand): value is StudioCreateReceipt {
  if (!exact(value, ['estimateId', 'designId', 'revision', 'savedAt', 'alreadyExisted']) ||
    value.revision !== 1 || !timestamp(value.savedAt) || typeof value.alreadyExisted !== 'boolean' ||
    typeof value.estimateId !== 'string' || typeof value.designId !== 'string' || !value.designId.trim() || value.designId.length > 200) return false;
  try { return studioIdentifier(value.estimateId, 'est').appId === value.estimateId &&
    !(command && command.mode !== 'blank' && command.sourceEstimateId === value.estimateId) &&
    !(command?.schemaVersion === 'studio_create.v4' && command.hostSource.estimateId === value.estimateId); } catch { return false; }
}
export function studioPendingCreationKey(rawScope: StudioCreateScope, reference: StudioCreateReference): string {
  const scope = scopeValue(rawScope);
  if (typeof reference.requestId !== 'string' || !isUuid(reference.requestId) || reference.requestId !== reference.requestId.trim().toLowerCase()) throw Error('Invalid creation reference.');
  return `sanctuary-studio-creation-pending:v1:${[scope.actorId, scope.projectId, reference.requestId].map(value => encodeURIComponent(String(value))).join(':')}`;
}
function inspect(value: unknown, scope: StudioCreateScope, ref: StudioCreateReference, key: string): StudioCreatePendingRead {
  if (value === undefined) return { state: 'absent' };
  if (isStudioObject(value) && typeof value.schemaVersion === 'string' && value.schemaVersion !== VERSION) return { state: 'unsupported', message: 'A different saved-command version is retained for recovery.' };
  if (!exact(value, ['schemaVersion', 'scope', 'body', 'receipt', 'rejectedStatus']) || value.schemaVersion !== VERSION || !same(value.scope, scope) || typeof value.body !== 'string' ||
    !(value.rejectedStatus === null || (typeof value.rejectedStatus === 'number' && REJECTED_STATUSES.includes(value.rejectedStatus)))) {
    return { state: 'corrupt', message: 'The retained command is damaged and has been kept unchanged.' };
  }
  try {
    if (new TextEncoder().encode(value.body).length > MAX_BODY_BYTES) throw Error();
    const command = parseStudioCreateCommand(JSON.parse(value.body));
    if (!command || command.requestId !== ref.requestId ||
      (value.receipt !== null && !receipt(value.receipt, command))) throw Error();
    if (value.receipt !== null && value.rejectedStatus !== null) throw Error();
    return { state: 'valid', key, body: value.body, command, receipt: value.receipt as StudioCreateReceipt | null, rejectedStatus: value.rejectedStatus as number | null };
  } catch { return { state: 'corrupt', message: 'The retained command is damaged and has been kept unchanged.' }; }
}

export async function readStudioPendingCreation(rawScope: StudioCreateScope, ref: StudioCreateReference): Promise<StudioCreatePendingRead> {
  try {
    const scope = scopeValue(rawScope), reference = { ...ref }, key = studioPendingCreationKey(scope, reference);
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    const value = await get<unknown>(key);
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    return inspect(value, scope, reference, key);
  } catch { return { state: 'unavailable', message: 'This browser could not read the retained command.' }; }
}

export type StudioCreateDiscovery =
  | { state: 'available'; entries: Array<{ key: string; reference: StudioCreateReference | null; recovery: StudioCreatePendingRead }> }
  | { state: 'unavailable'; message: string };

/** Discover creation requests after reload, without replaying.
 * Only exact actor/project keys are loaded; damaged entries stay
 * available as recovery notices and are never normalized or removed. */
export async function listStudioPendingCreations(rawScope: StudioCreateScope): Promise<StudioCreateDiscovery> {
  try {
    const scope = scopeValue(rawScope);
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    const prefix = `sanctuary-studio-creation-pending:v1:${[scope.actorId, scope.projectId].map(encodeURIComponent).join(':')}:`;
    const allKeys = await keys();
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    const scoped = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith(prefix)).sort();
    const entries = await Promise.all(scoped.map(async key => {
      if (!owner(scope)) throw Error('Owner changed');
      const parts = key.slice(prefix.length).split(':');
      let reference: StudioCreateReference | null = null;
      try {
        const candidate = { requestId: decodeURIComponent(parts[0] ?? '') };
        if (parts.length === 1 && studioPendingCreationKey(scope, candidate) === key) reference = candidate;
      } catch { /* Preserve a malformed scoped key without attempting replay. */ }
      if (!reference) return { key, reference, recovery: { state: 'corrupt', message: 'A damaged request identity is retained for recovery.' } as StudioCreatePendingRead };
      const value = await get<unknown>(key);
      if (!owner(scope)) throw Error('Owner changed');
      return { key, reference, recovery: inspect(value, scope, reference, key) };
    }));
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    return { state: 'available', entries: entries.filter(entry => entry.recovery.state !== 'absent') };
  } catch { return { state: 'unavailable', message: 'This browser could not read retained studio requests.' }; }
}

export async function stageStudioCreation(rawScope: StudioCreateScope, rawCommand: StudioCreateCommand): Promise<StudioCreatePendingRead> {
  try {
    const scope = scopeValue(rawScope), command = parseStudioCreateCommand(rawCommand);
    if (!command) return { state: 'corrupt', message: 'The creation command is invalid.' };
    const body = JSON.stringify(command), frozenCommand = JSON.parse(body) as StudioCreateCommand, key = studioPendingCreationKey(scope, frozenCommand);
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return { state: 'unavailable', message: 'The creation exceeds the supported size.' };
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    let staged: StudioCreatePendingRead = { state: 'unavailable', message: 'This browser could not retain the creation.' };
    await update<unknown>(key, previous => {
      if (!owner(scope)) throw Error('Owner changed');
      const found = inspect(previous, scope, frozenCommand, key);
      if (found.state !== 'absent') {
        if (found.state !== 'valid' || found.body !== body) throw Error('Existing command must remain unchanged');
        staged = found; return previous;
      }
      const stored: Stored = { schemaVersion: VERSION, scope, body, receipt: null, rejectedStatus: null };
      staged = { state: 'valid', key, body, command: frozenCommand, receipt: null, rejectedStatus: null };
      return stored;
    });
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    return staged;
  } catch { return { state: 'unavailable', message: 'The creation could not be retained without replacing existing recovery data. Nothing was sent.' }; }
}

async function sendRetained(scope: StudioCreateScope, pending: Extract<StudioCreatePendingRead, { state: 'valid' }>): Promise<StudioCreateTransportResult> {
  if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed.' };
  if (pending.rejectedStatus !== null && REJECTED_STATUSES.includes(pending.rejectedStatus)) return { state: 'rejected', status: pending.rejectedStatus, message: 'This request was rejected. Reconcile the retained revision before creating another request.' };
  if (pending.receipt) return { state: 'confirmed', key: pending.key, body: pending.body, receipt: pending.receipt, receiptStored: true };
  try {
    const result = await apiJson<unknown>(`/api/projects/${encodeURIComponent(scope.projectId)}/studio-revisions`, { method: 'POST', body: pending.body });
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    if (!exact(result, ['receipt', 'pricing']) || result.pricing !== 'unpriced' || !receipt(result.receipt, pending.command)) {
      throw Error('Unverified creation receipt');
    }
    let verified = result.receipt;
    let receiptStored = false;
    try {
      await update<unknown>(pending.key, previous => {
        if (!owner(scope)) throw Error('Owner changed');
        const current = inspect(previous, scope, pending.command, pending.key);
        if (current.state !== 'valid' || current.body !== pending.body) throw Error('Saved command changed');
        // A concurrent successful retry may differ only in alreadyExisted.
        // Keep and publish the exact first durable confirmation.
        verified = current.receipt ?? verified;
        return { ...(previous as Stored), receipt: verified, rejectedStatus: null };
      });
      receiptStored = true;
    } catch { /* Confirmed server success is not undone by a local receipt-storage failure. */ }
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    return { state: 'confirmed', key: pending.key, body: pending.body, receipt: verified, receiptStored };
  } catch (error) {
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    const rejected = error instanceof ApiError && REJECTED_STATUSES.includes(error.status);
    const concurrent: { receipt: StudioCreateReceipt | null } = { receipt: null };
    try {
      await update<unknown>(pending.key, previous => {
        if (!owner(scope)) throw Error('Owner changed');
        const current = inspect(previous, scope, pending.command, pending.key);
        if (current.state !== 'valid' || current.body !== pending.body) throw Error('Command changed');
        if (current.receipt) {
          concurrent.receipt = current.receipt;
          return previous;
        }
        return rejected ? { ...(previous as Stored), rejectedStatus: error.status } : previous;
      });
    } catch { /* Original body remains retained; the controller also retains rejection state. */ }
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    if (concurrent.receipt) return { state: 'confirmed', key: pending.key, body: pending.body, receipt: concurrent.receipt, receiptStored: true };
    const accessFailure = error instanceof ApiError && [401, 403, 404].includes(error.status);
    return { state: rejected ? 'rejected' : 'unconfirmed', message: rejected ? 'The server rejected this creation. Keep it for review before changing the request.'
      : accessFailure ? 'Restore access to this project, then retry this exact retained request to check whether it was created.'
        : 'The creation could not be confirmed. Retry this exact retained request.', ...(error instanceof ApiError ? { status: error.status } : {}) };
  }
}
/** Durably stages the exact command before POST. No timers or automatic replay.
 * The fixed project route supplies scope; design identity freshness is enforced
 * by the server because the safe clone command exposes no source design ID. */
export async function sendStudioCreation(rawScope: StudioCreateScope, command: StudioCreateCommand): Promise<StudioCreateTransportResult> {
  let scope: StudioCreateScope;
  try { scope = scopeValue(rawScope); } catch { return { state: 'blocked', message: 'Invalid creation scope.' }; }
  const staged = await stageStudioCreation(scope, command);
  if (staged.state !== 'valid') return { state: 'blocked', message: staged.state === 'absent' ? 'No retained command exists.' : staged.message };
  return sendRetained(scope, staged);
}
/** Explicit retry uses only the retained body, including its original request ID. */
export async function retryStudioCreation(rawScope: StudioCreateScope, ref: StudioCreateReference): Promise<StudioCreateTransportResult> {
  let scope: StudioCreateScope;
  try { scope = scopeValue(rawScope); } catch { return { state: 'blocked', message: 'Invalid creation scope.' }; }
  const pending = await readStudioPendingCreation(scope, ref);
  if (pending.state !== 'valid') return { state: 'blocked', message: pending.state === 'absent' ? 'No retained command exists.' : pending.message };
  return sendRetained(scope, pending);
}

/** Atomic conditional acknowledgement, never read-then-delete. Returning
 * undefined leaves no readable command, without deleting a concurrently replaced value. */
export async function acknowledgeStudioCreation(rawScope: StudioCreateScope, ref: StudioCreateReference, expected: { body: string; receipt: StudioCreateReceipt }): Promise<boolean> {
  try {
    const scope = scopeValue(rawScope), reference = { ...ref }, confirmation = structuredClone(expected), key = studioPendingCreationKey(scope, reference);
    if (!owner(scope)) return false;
    await update<unknown>(key, previous => {
      if (!owner(scope)) throw Error('Owner changed');
      const current = inspect(previous, scope, reference, key);
      if (current.state !== 'valid' || current.body !== confirmation.body || !current.receipt || !receipt(confirmation.receipt) || !sameReceipt(current.receipt, confirmation.receipt)) throw Error('Command or receipt changed');
      return undefined;
    });
    return owner(scope);
  } catch { return false; }
}
