import type { QueryClient } from '@tanstack/react-query';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';

export const PREVIEW_LEASE_MS = 5 * 60_000;
export const PREVIEW_CACHE_MAX_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 8;
export type PreviewScope = { owner: string; projectId: string; rootId: string; itemId: string; folderId: string };
export type PreviewBytes = { bytes: Uint8Array; mime: string; name: string; version: string };
type Entry = PreviewBytes & PreviewScope & { checkedAt: number };
type Store = { owner: string | null; entries: Map<string, Entry> };
const stores = new WeakMap<QueryClient, Store>();
const key = (entry: PreviewScope) => JSON.stringify([entry.owner, entry.projectId, entry.rootId, entry.itemId]);
function store(client: QueryClient) {
  let value = stores.get(client);
  if (!value) { value = { owner: null, entries: new Map() }; stores.set(client, value); }
  return value;
}
export function setPreviewOwner(client: QueryClient, owner: string | null) {
  const value = store(client);
  if (value.owner !== owner) { value.entries.clear(); value.owner = owner; }
}
export function readPreview(client: QueryClient, scope: PreviewScope, versions: (string | null | undefined)[]): PreviewBytes | null {
  const value = store(client), id = key(scope), entry = value.entries.get(id);
  if (value.owner !== scope.owner || !entry) return null;
  const known = versions.filter(Boolean);
  if (Date.now() - entry.checkedAt >= PREVIEW_LEASE_MS || known.length && !known.includes(entry.version)) { value.entries.delete(id); return null; }
  value.entries.delete(id); value.entries.set(id, entry);
  return { bytes: entry.bytes, mime: entry.mime, name: entry.name, version: entry.version };
}
export function retainPreview(client: QueryClient, scope: PreviewScope, body: PreviewBytes) {
  const value = store(client);
  if (value.owner !== scope.owner || body.bytes.byteLength > PREVIEW_CACHE_MAX_BYTES) return;
  value.entries.delete(key(scope)); value.entries.set(key(scope), { ...body, ...scope, checkedAt: Date.now() });
  let bytes = [...value.entries.values()].reduce((total, entry) => total + entry.bytes.byteLength, 0);
  while (value.entries.size > MAX_FILES || bytes > PREVIEW_CACHE_MAX_BYTES) {
    const first = value.entries.keys().next().value!;
    bytes -= value.entries.get(first)!.bytes.byteLength; value.entries.delete(first);
  }
}
export function discardPreview(client: QueryClient, scope: PreviewScope) { store(client).entries.delete(key(scope)); }
export function discardProjectPreviews(client: QueryClient, owner: string, projectId: string) {
  const value = store(client);
  for (const [id, entry] of value.entries) if (entry.owner === owner && entry.projectId === projectId) value.entries.delete(id);
}
export function reconcileFolderPreviews(client: QueryClient, owner: string, projectId: string, rootId: string, folderId: string, items: ProjectFilesPage['items'], complete: boolean) {
  const value = store(client);
  for (const [id, entry] of value.entries) {
    if (entry.owner !== owner || entry.projectId !== projectId || entry.rootId !== rootId || entry.folderId !== folderId) continue;
    const current = items.find(item => item.id === entry.itemId);
    const known = current ? [current.eTag, current.cTag].filter(Boolean) : [];
    if (complete && !current || current && (current.kind !== 'file' || known.length && !known.includes(entry.version))) value.entries.delete(id);
  }
}

export function reconcileRootPreviews(client: QueryClient, owner: string, projectId: string, rootIds: string[]) {
  for (const [id, entry] of store(client).entries) if (entry.owner === owner && entry.projectId === projectId && !rootIds.includes(entry.rootId)) store(client).entries.delete(id);
}
