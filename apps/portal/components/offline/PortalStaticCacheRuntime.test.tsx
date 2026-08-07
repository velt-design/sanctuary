import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';

const registerWorkerMock = vi.fn();
const warmCacheMock = vi.fn();
const discoverAssetsMock = vi.fn();
const preloadShellCodeMock = vi.fn();

vi.mock('@/lib/offline/portalCoreShellPreload', () => ({
  preloadPortalCoreShellCode: (...args: unknown[]) => preloadShellCodeMock(...args),
}));

vi.mock('@/lib/offline/portalStaticCache', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/offline/portalStaticCache')>();
  return {
    ...original,
    discoverLoadedPortalStaticAssets: (...args: unknown[]) => discoverAssetsMock(...args),
    registerPortalStaticCacheWorker: (...args: unknown[]) => registerWorkerMock(...args),
    warmPortalStaticCache: (...args: unknown[]) => warmCacheMock(...args),
  };
});

import PortalStaticCacheRuntime from './PortalStaticCacheRuntime';

function fakeRegistration() {
  const listeners = new Map<string, EventListener>();
  return {
    active: {
      postMessage: vi.fn(),
      scriptURL: `${window.location.origin}/sw.js?v=release-123`,
    },
    waiting: null,
    installing: null,
    addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
  } as unknown as ServiceWorkerRegistration;
}

describe('PortalStaticCacheRuntime', () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

  beforeEach(() => {
    registerWorkerMock.mockReset();
    warmCacheMock.mockReset();
    discoverAssetsMock.mockReset();
    preloadShellCodeMock.mockReset().mockResolvedValue({ loaded: [], failed: [] });
    discoverAssetsMock.mockReturnValue([]);
    warmCacheMock.mockResolvedValue({ ok: true, type: 'PORTAL_STATIC_CACHE_WARMED' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.portalOfflineShellState;
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });

  it('registers and warms the reviewed assets without rendering UI', async () => {
    const registration = fakeRegistration();
    registerWorkerMock.mockResolvedValue(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });

    const rendered = renderIntoDocument(
      <PortalStaticCacheRuntime
        version="release-123"
        assets={['/_next/static/chunks/dashboard.js']}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.container.childElementCount).toBe(0);
    expect(registerWorkerMock).toHaveBeenCalledWith('release-123');
    expect(preloadShellCodeMock).toHaveBeenCalledOnce();
    expect(warmCacheMock).toHaveBeenCalledWith(registration, {
      version: 'release-123',
      urls: ['/_next/static/chunks/dashboard.js'],
    });
    rendered.unmount();
    expect(registration.removeEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function));
  });

  it('does nothing for a disabled or unsafe release version', async () => {
    const disabled = renderIntoDocument(
      <PortalStaticCacheRuntime version="release-123" enabled={false} />,
    );
    const invalid = renderIntoDocument(
      <PortalStaticCacheRuntime version="../release" />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(registerWorkerMock).not.toHaveBeenCalled();
    expect(warmCacheMock).not.toHaveBeenCalled();
    disabled.unmount();
    invalid.unmount();
  });

  it('warms already-loaded safe assets when no explicit list is supplied', async () => {
    const registration = fakeRegistration();
    registerWorkerMock.mockResolvedValue(registration);
    discoverAssetsMock.mockReturnValue(['https://portal.example.test/_next/static/chunks/current.js']);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });

    const rendered = renderIntoDocument(
      <PortalStaticCacheRuntime version="release-123" />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(discoverAssetsMock).toHaveBeenCalledOnce();
    expect(warmCacheMock).toHaveBeenCalledWith(registration, {
      version: 'release-123',
      urls: ['https://portal.example.test/_next/static/chunks/current.js'],
    });
    rendered.unmount();
  });

  it('reports a transient failure and retries immediately when the browser comes online', async () => {
    const registration = fakeRegistration();
    registerWorkerMock
      .mockRejectedValueOnce(new Error('temporary registration failure'))
      .mockResolvedValueOnce(registration);
    const onError = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });

    const rendered = renderIntoDocument(
      <PortalStaticCacheRuntime
        version="release-123"
        assets={['/_next/static/chunks/dashboard.js']}
        onError={onError}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.documentElement.dataset.portalOfflineShellState).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'temporary registration failure',
    }));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(registerWorkerMock).toHaveBeenCalledTimes(2);
    expect(warmCacheMock).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.portalOfflineShellState).toBe('ready');
    rendered.unmount();
  });

  it('treats a failed shell-code preload as an observable setup failure', async () => {
    const registration = fakeRegistration();
    registerWorkerMock.mockResolvedValue(registration);
    preloadShellCodeMock.mockResolvedValueOnce({
      loaded: [],
      failed: ['all-route-frames'],
    });
    const onError = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });

    const rendered = renderIntoDocument(
      <PortalStaticCacheRuntime version="release-123" onError={onError} />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(warmCacheMock).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Portal shell preload failed'),
    }));
    expect(document.documentElement.dataset.portalOfflineShellState).toBe('error');
    rendered.unmount();
  });
});
