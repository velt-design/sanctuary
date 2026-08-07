const PORTAL_SERVICE_WORKER_PATH = '/sw.js';
export const PORTAL_SERVICE_WORKER_HEADER_REQUIREMENT =
  'no-cache, no-store, must-revalidate';

export const PORTAL_SAFE_PUBLIC_ASSETS = [
  '/images/sp_dark_icon.png',
  '/logo-sanctuary.png',
  '/logo-sanctuary.svg',
] as const;

const NEXT_STATIC_PATH_PREFIX = '/_next/static/';
const NEXT_STATIC_ASSET_EXTENSION = /\.(?:css|js|mjs|otf|ttf|wasm|woff2?)$/i;
const CACHE_VERSION_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;

type PortalStaticCacheResult = {
  ok: boolean;
  type: string;
  version?: string | null;
  warmed?: number;
  caches?: string[];
  error?: string;
};

type PortalStaticCacheMessage =
  { type: 'PORTAL_STATIC_CACHE_WARM'; version: string; urls: string[] };

type PortalServiceWorkerTarget = Pick<ServiceWorker, 'postMessage'>;

export function normalizePortalStaticCacheVersion(value: string): string | null {
  const normalized = value.trim();
  return CACHE_VERSION_PATTERN.test(normalized) ? normalized : null;
}

export function portalServiceWorkerScriptUrl(
  value: string,
  origin = typeof window === 'undefined' ? 'http://portal.local' : window.location.origin,
): string {
  const version = normalizePortalStaticCacheVersion(value);
  if (!version) throw new Error('A safe portal static-cache version is required.');
  const url = new URL(PORTAL_SERVICE_WORKER_PATH, origin);
  url.searchParams.set('v', version);
  return url.toString();
}

function serviceWorkerVersion(target: ServiceWorker): string | null {
  try {
    const url = new URL(target.scriptURL, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== PORTAL_SERVICE_WORKER_PATH) return null;
    return normalizePortalStaticCacheVersion(url.searchParams.get('v') ?? '');
  } catch {
    return null;
  }
}

function matchingPortalWorker(
  registration: ServiceWorkerRegistration,
  version: string,
): ServiceWorker | null {
  const candidates = [
    registration.waiting,
    registration.active,
    registration.installing?.state === 'installed' || registration.installing?.state === 'activating'
      ? registration.installing
      : null,
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker.controller
      : null,
  ].filter((target): target is ServiceWorker => Boolean(target));
  return candidates.find((candidate) => serviceWorkerVersion(candidate) === version) ?? null;
}

export async function waitForPortalStaticCacheWorkerVersion(
  registration: ServiceWorkerRegistration,
  versionValue: string,
  timeoutMs = 10_000,
): Promise<ServiceWorker> {
  const version = normalizePortalStaticCacheVersion(versionValue);
  if (!version) throw new Error('A safe portal static-cache version is required.');
  const requestedVersion = version;
  const current = matchingPortalWorker(registration, requestedVersion);
  if (current) return current;

  return new Promise<ServiceWorker>((resolve, reject) => {
    let observedInstalling: ServiceWorker | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      registration.removeEventListener('updatefound', inspect);
      observedInstalling?.removeEventListener('statechange', inspect);
      if (timeout !== null) clearTimeout(timeout);
    };
    const finish = (worker: ServiceWorker) => {
      cleanup();
      resolve(worker);
    };
    function inspect() {
      const match = matchingPortalWorker(registration, requestedVersion);
      if (match) {
        finish(match);
        return;
      }
      const installing = registration.installing;
      if (installing !== observedInstalling) {
        observedInstalling?.removeEventListener('statechange', inspect);
        observedInstalling = installing;
        observedInstalling?.addEventListener('statechange', inspect);
      }
    }

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Portal static-cache worker version did not become ready.'));
    }, Math.max(0, Math.min(timeoutMs, 30_000)));
    registration.addEventListener('updatefound', inspect);
    inspect();
  });
}

export function isPortalStaticAssetUrl(
  value: string,
  origin = typeof window === 'undefined' ? 'http://portal.local' : window.location.origin,
): boolean {
  let url: URL;
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
    url = new URL(value, origin);
  } catch {
    return false;
  }

  if (url.origin !== normalizedOrigin) return false;
  if (url.search || url.hash) return false;
  if (PORTAL_SAFE_PUBLIC_ASSETS.includes(url.pathname as (typeof PORTAL_SAFE_PUBLIC_ASSETS)[number])) {
    return true;
  }
  return url.pathname.startsWith(NEXT_STATIC_PATH_PREFIX) && NEXT_STATIC_ASSET_EXTENSION.test(url.pathname);
}

export function portalStaticCacheWarmUrls(
  values: readonly string[],
  origin = typeof window === 'undefined' ? 'http://portal.local' : window.location.origin,
): string[] {
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return [];
  }
  return Array.from(
    new Set(
      [...PORTAL_SAFE_PUBLIC_ASSETS, ...values]
        .filter((value) => isPortalStaticAssetUrl(value, normalizedOrigin))
        .map((value) => new URL(value, normalizedOrigin).toString()),
    ),
  );
}

export function discoverLoadedPortalStaticAssets(
  origin = typeof window === 'undefined' ? 'http://portal.local' : window.location.origin,
): string[] {
  if (typeof document === 'undefined') return [];

  const candidates: string[] = [];
  for (const element of document.querySelectorAll<HTMLScriptElement>('script[src]')) {
    if (element.src) candidates.push(element.src);
  }
  for (const element of document.querySelectorAll<HTMLLinkElement>('link[href]')) {
    if (element.href) candidates.push(element.href);
  }
  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    for (const entry of performance.getEntriesByType('resource')) {
      if (typeof entry.name === 'string') candidates.push(entry.name);
    }
  }

  return Array.from(
    new Set(candidates.filter((value) => isPortalStaticAssetUrl(value, origin))),
  );
}

async function postPortalStaticCacheMessage(
  target: PortalServiceWorkerTarget,
  message: PortalStaticCacheMessage,
): Promise<PortalStaticCacheResult> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('Portal static-cache worker did not respond.'));
    }, 10_000);

    channel.port1.onmessage = (event: MessageEvent<PortalStaticCacheResult>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    target.postMessage(message, [channel.port2]);
  });
}

export async function registerPortalStaticCacheWorker(versionValue: string): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register(portalServiceWorkerScriptUrl(versionValue), {
    scope: '/',
    updateViaCache: 'none',
  });
}

export async function warmPortalStaticCache(
  registration: ServiceWorkerRegistration,
  input: { version: string; urls?: readonly string[] },
): Promise<PortalStaticCacheResult> {
  const version = normalizePortalStaticCacheVersion(input.version);
  if (!version) throw new Error('A safe portal static-cache version is required.');
  const target = matchingPortalWorker(registration, version);
  if (!target) throw new Error('Portal static-cache worker version does not match the requested release.');
  const urls = portalStaticCacheWarmUrls(input.urls ?? []);
  return postPortalStaticCacheMessage(target, {
    type: 'PORTAL_STATIC_CACHE_WARM',
    version,
    urls,
  });
}
