import type { QueryClient } from '@tanstack/react-query';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';

export const PREVIEW_LEASE_MS = 5 * 60_000;
export const PREVIEW_CACHE_MAX_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 32;
export type PreviewScope = { owner: string; projectId: string; rootId: string; itemId: string; folderId: string };
export type PreviewBytes = { bytes: Uint8Array; mime: string; name: string; version: string; profile?: 'photo-v1' | 'pdf-v1'; hash?: string };
type Entry = PreviewBytes & PreviewScope & { checkedAt: number; authorizedAt: number; opened: boolean };
type Observation = PreviewScope & { at: number; versions: (string | null | undefined)[] | null };
type Store = { owner: string | null; entries: Map<string, Entry>; observed: Map<string, Observation>; listeners: Map<string, Set<(body: PreviewBytes | null) => void>> };
const stores = new WeakMap<QueryClient, Store>();
const key = (entry: PreviewScope) => JSON.stringify([entry.owner, entry.projectId, entry.rootId, entry.itemId]);
function store(client: QueryClient) {
  let value = stores.get(client);
  if (!value) { value = { owner: null, entries: new Map(), observed: new Map(), listeners: new Map() }; stores.set(client, value); }
  return value;
}
export function setPreviewOwner(client: QueryClient, owner: string | null) {
  const value = store(client);
  if (value.owner !== owner) { for (const entry of value.entries.values()) discardPreview(client, entry); value.observed.clear(); value.owner = owner; }
}
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
export function discardPreview(client: QueryClient, scope: PreviewScope) {
  const value = store(client), id = key(scope);
  if (value.entries.delete(id)) for (const listener of value.listeners.get(id) ?? []) listener(null);
}
export function discardProjectPreviews(client: QueryClient, owner: string, projectId: string) {
  const value = store(client);
  for (const entry of value.entries.values()) if (entry.owner === owner && entry.projectId === projectId) discardPreview(client, entry);
}
export function reconcileFolderPreviews(client: QueryClient, owner: string, projectId: string, rootId: string, folderId: string, items: ProjectFilesPage['items'], complete: boolean, observedAt = Date.now()) {
  const value = store(client);
  for (const item of items) {
    const scope = { owner, projectId, rootId, folderId, itemId: item.id }, id = key(scope), previous = value.observed.get(id);
    if (!previous || observedAt >= previous.at) value.observed.set(id, { ...scope, at: observedAt, versions: item.kind === 'file' ? [item.eTag, item.cTag] : null });
  }
  if (complete) for (const [id, observed] of value.observed) if (observed.owner === owner && observed.projectId === projectId && observed.rootId === rootId && observed.folderId === folderId && observedAt >= observed.at && !items.some(item => item.id === observed.itemId)) value.observed.set(id, { ...observed, at: observedAt, versions: null });
  while (value.observed.size > 512) value.observed.delete(value.observed.keys().next().value!);
  for (const entry of value.entries.values()) {
    if (entry.owner !== owner || entry.projectId !== projectId || entry.rootId !== rootId || entry.folderId !== folderId) continue;
    const current = items.find(item => item.id === entry.itemId);
    const known = current ? [current.eTag, current.cTag].filter(Boolean) : [];
    if (observedAt >= entry.authorizedAt && (complete && !current || current && (current.kind !== 'file' || known.length && !known.includes(entry.version)))) discardPreview(client, entry);
  }
}

export function reconcileRootPreviews(client: QueryClient, owner: string, projectId: string, rootIds: string[]) {
  for (const entry of store(client).entries.values()) if (entry.owner === owner && entry.projectId === projectId && !rootIds.includes(entry.rootId)) discardPreview(client, entry);
}
