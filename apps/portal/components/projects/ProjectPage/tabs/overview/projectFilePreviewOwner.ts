import type { QueryClient } from '@tanstack/react-query';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
export type PreviewScope = { owner: string; projectId: string; rootId: string; itemId: string; folderId: string };
export type PreviewBytes = { bytes: Uint8Array; mime: string; name: string; version: string; profile?: 'photo-v1' | 'pdf-v1'; hash?: string };
type Entry = PreviewBytes & PreviewScope & { checkedAt: number; authorizedAt: number; opened: boolean };
type Observation = PreviewScope & { at: number; versions: (string | null | undefined)[] | null };
type Store = { owner: string | null; entries: Map<string, Entry>; observed: Map<string, Observation>; listeners: Map<string, Set<(body: PreviewBytes | null) => void>> };
const stores = new WeakMap<QueryClient, Store>();
export const key = (entry: PreviewScope) => JSON.stringify([entry.owner, entry.projectId, entry.rootId, entry.itemId]);
export function store(client: QueryClient) {
  let value = stores.get(client);
  if (!value) { value = { owner: null, entries: new Map(), observed: new Map(), listeners: new Map() }; stores.set(client, value); }
  return value;
}
export function setPreviewOwner(client: QueryClient, owner: string | null) {
  const value = store(client);
  if (value.owner !== owner) { for (const entry of value.entries.values()) discardPreview(client, entry); value.observed.clear(); value.owner = owner; }
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
