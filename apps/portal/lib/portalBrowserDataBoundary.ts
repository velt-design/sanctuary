import { del } from 'idb-keyval';
import { portalQueryStorageKey } from '@/lib/react-query/persistence';
import {
  clearLocalFirstStoreOwner,
  discardAllLocalFirstState,
  getLocalFirstStoreOwner,
  localFirstStorageKey,
} from '@/lib/localFirst/store';
import { stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import {
  clearCalculatorSessionDraftsForOwner,
  clearLegacyUnscopedCalculatorSessionDrafts,
} from '@/lib/localFirst/sessionBoundary';
import { portalThemeBrowserCacheKey } from '@/lib/theme/browserCache';

const PORTAL_LOCAL_STORAGE_EXACT_KEYS = [
  'sanctuary-portal:portal-role-cache:v1',
  'sp_contacts_v1',
  'sp_projects_v1',
  'sp_schedule_items_v1',
  'sp_installers_v1',
  'sp.schedule.board.hiddenCrewIds.v1',
] as const;

const PORTAL_LOCAL_STORAGE_SENSITIVE_PREFIXES = [
  'sanctuary:quote-delivery:',
] as const;

// These pre-owner-boundary IndexedDB keys shipped customer/query data without
// a user suffix. Delete them for every verified identity boundary so an older
// browser profile cannot carry one staff member's data into another session.
const PORTAL_LEGACY_UNSCOPED_IDB_KEYS = [
  'sanctuary-portal-local-first-v1',
  'sanctuary-portal-react-query',
] as const;

type ClearableStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>;

function clearPortalSensitiveLocalStorage(storage: ClearableStorage | null): number {
  if (!storage) return 0;
  const keys = new Set<string>(PORTAL_LOCAL_STORAGE_EXACT_KEYS);
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && PORTAL_LOCAL_STORAGE_SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.add(key);
    }
  }

  let removed = 0;
  for (const key of keys) {
    storage.removeItem(key);
    removed += 1;
  }
  return removed;
}

function resolveStorage(
  kind: 'localStorage' | 'sessionStorage',
  override: ClearableStorage | null | undefined,
): ClearableStorage | null {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return null;
  return window[kind];
}

async function clearMountedLocalFirstOwner(ownerId: string): Promise<void> {
  if (getLocalFirstStoreOwner() !== ownerId) return;

  stopLocalFirstRuntime({ clearOwner: false });
  try {
    await discardAllLocalFirstState();
  } finally {
    clearLocalFirstStoreOwner();
  }
}

export async function purgePortalOwnerBrowserData(
  ownerId: string,
  storage: {
    localStorage?: ClearableStorage | null;
    sessionStorage?: ClearableStorage | null;
  } = {},
): Promise<void> {
  const cleanupResults = await Promise.allSettled([
    purgePortalOwnerScopedBrowserData(ownerId, storage),
    purgePortalLegacyUnscopedBrowserData(storage),
  ]);
  const failures = cleanupResults.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length) {
    throw new Error('Unable to clear all portal data for the departing user.', {
      cause: failures.map((result) => result.reason),
    });
  }
}

export async function purgePortalOwnerScopedBrowserData(
  ownerId: string,
  storage: {
    localStorage?: ClearableStorage | null;
    sessionStorage?: ClearableStorage | null;
  } = {},
): Promise<void> {
  const normalizedOwner = ownerId.trim();
  if (!normalizedOwner) return;

  const ownerStoreResults = await Promise.allSettled([
    Promise.resolve().then(() => clearMountedLocalFirstOwner(normalizedOwner)),
    Promise.resolve().then(() => {
      const localStorage = resolveStorage('localStorage', storage.localStorage);
      localStorage?.removeItem(portalThemeBrowserCacheKey(normalizedOwner));
    }),
    Promise.resolve().then(() => clearCalculatorSessionDraftsForOwner(
      normalizedOwner,
      resolveStorage('sessionStorage', storage.sessionStorage),
    )),
    Promise.resolve().then(() => del(localFirstStorageKey(normalizedOwner))),
    Promise.resolve().then(() => del(portalQueryStorageKey(normalizedOwner))),
  ]);
  const failedStores = ownerStoreResults.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedStores.length) {
    throw new Error('Unable to clear owner-scoped portal data.', {
      cause: failedStores.map((result) => result.reason),
    });
  }
}

/**
 * Removes only stores that shipped before portal data had an authenticated
 * owner suffix. This is deliberately separate from owner-scoped cleanup so a
 * first verified login can retire legacy data without deleting that user's
 * valid drafts from an earlier session.
 */
export async function purgePortalLegacyUnscopedBrowserData(
  storage: {
    localStorage?: ClearableStorage | null;
    sessionStorage?: ClearableStorage | null;
  } = {},
): Promise<void> {
  const legacyStoreResults = await Promise.allSettled([
    Promise.resolve().then(() => clearPortalSensitiveLocalStorage(
      resolveStorage('localStorage', storage.localStorage),
    )),
    Promise.resolve().then(() => clearLegacyUnscopedCalculatorSessionDrafts(
      resolveStorage('sessionStorage', storage.sessionStorage),
    )),
    ...PORTAL_LEGACY_UNSCOPED_IDB_KEYS.map((key) =>
      Promise.resolve().then(() => del(key))),
  ]);
  const failedStores = legacyStoreResults.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedStores.length) {
    throw new Error('Unable to clear legacy unscoped portal data.', {
      cause: failedStores.map((result) => result.reason),
    });
  }
}
