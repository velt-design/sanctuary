import { get, keys, update } from 'idb-keyval';
import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import { ApiError, apiJson } from '@/lib/repo/apiClient';
import { isUuid } from '@/lib/supabase/mappers';
import { isStudioObject } from './contracts';
import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { studioIdentifier } from './identifiers';

export type StudioPendingCommand = { requestId: string; expectedUpdatedAt: string | null; expectedRevision: number; edit: StudioAuthoringEdit };
export type StudioSaveScope = { actorId: string; projectId: string; estimateId: string; designId: string };
export type StudioCommandReference = Pick<StudioPendingCommand, 'requestId' | 'expectedRevision'>;
export type StudioSaveReceipt = { revision: number; savedAt: string; alreadyExisted: boolean };
type Stored = { schemaVersion: 'studio_pending.v1'; scope: StudioSaveScope; body: string; receipt: StudioSaveReceipt | null; rejectedStatus: number | null };
export type StudioPendingRead =
  | { state: 'absent' }
  | { state: 'valid'; key: string; body: string; command: StudioPendingCommand; receipt: StudioSaveReceipt | null; rejectedStatus: number | null }
  | { state: 'corrupt' | 'unsupported' | 'unavailable'; message: string };
export type StudioTransportResult =
  | { state: 'confirmed'; key: string; body: string; receipt: StudioSaveReceipt; receiptStored: boolean }
  | { state: 'unconfirmed' | 'rejected' | 'blocked' | 'owner-changed'; message: string; status?: number };
const VERSION = 'studio_pending.v1';
const REJECTED_STATUSES = [400, 409, 422];
// Earlier local candidates retained access failures in this field. They are
// readable recovery evidence, but cannot prove the original command failed.
const RECORDED_ERROR_STATUSES = [...REJECTED_STATUSES, 401, 403, 404];
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameReceipt = (a: StudioSaveReceipt, b: StudioSaveReceipt) => a.revision === b.revision && a.savedAt === b.savedAt;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  isStudioObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function owner(scope: StudioSaveScope) { return getLocalFirstStoreOwner() === scope.actorId; }
function scopeValue(scope: StudioSaveScope): StudioSaveScope {
  if (!exact(scope, ['actorId', 'projectId', 'estimateId', 'designId']) || !isUuid(scope.actorId) || scope.actorId !== scope.actorId.trim() ||
    !scope.designId.trim() || scope.designId.length > 200) throw Error('Invalid save scope.');
  return { actorId: scope.actorId, projectId: studioIdentifier(scope.projectId, 'proj').appId,
    estimateId: studioIdentifier(scope.estimateId, 'est').appId, designId: scope.designId };
}
function receipt(value: unknown, base: number): value is StudioSaveReceipt {
  return exact(value, ['revision', 'savedAt', 'alreadyExisted']) && Number.isSafeInteger(value.revision) &&
    (value.revision === base || value.revision === base + 1) && timestamp(value.savedAt) && typeof value.alreadyExisted === 'boolean';
}
function commandValue(value: unknown, scope: StudioSaveScope): StudioPendingCommand | null {
  if (!exact(value, ['requestId', 'expectedUpdatedAt', 'expectedRevision', 'edit']) || typeof value.requestId !== 'string' || !isUuid(value.requestId) ||
    !(value.expectedUpdatedAt === null || timestamp(value.expectedUpdatedAt)) || !Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 1) return null;
  const edit = parseStudioAuthoringEdit(value.edit);
  if (!edit.ok || edit.value.designId !== scope.designId || edit.value.revision !== value.expectedRevision) return null;
  return value as unknown as StudioPendingCommand;
}
export function studioPendingCommandKey(rawScope: StudioSaveScope, reference: StudioCommandReference): string {
  const scope = scopeValue(rawScope);
  if (!isUuid(reference.requestId) || !Number.isSafeInteger(reference.expectedRevision) || reference.expectedRevision < 1) throw Error('Invalid save reference.');
  return `sanctuary-studio-pending:v1:${[scope.actorId, scope.projectId, scope.estimateId, scope.designId, reference.expectedRevision, reference.requestId].map(value => encodeURIComponent(String(value))).join(':')}`;
}
function inspect(value: unknown, scope: StudioSaveScope, ref: StudioCommandReference, key: string): StudioPendingRead {
  if (value === undefined) return { state: 'absent' };
  if (isStudioObject(value) && typeof value.schemaVersion === 'string' && value.schemaVersion !== VERSION) return { state: 'unsupported', message: 'A different saved-command version is retained for recovery.' };
  if (!exact(value, ['schemaVersion', 'scope', 'body', 'receipt', 'rejectedStatus']) || value.schemaVersion !== VERSION || !same(value.scope, scope) || typeof value.body !== 'string' ||
    !(value.rejectedStatus === null || (typeof value.rejectedStatus === 'number' && RECORDED_ERROR_STATUSES.includes(value.rejectedStatus)))) {
    return { state: 'corrupt', message: 'The saved command is damaged and has been kept unchanged.' };
  }
  try {
    if (new TextEncoder().encode(value.body).length > MAX_BODY_BYTES) throw Error();
    const command = commandValue(JSON.parse(value.body), scope);
    if (!command || command.requestId !== ref.requestId || command.expectedRevision !== ref.expectedRevision ||
      (value.receipt !== null && !receipt(value.receipt, command.expectedRevision))) throw Error();
    if (value.receipt !== null && value.rejectedStatus !== null) throw Error();
    return { state: 'valid', key, body: value.body, command, receipt: value.receipt as StudioSaveReceipt | null, rejectedStatus: value.rejectedStatus as number | null };
  } catch { return { state: 'corrupt', message: 'The saved command is damaged and has been kept unchanged.' }; }
}

