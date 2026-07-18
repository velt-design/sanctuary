import type { Query } from '@tanstack/react-query';

const PORTAL_QUERY_PERSIST_SCOPE_EDITOR = 'editor';
export const PORTAL_QUERY_CACHE_FALLBACK_BUSTER = 'v3';
const PORTAL_QUERY_STORAGE_KEY_PREFIX = 'sanctuary-portal-react-query:v4:';
export const portalEditorPersistMeta = {
  persistScope: PORTAL_QUERY_PERSIST_SCOPE_EDITOR,
} as const;

type PersistablePortalQuery = Pick<Query, 'state' | 'meta'>;

export function shouldDehydratePortalQuery(query: PersistablePortalQuery): boolean {
  return query.state.status === 'success' && query.meta?.persistScope === PORTAL_QUERY_PERSIST_SCOPE_EDITOR;
}

export function resolvePortalQueryCacheBuster(value: string | undefined): string {
  return typeof value === 'string' && value.trim() ? value.trim() : PORTAL_QUERY_CACHE_FALLBACK_BUSTER;
}

export function portalQueryStorageKey(ownerId: string): string {
  const normalized = ownerId.trim();
  if (!normalized) throw new Error('A portal user id is required for persisted query storage.');
  return `${PORTAL_QUERY_STORAGE_KEY_PREFIX}${normalized}`;
}
