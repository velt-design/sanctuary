import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PORTAL_SAFE_PUBLIC_ASSETS,
  PORTAL_SERVICE_WORKER_HEADER_REQUIREMENT,
  discoverLoadedPortalStaticAssets,
  isPortalStaticAssetUrl,
  normalizePortalStaticCacheVersion,
  portalServiceWorkerScriptUrl,
  portalStaticCacheWarmUrls,
  registerPortalStaticCacheWorker,
  waitForPortalStaticCacheWorkerVersion,
  warmPortalStaticCache,
} from './portalStaticCache';

const ORIGIN = 'https://portal.example.test';

describe('portal static-cache client policy', () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });

  it('accepts bounded release identifiers only', () => {
    expect(normalizePortalStaticCacheVersion(' release-123 ')).toBe('release-123');
    expect(normalizePortalStaticCacheVersion('')).toBeNull();
    expect(normalizePortalStaticCacheVersion('../release')).toBeNull();
    expect(normalizePortalStaticCacheVersion('x'.repeat(81))).toBeNull();
  });

  it('allows only immutable Next code/fonts and explicit safe public icons', () => {
    expect(isPortalStaticAssetUrl('/_next/static/chunks/app.js', ORIGIN)).toBe(true);
    expect(isPortalStaticAssetUrl('/_next/static/css/app.css', ORIGIN)).toBe(true);
    expect(isPortalStaticAssetUrl('/_next/static/media/inter.woff2', ORIGIN)).toBe(true);
    for (const asset of PORTAL_SAFE_PUBLIC_ASSETS) {
      expect(isPortalStaticAssetUrl(asset, ORIGIN)).toBe(true);
    }

    expect(isPortalStaticAssetUrl('/_next/static/media/customer.jpg', ORIGIN)).toBe(false);
    expect(isPortalStaticAssetUrl('/_next/image?url=/images/project-private.jpg', ORIGIN)).toBe(false);
    expect(isPortalStaticAssetUrl('/api/dashboard', ORIGIN)).toBe(false);
    expect(isPortalStaticAssetUrl('/staff/projects', ORIGIN)).toBe(false);
    expect(isPortalStaticAssetUrl('/downloads/portfolio.pdf', ORIGIN)).toBe(false);
    expect(isPortalStaticAssetUrl('https://storage.example.test/signed/project.png', ORIGIN)).toBe(false);
    expect(isPortalStaticAssetUrl('/_next/static/chunks/app.js?_rsc=secret', ORIGIN)).toBe(false);
  });

  it('deduplicates warm assets and always includes the reviewed icon set', () => {
    const urls = portalStaticCacheWarmUrls(
      ['/_next/static/chunks/app.js', '/_next/static/chunks/app.js', '/api/projects'],
      ORIGIN,
    );

    expect(urls).toContain(`${ORIGIN}/_next/static/chunks/app.js`);
    expect(urls).not.toContain(`${ORIGIN}/api/projects`);
    expect(urls).toHaveLength(PORTAL_SAFE_PUBLIC_ASSETS.length + 1);
    expect(portalStaticCacheWarmUrls([], 'not an origin')).toEqual([]);
  });

  it('exports the required non-cacheable worker-script header contract', () => {
    expect(PORTAL_SERVICE_WORKER_HEADER_REQUIREMENT).toBe(
      'no-cache, no-store, must-revalidate',
    );
  });

  it('pins the release version into the registered worker script URL', async () => {
    const registration = {} as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    await expect(registerPortalStaticCacheWorker('release-123')).resolves.toBe(registration);
    expect(register).toHaveBeenCalledWith(
      portalServiceWorkerScriptUrl('release-123'),
      { scope: '/', updateViaCache: 'none' },
    );
    expect(new URL(portalServiceWorkerScriptUrl('release-123', ORIGIN)).searchParams.get('v')).toBe('release-123');
  });

  it('does not send warm instructions to a worker from another release', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null },
    });
    const registration = {
      active: {
        scriptURL: `${window.location.origin}/sw.js?v=release-122`,
        postMessage: vi.fn(),
      },
      waiting: null,
    } as unknown as ServiceWorkerRegistration;

    await expect(warmPortalStaticCache(registration, {
      version: 'release-123',
    })).rejects.toThrow('worker version does not match');
    expect(registration.active?.postMessage).not.toHaveBeenCalled();
  });

  it('waits for an already-installing requested release instead of using the old active worker', async () => {
    const stateListeners = new Set<EventListener>();
    let state: ServiceWorkerState = 'installing';
    const installing = {
      get state() {
        return state;
      },
      scriptURL: `${window.location.origin}/sw.js?v=release-123`,
      postMessage: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: EventListener) => stateListeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => stateListeners.delete(listener)),
    } as unknown as ServiceWorker;
    const registrationListeners = new Set<EventListener>();
    const registration = {
      active: {
        state: 'activated',
        scriptURL: `${window.location.origin}/sw.js?v=release-122`,
        postMessage: vi.fn(),
      },
      waiting: null,
      installing,
      addEventListener: vi.fn((_type: string, listener: EventListener) => registrationListeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => registrationListeners.delete(listener)),
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: registration.active },
    });

    const ready = waitForPortalStaticCacheWorkerVersion(registration, 'release-123', 1_000);
    state = 'installed';
    for (const listener of stateListeners) listener(new Event('statechange'));

    await expect(ready).resolves.toBe(installing);
    expect(installing.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
    expect(installing.removeEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
  });

  it('discovers only already-loaded safe same-origin static resources', () => {
    const script = document.createElement('script');
    script.src = `${ORIGIN}/_next/static/chunks/dashboard.js`;
    const unsafeImage = document.createElement('link');
    unsafeImage.href = `${ORIGIN}/images/project-private.jpg`;
    const stylesheet = document.createElement('link');
    stylesheet.href = `${ORIGIN}/_next/static/css/app.css`;
    document.head.append(script, unsafeImage, stylesheet);

    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { name: `${ORIGIN}/_next/static/media/inter.woff2` } as PerformanceEntry,
      { name: `${ORIGIN}/api/dashboard` } as PerformanceEntry,
      { name: 'https://storage.example.test/signed/customer.png' } as PerformanceEntry,
    ]);

    expect(discoverLoadedPortalStaticAssets(ORIGIN)).toEqual([
      `${ORIGIN}/_next/static/chunks/dashboard.js`,
      `${ORIGIN}/_next/static/css/app.css`,
      `${ORIGIN}/_next/static/media/inter.woff2`,
    ]);

    script.remove();
    unsafeImage.remove();
    stylesheet.remove();
  });
});
