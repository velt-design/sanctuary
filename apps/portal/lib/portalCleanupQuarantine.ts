const PORTAL_CLEANUP_QUARANTINE_STORAGE_KEY = 'sanctuary-portal:cleanup-required:v1';
const PORTAL_CLEANUP_QUARANTINE_COOKIE = 'sanctuary_portal_cleanup_required_v1';
const PORTAL_CLEANUP_QUARANTINE_VERSION = 1 as const;
const PORTAL_CLEANUP_QUARANTINE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type QuarantineStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type QuarantineCookieDocument = Pick<Document, 'cookie'>;

type PortalCleanupQuarantine = {
  version: typeof PORTAL_CLEANUP_QUARANTINE_VERSION;
  departingOwnerId: string | null;
  token: string;
};

export class PortalCleanupQuarantinePersistenceError extends Error {
  constructor() {
    super('The portal could not persist its cleanup quarantine marker.');
    this.name = 'PortalCleanupQuarantinePersistenceError';
  }
}

export const portalCleanupQuarantineStorageKey = PORTAL_CLEANUP_QUARANTINE_STORAGE_KEY;
export const portalCleanupQuarantineCookieName = PORTAL_CLEANUP_QUARANTINE_COOKIE;

function normalizedOwnerId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= 256 ? normalized : undefined;
}

function parsePortalCleanupQuarantine(raw: string | null): PortalCleanupQuarantine | null {
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<PortalCleanupQuarantine>;
    const ownerId = normalizedOwnerId(candidate.departingOwnerId);
    if (
      candidate.version !== PORTAL_CLEANUP_QUARANTINE_VERSION
      || ownerId === undefined
      || typeof candidate.token !== 'string'
      || !/^[a-zA-Z0-9._-]{8,160}$/.test(candidate.token)
    ) {
      throw new Error('invalid_cleanup_quarantine');
    }
    return {
      version: PORTAL_CLEANUP_QUARANTINE_VERSION,
      departingOwnerId: ownerId,
      token: candidate.token,
    };
  } catch {
    throw new Error('The portal cleanup quarantine marker is invalid.');
  }
}

function resolveStorage(override?: QuarantineStorage | null): QuarantineStorage | null {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveCookieDocument(
  override?: QuarantineCookieDocument | null,
): QuarantineCookieDocument | null {
  if (override !== undefined) return override;
  if (typeof document === 'undefined') return null;
  return document;
}

function cookieMarkerRaw(cookieHeader: string): string | null {
  const prefix = `${PORTAL_CLEANUP_QUARANTINE_COOKIE}=`;
  const encoded = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new Error('The portal cleanup quarantine cookie is invalid.');
  }
}

function markerRaw(marker: PortalCleanupQuarantine): string {
  return JSON.stringify(marker);
}

function sameMarker(a: PortalCleanupQuarantine, b: PortalCleanupQuarantine): boolean {
  return a.version === b.version
    && a.departingOwnerId === b.departingOwnerId
    && a.token === b.token;
}