export async function readStudioPendingCommand(rawScope: StudioSaveScope, ref: StudioCommandReference): Promise<StudioPendingRead> {
  try {
    const scope = scopeValue(rawScope), reference = { ...ref }, key = studioPendingCommandKey(scope, reference);
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    const value = await get<unknown>(key);
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    return inspect(value, scope, reference, key);
  } catch { return { state: 'unavailable', message: 'This browser could not read the saved command.' }; }
}

export type StudioPendingDiscovery =
  | { state: 'available'; entries: Array<{ key: string; reference: StudioCommandReference | null; recovery: StudioPendingRead }> }
  | { state: 'unavailable'; message: string };

/** Discover old-base and current-base requests after reload, without replaying.
 * Only exact actor/project/estimate/design keys are loaded; damaged entries stay
 * available as recovery notices and are never normalized or removed. */
export async function listStudioPendingCommands(rawScope: StudioSaveScope): Promise<StudioPendingDiscovery> {
  try {
    const scope = scopeValue(rawScope);
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    const prefix = `sanctuary-studio-pending:v1:${[scope.actorId, scope.projectId, scope.estimateId, scope.designId].map(encodeURIComponent).join(':')}:`;
    const allKeys = await keys();
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    const scoped = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith(prefix)).sort();
    const entries = await Promise.all(scoped.map(async key => {
      if (!owner(scope)) throw Error('Owner changed');
      const parts = key.slice(prefix.length).split(':');
      let reference: StudioCommandReference | null = null;
      try {
        const candidate = { expectedRevision: Number(parts[0]), requestId: decodeURIComponent(parts[1] ?? '') };
        if (parts.length === 2 && studioPendingCommandKey(scope, candidate) === key) reference = candidate;
      } catch { /* Preserve a malformed scoped key without attempting replay. */ }
      if (!reference) return { key, reference, recovery: { state: 'corrupt', message: 'A damaged request identity is retained for recovery.' } as StudioPendingRead };
      const value = await get<unknown>(key);
      if (!owner(scope)) throw Error('Owner changed');
      return { key, reference, recovery: inspect(value, scope, reference, key) };
    }));
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    return { state: 'available', entries: entries.filter(entry => entry.recovery.state !== 'absent') };
  } catch { return { state: 'unavailable', message: 'This browser could not read retained studio requests.' }; }
}

export async function stageStudioCommand(rawScope: StudioSaveScope, rawCommand: StudioPendingCommand): Promise<StudioPendingRead> {
  try {
    const scope = scopeValue(rawScope), command = commandValue(rawCommand, scope);
    if (!command) return { state: 'corrupt', message: 'The save command is invalid.' };
    const body = JSON.stringify(command), frozenCommand = JSON.parse(body) as StudioPendingCommand, key = studioPendingCommandKey(scope, frozenCommand);
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return { state: 'unavailable', message: 'The save exceeds the supported size.' };
    if (!owner(scope)) return { state: 'unavailable', message: 'The signed-in owner changed.' };
    let staged: StudioPendingRead = { state: 'unavailable', message: 'This browser could not retain the save.' };
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
  } catch { return { state: 'unavailable', message: 'The save could not be retained without replacing existing recovery data. Nothing was sent.' }; }
}

