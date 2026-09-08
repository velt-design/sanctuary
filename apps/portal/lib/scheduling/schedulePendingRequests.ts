import { getLocalFirstStoreOwner } from '@/lib/localFirst/store';
import { ApiError, apiJson } from '@/lib/repo/apiClient';
import { isValidScheduleMutationEnvelope, parseScheduleConfirmationEnvelope, parseScheduleFinishEarlyPreview } from './scheduleMutationTrust';

const PREFIX = 'sanctuary-schedule-pending:v1:';
const EVENT = 'sanctuary-schedule-pending';
const active = new Set<string>();
const actions = new Set(['overlap/keep', 'job/assign', 'job/unassign', 'items/reorder', 'job/set-duration', 'job/pin', 'job/adjust', 'job/unpin', 'downtime/create', 'downtime/update', 'downtime/delete', 'job/mark-in-progress', 'job/set-days-remaining', 'job/mark-done', 'job/lock', 'job/reschedule', 'job/client-update/ack']);
export type PendingScheduleRequest = {
  id: string; path: string; input: Record<string, unknown>; createdAt: string;
  state: 'unconfirmed' | 'rejected'; message?: string;
};

function storagePrefix() {
  const owner = getLocalFirstStoreOwner();
  return typeof window !== 'undefined' && owner ? `${PREFIX}${encodeURIComponent(owner)}:` : null;
}

function emitChange() { window.dispatchEvent(new Event(EVENT)); }

export function readPendingScheduleRequests(): PendingScheduleRequest[] {
  const prefix = storagePrefix();
  if (!prefix) return [];
  const result: PendingScheduleRequest[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const entry = JSON.parse(window.localStorage.getItem(key) ?? 'null');
      if (!entry || typeof entry.id !== 'string' || key !== `${prefix}${entry.id}` || active.has(key)) continue;
      if (typeof entry.path !== 'string' || (entry.path !== 'board/placement' && !actions.has(entry.path.replace('/api/staff/v1/schedule/', '')))) continue;
      if (!entry.input || typeof entry.input !== 'object' || Array.isArray(entry.input) || typeof entry.createdAt !== 'string') continue;
      if (entry.state !== 'unconfirmed' && entry.state !== 'rejected') continue;
      result.push(entry);
    }
  } catch { return result; }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function subscribePendingScheduleRequests(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener('storage', listener); };
}

export function dismissPendingScheduleRequest(id: string) {
  const prefix = storagePrefix();
  if (!prefix) return;
  window.localStorage.removeItem(`${prefix}${id}`);
  emitChange();
}

export function retainScheduleBoardIntent(input: Record<string, unknown>) {
  const prefix = storagePrefix();
  if (!prefix) return null;
  const entry: PendingScheduleRequest = { id: crypto.randomUUID(), path: 'board/placement', input, createdAt: new Date().toISOString(), state: 'unconfirmed' };
  const key = `${prefix}${entry.id}`;
  window.localStorage.setItem(key, JSON.stringify(entry));
  active.add(key);
  return {
    clear() { try { window.localStorage.removeItem(key); } catch { /* Retain for review without failing an accepted save. */ } finally { active.delete(key); emitChange(); } },
    needsReview() { active.delete(key); emitChange(); },
  };
}

export async function sendScheduleMutation<T>(path: string, input: Record<string, unknown>): Promise<T> {
  if (!actions.has(path.replace('/api/staff/v1/schedule/', ''))) throw new Error('Unknown schedule action');
  const prefix = storagePrefix();
  const entry: PendingScheduleRequest = { id: crypto.randomUUID(), path, input, createdAt: new Date().toISOString(), state: 'unconfirmed' };
  const key = prefix ? `${prefix}${entry.id}` : null;
  if (key) {
    try { window.localStorage.setItem(key, JSON.stringify(entry)); }
    catch { throw new Error('This browser could not retain your change. Free browser storage and try again. Nothing was sent.'); }
    active.add(key);
  }
  try {
    const result = await apiJson<T>(path, { method: 'POST', body: JSON.stringify(input) });
    const valid = isValidScheduleMutationEnvelope(result, { allowMissingSchedule: path.endsWith('/client-update/ack'), expectedCrewId: typeof input.crew_id === 'string' ? input.crew_id : undefined }) || parseScheduleConfirmationEnvelope(result) || parseScheduleFinishEarlyPreview(result);
    if (!valid) throw new Error('The server returned an invalid schedule response. Your request is retained until the saved schedule can be checked.');
    if (key) { try { window.localStorage.removeItem(key); } catch { /* Keep the receipt available to review if storage fails. */ } }
    return result;
  } catch (error) {
    if (key) {
      const rejected = error instanceof ApiError && [400, 401, 403, 404, 409, 422, 501].includes(error.status);
      try { window.localStorage.setItem(key, JSON.stringify({ ...entry, state: rejected ? 'rejected' : 'unconfirmed', message: error instanceof Error ? error.message : 'The save could not be confirmed.' })); } catch { /* The original intent was stored before sending. */ }
    }
    throw error;
  } finally {
    if (key) { active.delete(key); emitChange(); }
  }
}