function createToken(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function readPortalCleanupQuarantine(
  storage?: QuarantineStorage | null,
  cookieDocument?: QuarantineCookieDocument | null,
): PortalCleanupQuarantine | null {
  const resolvedStorage = resolveStorage(storage);
  const resolvedCookieDocument = resolveCookieDocument(cookieDocument);
  let storageRaw: string | null = null;
  let cookieRaw: string | null = null;
  try {
    storageRaw = resolvedStorage?.getItem(PORTAL_CLEANUP_QUARANTINE_STORAGE_KEY) ?? null;
  } catch {
    storageRaw = null;
  }
  try {
    cookieRaw = resolvedCookieDocument ? cookieMarkerRaw(resolvedCookieDocument.cookie) : null;
  } catch {
    cookieRaw = null;
  }
  const storageMarker = parsePortalCleanupQuarantine(storageRaw);
  const cookieMarker = parsePortalCleanupQuarantine(cookieRaw);

  if (storageMarker && cookieMarker && !sameMarker(storageMarker, cookieMarker)) {
    throw new Error('Portal cleanup quarantine stores do not agree.');
  }
  return storageMarker ?? cookieMarker;
}

/**
 * Synchronously records a fail-closed boundary before any asynchronous purge.
 * localStorage is primary; a short same-origin cookie is a reload-safe fallback
 * when browser policy blocks localStorage. The marker contains no customer data.
 */
export function beginPortalCleanupQuarantine(
  departingOwnerId: string | null,
  storage?: QuarantineStorage | null,
  cookieDocument?: QuarantineCookieDocument | null,
): PortalCleanupQuarantine {
  const normalizedOwner = normalizedOwnerId(departingOwnerId);
  if (normalizedOwner === undefined) throw new Error('A valid departing portal owner is required.');

  const resolvedStorage = resolveStorage(storage);
  const resolvedCookieDocument = resolveCookieDocument(cookieDocument);
  const existing = readPortalCleanupQuarantine(resolvedStorage, resolvedCookieDocument);
  if (
    existing?.departingOwnerId
    && normalizedOwner
    && existing.departingOwnerId !== normalizedOwner
  ) {
    throw new Error('A different portal owner is already awaiting browser cleanup.');
  }
  const marker = existing
    ? existing.departingOwnerId === null && normalizedOwner
      ? { ...existing, departingOwnerId: normalizedOwner }
      : existing
    : {
        version: PORTAL_CLEANUP_QUARANTINE_VERSION,
        departingOwnerId: normalizedOwner,
        token: createToken(),
      };
  const raw = markerRaw(marker);
  let stored = false;

  if (resolvedStorage) {
    try {
      resolvedStorage.setItem(PORTAL_CLEANUP_QUARANTINE_STORAGE_KEY, raw);
      stored = resolvedStorage.getItem(PORTAL_CLEANUP_QUARANTINE_STORAGE_KEY) === raw || stored;
    } catch {
      // The same-origin cookie remains as a reload-safe fallback.
    }
  }

  if (resolvedCookieDocument) {
    try {
      const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
      resolvedCookieDocument.cookie = `${PORTAL_CLEANUP_QUARANTINE_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=${PORTAL_CLEANUP_QUARANTINE_MAX_AGE_SECONDS}; SameSite=Strict${secure}`;
      const persistedCookie = parsePortalCleanupQuarantine(cookieMarkerRaw(resolvedCookieDocument.cookie));
      stored = Boolean(persistedCookie && sameMarker(persistedCookie, marker)) || stored;
    } catch {
      // localStorage may already hold the durable marker.
    }
  }

  if (!stored) {
    throw new PortalCleanupQuarantinePersistenceError();
  }
  return marker;
}

/** Clears only the exact marker whose complete cleanup just succeeded. */
export function completePortalCleanupQuarantine(
  expected: PortalCleanupQuarantine,
  storage?: QuarantineStorage | null,
  cookieDocument?: QuarantineCookieDocument | null,
): void {
  const resolvedStorage = resolveStorage(storage);
  const resolvedCookieDocument = resolveCookieDocument(cookieDocument);
  const current = readPortalCleanupQuarantine(resolvedStorage, resolvedCookieDocument);
  if (current && !sameMarker(current, expected)) {
    throw new Error('Portal cleanup quarantine changed before cleanup completed.');
  }

  let removalFailed = false;
  if (resolvedStorage) {
    try {
      resolvedStorage.removeItem(PORTAL_CLEANUP_QUARANTINE_STORAGE_KEY);
    } catch {
      removalFailed = true;
    }
  }
  if (resolvedCookieDocument) {
    try {
      const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
      resolvedCookieDocument.cookie = `${PORTAL_CLEANUP_QUARANTINE_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secure}`;
    } catch {
      removalFailed = true;
    }
  }

  if (removalFailed || readPortalCleanupQuarantine(resolvedStorage, resolvedCookieDocument)) {
    throw new Error('The portal cleanup quarantine marker could not be cleared.');
  }
}
