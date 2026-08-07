'use client';

const PORTAL_AUTH_BOUNDARY_CHANNEL = 'sanctuary-portal-auth-boundary-v1';
const PORTAL_AUTH_BOUNDARY_STORAGE_KEY = 'sanctuary-portal:auth-boundary:v1';
const PORTAL_AUTH_BOUNDARY_MAX_AGE_MS = 30_000;
const PORTAL_AUTH_BOUNDARY_SOURCE_ID =
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

type PortalAuthBoundaryReason =
  | 'access-lost'
  | 'owner-changed'
  | 'role-changed'
  | 'signed-out';

type PortalAuthBoundaryMessage = {
  ownerId: string;
  reason: PortalAuthBoundaryReason;
  sentAt: number;
  sourceId: string;
  token: string;
};

function isPortalAuthBoundaryMessage(value: unknown): value is PortalAuthBoundaryMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PortalAuthBoundaryMessage>;
  return Boolean(
    typeof candidate.ownerId === 'string'
      && candidate.ownerId
      && typeof candidate.sentAt === 'number'
      && Number.isFinite(candidate.sentAt)
      && typeof candidate.sourceId === 'string'
      && candidate.sourceId
      && typeof candidate.token === 'string'
      && candidate.token
      && (
        candidate.reason === 'access-lost'
        || candidate.reason === 'owner-changed'
        || candidate.reason === 'role-changed'
        || candidate.reason === 'signed-out'
      ),
  );
}

function decodePortalAuthBoundaryMessage(raw: unknown): PortalAuthBoundaryMessage | null {
  try {
    const candidate = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isPortalAuthBoundaryMessage(candidate)) return null;
    if (candidate.sourceId === PORTAL_AUTH_BOUNDARY_SOURCE_ID) return null;
    // Destructive boundaries must survive a long browser suspension. Logout
    // revokes refresh credentials, but an already-issued access token can
    // remain locally readable after a tab wakes up.
    if (
      candidate.reason === 'role-changed'
      && Math.abs(Date.now() - candidate.sentAt) > PORTAL_AUTH_BOUNDARY_MAX_AGE_MS
    ) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function publishPortalAuthBoundary(
  ownerId: string,
  reason: PortalAuthBoundaryReason,
): void {
  if (typeof window === 'undefined' || !ownerId) return;
  const message: PortalAuthBoundaryMessage = {
    ownerId,
    reason,
    sentAt: Date.now(),
    sourceId: PORTAL_AUTH_BOUNDARY_SOURCE_ID,
    token: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(PORTAL_AUTH_BOUNDARY_CHANNEL);
      channel.postMessage(message);
      channel.close();
    } catch {
      // The storage event below remains as the cross-tab fallback.
    }
  }

  try {
    const encoded = JSON.stringify(message);
    window.localStorage.setItem(PORTAL_AUTH_BOUNDARY_STORAGE_KEY, encoded);
    window.localStorage.removeItem(PORTAL_AUTH_BOUNDARY_STORAGE_KEY);
  } catch {
    // Locking the current document must not depend on storage availability.
  }
}

export function subscribeToPortalAuthBoundary(
  onBoundary: (message: PortalAuthBoundaryMessage) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  let channel: BroadcastChannel | null = null;
  const deliver = (raw: unknown) => {
    const message = decodePortalAuthBoundaryMessage(raw);
    if (message) onBoundary(message);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PORTAL_AUTH_BOUNDARY_STORAGE_KEY && event.newValue) {
      deliver(event.newValue);
    }
  };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(PORTAL_AUTH_BOUNDARY_CHANNEL);
      channel.addEventListener('message', (event) => deliver(event.data));
    } catch {
      channel = null;
    }
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.close();
    window.removeEventListener('storage', handleStorage);
  };
}
