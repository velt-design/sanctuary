import type { QueryClient } from '@tanstack/react-query';
import { discardPreview, key, store, type PreviewBytes, type PreviewScope } from './projectFilePreviewOwner';
export { discardPreview, discardProjectPreviews, reconcileFolderPreviews, setPreviewOwner } from './projectFilePreviewOwner';
export type { PreviewBytes, PreviewScope } from './projectFilePreviewOwner';

export const PREVIEW_LEASE_MS = 5 * 60_000;
export const PREVIEW_CACHE_MAX_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 32;
export function readPreview(client: QueryClient, scope: PreviewScope, versions: (string | null | undefined)[], opened = true): PreviewBytes | null {
  const value = store(client), id = key(scope), entry = value.entries.get(id);
  if (value.owner !== scope.owner || !entry) return null;
  const known = versions.filter(Boolean);
  const newerDelivery = entry.profile && entry.authorizedAt > (value.observed.get(id)?.at ?? Infinity);
  if (Date.now() - entry.checkedAt >= PREVIEW_LEASE_MS || known.length && !known.includes(entry.version) && !newerDelivery) { discardPreview(client, scope); return null; }
  entry.opened ||= opened;
  if (opened) { value.entries.delete(id); value.entries.set(id, entry); }
  return { bytes: entry.bytes, mime: entry.mime, name: entry.name, version: entry.version, profile: entry.profile, hash: entry.hash };
}
export function retainPreview(client: QueryClient, scope: PreviewScope, body: PreviewBytes, prepared = false, authorizedAt = Date.now()) {
  const value = store(client);
  if (value.owner !== scope.owner || body.bytes.byteLength > PREVIEW_CACHE_MAX_BYTES) return;
  const observed = value.observed.get(key(scope));
  if (observed && observed.at > authorizedAt && (observed.versions === null || observed.versions.some(Boolean) && !observed.versions.includes(body.version))) return;
  const previous = value.entries.get(key(scope)), opened = previous?.opened || !prepared;
  if (!prepared || !previous?.opened) value.entries.delete(key(scope));
  value.entries.set(key(scope), { ...body, ...scope, checkedAt: Date.now(), authorizedAt, opened });
  let bytes = [...value.entries.values()].reduce((total, entry) => total + entry.bytes.byteLength, 0);
  while (value.entries.size > MAX_FILES || bytes > PREVIEW_CACHE_MAX_BYTES) {
    const allEntries = [...value.entries.values()];
    const entries = allEntries.filter(entry => !value.listeners.get(key(entry))?.size);
    // Reserve a small moving neighbor window even after sustained browsing has
    // filled the cache with opened files. A new prepared file cannot evict itself.
    const openedEntries = entries.filter(entry => entry.opened);
    const openedBytes = openedEntries.reduce((sum, entry) => sum + entry.bytes.length, 0);
    const first = prepared && (openedEntries.length > MAX_FILES - 16 || openedBytes > PREVIEW_CACHE_MAX_BYTES - 8 * 1024 * 1024) ? openedEntries[0]
      : entries.find(entry => !entry.opened && key(entry) !== key(scope)) ?? entries.find(entry => key(entry) !== key(scope)) ?? entries[0];
    if (!first) break; // Active viewers own their bytes; no background eviction.
    bytes -= first.bytes.byteLength; discardPreview(client, first);
  }
  if (value.entries.has(key(scope))) for (const listener of value.listeners.get(key(scope)) ?? []) listener(body);
}
export function subscribePreview(client: QueryClient, scope: PreviewScope, listener: (body: PreviewBytes | null) => void) {
  const value = store(client), id = key(scope); const listeners = value.listeners.get(id) ?? new Set();
  listeners.add(listener); value.listeners.set(id, listeners);
  return () => { listeners.delete(listener); if (!listeners.size) value.listeners.delete(id); };
}
export function reconcileRootPreviews(client: QueryClient, owner: string, projectId: string, rootIds: string[]) {
  for (const entry of store(client).entries.values()) if (entry.owner === owner && entry.projectId === projectId && !rootIds.includes(entry.rootId)) discardPreview(client, entry);
}
