import { loadPortalExactRouteFrameModule } from './portalCoreShellModuleCache';

export const PORTAL_CORE_SHELL_KEYS = ['all-route-frames'] as const;

export type PortalCoreShellKey = (typeof PORTAL_CORE_SHELL_KEYS)[number];
export type PortalCoreShellLoader = () => Promise<unknown>;

const PORTAL_CORE_SHELL_LOADERS: Record<PortalCoreShellKey, PortalCoreShellLoader> = {
  'all-route-frames': loadPortalExactRouteFrameModule,
};

export type PortalCoreShellPreloadResult = {
  loaded: PortalCoreShellKey[];
  failed: PortalCoreShellKey[];
};

export function createPortalCoreShellPreloader(
  loaders: Record<PortalCoreShellKey, PortalCoreShellLoader> = PORTAL_CORE_SHELL_LOADERS,
) {
  const attempts = new Map<PortalCoreShellKey, Promise<boolean>>();

  return async function preloadPortalCoreShellCode(
    keys: readonly PortalCoreShellKey[] = PORTAL_CORE_SHELL_KEYS,
  ): Promise<PortalCoreShellPreloadResult> {
    const requestedKeys = Array.from(new Set(keys));
    const results = await Promise.all(
      requestedKeys.map(async (key) => {
        let attempt = attempts.get(key);
        if (!attempt) {
          attempt = loaders[key]().then(
            () => true,
            () => {
              attempts.delete(key);
              return false;
            },
          );
          attempts.set(key, attempt);
        }
        return { key, loaded: await attempt };
      }),
    );

    return {
      loaded: results.filter((result) => result.loaded).map((result) => result.key),
      failed: results.filter((result) => !result.loaded).map((result) => result.key),
    };
  };
}

export const preloadPortalCoreShellCode = createPortalCoreShellPreloader();

export async function waitForPortalServiceWorkerReady(options?: {
  timeoutMs?: number;
  serviceWorker?: Pick<ServiceWorkerContainer, 'ready'> | null;
}): Promise<'ready' | 'timeout' | 'unsupported'> {
  const serviceWorker = options?.serviceWorker
    ?? (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : null);
  if (!serviceWorker) return 'unsupported';

  const timeoutMs = Math.max(0, Math.min(options?.timeoutMs ?? 1_500, 5_000));
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve(serviceWorker.ready).then(
        () => 'ready' as const,
        () => 'timeout' as const,
      ),
      timeout,
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}
