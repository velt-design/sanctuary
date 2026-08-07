const PORTAL_QUERY_STORAGE_KEY_PREFIX = 'sanctuary-portal-react-query:v4:';

// Retained only so logout/access-loss cleanup can remove caches written by older releases.
export function portalQueryStorageKey(ownerId: string): string {
  const normalized = ownerId.trim();
  if (!normalized) throw new Error('A portal user id is required for persisted query storage.');
  return `${PORTAL_QUERY_STORAGE_KEY_PREFIX}${normalized}`;
}