async function sendRetained(scope: StudioSaveScope, pending: Extract<StudioPendingRead, { state: 'valid' }>): Promise<StudioTransportResult> {
  if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed.' };
  if (pending.rejectedStatus !== null && REJECTED_STATUSES.includes(pending.rejectedStatus)) return { state: 'rejected', status: pending.rejectedStatus, message: 'This request was rejected. Reconcile the saved revision before creating another request.' };
  if (pending.receipt) return { state: 'confirmed', key: pending.key, body: pending.body, receipt: pending.receipt, receiptStored: true };
  try {
    const result = await apiJson<unknown>(`/api/estimates/${encodeURIComponent(scope.estimateId)}/studio`, { method: 'POST', body: pending.body });
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    if (!exact(result, ['receipt', 'pricing']) || result.pricing !== 'unpriced' || !receipt(result.receipt, pending.command.expectedRevision)) {
      return { state: 'unconfirmed', message: 'The server receipt could not be verified. Retry this retained request.' };
    }
    const verified = result.receipt;
    let receiptStored = false;
    try {
      await update<unknown>(pending.key, previous => {
        if (!owner(scope)) throw Error('Owner changed');
        const current = inspect(previous, scope, pending.command, pending.key);
        if (current.state !== 'valid' || current.body !== pending.body || (current.receipt && !sameReceipt(current.receipt, verified))) throw Error('Saved command changed');
        return { ...(previous as Stored), receipt: current.receipt ?? verified, rejectedStatus: null };
      });
      receiptStored = true;
    } catch { /* Confirmed server success is not undone by a local receipt-storage failure. */ }
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    return { state: 'confirmed', key: pending.key, body: pending.body, receipt: verified, receiptStored };
  } catch (error) {
    if (!owner(scope)) return { state: 'owner-changed', message: 'The signed-in owner changed. The original request remains retained.' };
    const rejected = error instanceof ApiError && REJECTED_STATUSES.includes(error.status);
    const concurrent: { receipt: StudioSaveReceipt | null } = { receipt: null };
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
    return { state: rejected ? 'rejected' : 'unconfirmed', message: rejected ? 'The server rejected this save. Keep it for review before changing the request.'
      : accessFailure ? 'Restore access to this design, then retry this exact retained request to check whether it was saved.'
        : 'The save could not be confirmed. Retry this exact retained request.', ...(error instanceof ApiError ? { status: error.status } : {}) };
  }
}
export async function sendStudioCommand(rawScope: StudioSaveScope, command: StudioPendingCommand): Promise<StudioTransportResult> {
  let scope: StudioSaveScope;
  try { scope = scopeValue(rawScope); } catch { return { state: 'blocked', message: 'Invalid save scope.' }; }
  const staged = await stageStudioCommand(scope, command);
  if (staged.state !== 'valid') return { state: 'blocked', message: staged.state === 'absent' ? 'No retained command exists.' : staged.message };
  return sendRetained(scope, staged);
}
export async function retryStudioCommand(rawScope: StudioSaveScope, ref: StudioCommandReference): Promise<StudioTransportResult> {
  let scope: StudioSaveScope;
  try { scope = scopeValue(rawScope); } catch { return { state: 'blocked', message: 'Invalid save scope.' }; }
  const pending = await readStudioPendingCommand(scope, ref);
  if (pending.state !== 'valid') return { state: 'blocked', message: pending.state === 'absent' ? 'No retained command exists.' : pending.message };
  return sendRetained(scope, pending);
}

/** Atomic conditional acknowledgement, never read-then-delete. Returning
 * undefined leaves no readable command, without deleting a concurrently replaced value. */
export async function acknowledgeStudioCommand(rawScope: StudioSaveScope, ref: StudioCommandReference, expected: { body: string; receipt: StudioSaveReceipt }): Promise<boolean> {
  try {
    const scope = scopeValue(rawScope), reference = { ...ref }, confirmation = structuredClone(expected), key = studioPendingCommandKey(scope, reference);
    if (!owner(scope)) return false;
    await update<unknown>(key, previous => {
      if (!owner(scope)) throw Error('Owner changed');
      const current = inspect(previous, scope, reference, key);
      if (current.state !== 'valid' || current.body !== confirmation.body || !current.receipt || !receipt(confirmation.receipt, reference.expectedRevision) || !sameReceipt(current.receipt, confirmation.receipt)) throw Error('Command or receipt changed');
      return undefined;
    });
    return owner(scope);
  } catch { return false; }
}
