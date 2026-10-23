import type { QueryClient } from '@tanstack/react-query';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { fetchPreparedPreviews, PreviewPreparationError } from '@/lib/projects/sharePointFiles/previews/client';
import { PREVIEW_BATCH_BYTES, PREVIEW_LEASE_MS, PREVIEW_MEMORY_BYTES, PREVIEW_PDF_BYTES, PREVIEW_PHOTO_BYTES, PREVIEW_SOURCE_BYTES } from '@/lib/projects/sharePointFiles/previews/contracts';
import { strongFileVersion } from '@/lib/projects/sharePointFiles/fileVersion';
import { discardPreview, discardProjectPreviews, readPreview, retainPreview, type PreviewScope } from './projectFilePreviewCache';

type Item = ProjectFilesPage['items'][number];
type Folder = Omit<PreviewScope, 'itemId'>;
type Job = { folder: Folder; items: Item[]; force: boolean; foreground: boolean; done: (ready: boolean) => void; promise: Promise<boolean> };
type Session = { owner: string; projectId: string; controller: AbortController; queue: Job[]; task?: { job: Job; controller: AbortController }; running: boolean; remaining: number; until: number; disabled: boolean; intent?: string };
const sessions = new WeakMap<QueryClient, Map<string, Session>>();
const sessionKey = (owner: string, projectId: string) => JSON.stringify([owner, projectId]);
function session(client: QueryClient, owner: string, projectId: string) {
  let values = sessions.get(client); if (!values) { values = new Map(); sessions.set(client, values); }
  const key = sessionKey(owner, projectId); let value = values.get(key);
  if (!value || value.controller.signal.aborted) { value = { owner, projectId, controller: new AbortController(), queue: [], running: false, remaining: PREVIEW_MEMORY_BYTES, until: Date.now() + PREVIEW_LEASE_MS, disabled: false }; values.set(key, value); }
  if (Date.now() >= value.until) { value.remaining = PREVIEW_MEMORY_BYTES; value.disabled = false; value.until = Date.now() + PREVIEW_LEASE_MS; }
  return value;
}
const versionOf = (item: Item) => strongFileVersion(item.eTag) ?? strongFileVersion(item.cTag);
const eligible = (item: Item) => item.kind === 'file' && item.size > 0 && versionOf(item) && (item.contentType === 'application/pdf' ? item.size <= PREVIEW_PDF_BYTES : ['image/jpeg', 'image/png', 'image/webp'].includes(item.contentType ?? '') && item.size <= PREVIEW_SOURCE_BYTES);
const expectedSize = (item: Item) => item.contentType === 'application/pdf' ? item.size : PREVIEW_PHOTO_BYTES;
const sameFolder = (a: Folder, b: Folder) => a.rootId === b.rootId && a.folderId === b.folderId;
function job(folder: Folder, items: Item[], force: boolean, foreground: boolean): Job {
  let done!: Job['done']; const promise = new Promise<boolean>(resolve => { done = resolve; });
  return { folder, items, force, foreground, done, promise };
}
async function drain(client: QueryClient, state: Session) {
  if (state.running) return; state.running = true;
  try {
    while (state.queue.length && !state.controller.signal.aborted && !state.disabled) {
      const work = state.queue.shift()!;
      const items = work.items.filter(item => work.force || !readPreview(client, { ...work.folder, itemId: item.id }, [item.eTag, item.cTag], false));
      if (!items.length) { work.done(true); continue; }
      const expected = items.reduce((sum, item) => { const body = readPreview(client, { ...work.folder, itemId: item.id }, [], false); return sum + (body?.profile && body.hash ? 0 : expectedSize(item)); }, 0);
      if (!work.foreground && expected > state.remaining) { work.done(false); continue; }
      const controller = new AbortController(); state.task = { job: work, controller };
      const signal = AbortSignal.any([state.controller.signal, controller.signal, AbortSignal.timeout(50_000)]);
      const authorizedAt = Date.now();
      // A streamed new neighbor may evict another requested resident before its
      // receipt arrives. Keep exact request representations until this batch ends.
      const residents = new Map(items.map(item => [item.id, readPreview(client, { ...work.folder, itemId: item.id }, [], false)]));
      try {
        const result = await fetchPreparedPreviews(state.projectId, { rootId: work.folder.rootId, folderId: work.folder.folderId, items: items.map(item => {
          const resident = residents.get(item.id);
          return { id: item.id, known: resident?.profile && resident.hash ? { version: resident.version, hash: resident.hash, profile: resident.profile } : undefined };
        }) }, signal, (prepared, bytes) => {
          signal.throwIfAborted();
          const scope = { ...work.folder, itemId: prepared.id };
          const resident = residents.get(prepared.id);
          if (!bytes && (!resident || resident.hash !== prepared.hash || resident.version !== prepared.version || resident.profile !== prepared.profile || resident.mime !== prepared.mime || resident.bytes.length !== prepared.size)) throw new PreviewPreparationError();
          if (bytes && !work.foreground) state.remaining = Math.max(0, state.remaining - bytes.length);
          retainPreview(client, scope, { bytes: bytes ?? resident!.bytes, name: prepared.name, version: prepared.version, mime: prepared.mime, profile: prepared.profile, hash: prepared.hash }, !work.foreground, authorizedAt);
          const listed = items.find(item => item.id === prepared.id)!;
          if (versionOf(listed) !== prepared.version) void client.invalidateQueries({ queryKey: ['project-sharepoint-files'], predicate: query => query.queryKey[3] === state.projectId });
        });
        for (const id of result.unavailable) discardPreview(client, { ...work.folder, itemId: id });
        work.done(result.unavailable.length < items.length);
      } catch (error) {
        if (!state.controller.signal.aborted && !controller.signal.aborted) {
          state.disabled = true;
          if (!(error instanceof PreviewPreparationError && error.disabled)) discardProjectPreviews(client, state.owner, state.projectId);
        }
        work.done(false);
      } finally { state.task = undefined; }
    }
  } finally {
    state.running = false;
    if (state.disabled || state.controller.signal.aborted) for (const pending of state.queue.splice(0)) pending.done(false);
  }
}
export function prepareFolderPreviews(client: QueryClient, folder: Folder, source: Item[], selectedId?: string, force = false, limit = 16, userIntent = false) {
  const state = session(client, folder.owner, folder.projectId);
  if (force) state.disabled = false;
  if (state.disabled) return;
  const intent = JSON.stringify([folder.rootId, folder.folderId, selectedId]);
  const prioritize = userIntent && intent !== state.intent;
  if (prioritize) {
    state.intent = intent; state.remaining = Math.max(state.remaining, PREVIEW_BATCH_BYTES);
    if (state.task && !sameFolder(state.task.job.folder, folder)) {
      const interrupted = state.task.job; state.task.controller.abort('folder');
      if (!interrupted.foreground && state.queue.length < 16) state.queue.push(job(interrupted.folder, interrupted.items, false, false));
    }
  }
  const eligibleItems = source.filter(eligible), selected = eligibleItems.findIndex(item => item.id === selectedId);
  const start = selected < 0 ? 0 : Math.max(0, selected - 2);
  const candidates = eligibleItems.slice(start, start + Math.min(limit, 32)).sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  let batch: Item[] = [], size = 0; const jobs: Job[] = [];
  const enqueue = () => { if (batch.length && state.queue.length + jobs.length < 16) jobs.push(job(folder, batch, force, false)); batch = []; size = 0; };
  for (const item of candidates) {
    const pending = [state.task?.job, ...state.queue].some(work => work && sameFolder(work.folder, folder) && work.items.some(entry => entry.id === item.id && versionOf(entry) === versionOf(item)));
    if (pending || !force && readPreview(client, { ...folder, itemId: item.id }, [item.eTag, item.cTag], false)) continue;
    if (batch.length === 8 || size + expectedSize(item) > PREVIEW_BATCH_BYTES) enqueue();
    batch.push(item); size += expectedSize(item);
  }
  enqueue(); if (prioritize) state.queue.unshift(...jobs); else state.queue.push(...jobs); void drain(client, state);
}
export async function prepareSelectedPreview(client: QueryClient, scope: PreviewScope, item: Item, force: boolean) {
  if (!eligible(item)) return false;
  const state = session(client, scope.owner, scope.projectId);
  if (force) state.disabled = false;
  if (state.disabled) return false;
  // Foreground inspection is never shut off by a speculative transfer budget.
  // Each new intent also permits one bounded neighbor batch; it cannot accumulate.
  state.remaining = Math.max(state.remaining, PREVIEW_BATCH_BYTES);
  const current = state.task;
  if (!force && current && sameFolder(current.job.folder, scope) && current.job.items.some(entry => entry.id === item.id && versionOf(entry) === versionOf(item))) return current.job.promise;
  if (current) {
    current.controller.abort('foreground');
    if (!current.job.foreground && state.queue.length < 16) state.queue.push(job(current.job.folder, current.job.items, false, false));
  }
  const next = job(scope, [item], force, true); state.queue.unshift(next); void drain(client, state);
  return next.promise;
}
export function cancelProjectPreviewPreparation(client: QueryClient, owner: string, projectId: string) {
  const values = sessions.get(client), key = sessionKey(owner, projectId), value = values?.get(key);
  if (value) { value.controller.abort(); for (const pending of value.queue.splice(0)) pending.done(false); values!.delete(key); }
}
