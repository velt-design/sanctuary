import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type WorkerFetchEvent = {
  request: Request;
  respondWith: ReturnType<typeof vi.fn>;
};

function loadWorker(options: { activeWorkerVersion?: string | null } = {}) {
  const listeners = new Map<string, (event: any) => void>();
  const self = {
    location: {
      origin: 'https://portal.example.test',
      href: 'https://portal.example.test/sw.js?v=release-123',
    },
    clients: { claim: vi.fn(async () => undefined) },
    registration: {
      active: options.activeWorkerVersion
        ? { scriptURL: `https://portal.example.test/sw.js?v=${options.activeWorkerVersion}` }
        : null,
    },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: vi.fn((type: string, listener: (event: any) => void) => {
      listeners.set(type, listener);
    }),
  };
  const source = readFileSync(
    path.resolve(process.cwd(), 'apps/portal/public/sw.js'),
    'utf8',
  );
  const cacheEntries = new Map<string, Response>();
  const metadataEntries = new Map<string, Response>();
  const requestKey = (request: Request | string) =>
    typeof request === 'string' ? request : request.url;
  const cache = {
    match: vi.fn(async (request: Request | string) => cacheEntries.get(requestKey(request))),
    put: vi.fn(async (request: Request | string, response: Response) => {
      cacheEntries.set(requestKey(request), response);
    }),
    delete: vi.fn(async (request: Request | string) => cacheEntries.delete(requestKey(request))),
  };
  const metadataCache = {
    match: vi.fn(async (request: Request | string) => metadataEntries.get(requestKey(request))),
    put: vi.fn(async (request: Request | string, response: Response) => {
      metadataEntries.set(requestKey(request), response);
    }),
    delete: vi.fn(async (request: Request | string) => metadataEntries.delete(requestKey(request))),
  };
  const openedNames = new Set<string>();
  const cacheStorage = {
    open: vi.fn(async (name: string) => {
      openedNames.add(name);
      return name === 'sanctuary-portal-static-meta-v1' ? metadataCache : cache;
    }),
    keys: vi.fn(async () => Array.from(openedNames)),
    delete: vi.fn(async (name: string) => {
      openedNames.delete(name);
      if (name === 'sanctuary-portal-static-meta-v1') metadataEntries.clear();
      else cacheEntries.clear();
      return true;
    }),
  };
  const fetchMock = vi.fn(async (_request: Request) => new Response('', {
    status: 200,
    headers: { 'cache-control': 'public, max-age=31536000, immutable' },
  }));
  vm.runInNewContext(source, {
    self,
    URL,
    Request,
    Response,
    Set,
    Promise,
    caches: cacheStorage,
    fetch: fetchMock,
  });
  return {
    listeners,
    self,
    cache,
    metadataCache,
    cacheStorage,
    fetchMock,
  };
}

function dispatchFetch(
  listener: (event: WorkerFetchEvent) => void,
  path: string,
  init: RequestInit = {},
): ReturnType<typeof vi.fn> {
  const respondWith = vi.fn();
  listener({
    request: new Request(`https://portal.example.test${path}`, init),
    respondWith,
  });
  return respondWith;
}

describe('portal service-worker cache boundary', () => {
  it('intercepts only reviewed static assets', () => {
    const { listeners } = loadWorker();
    const fetchListener = listeners.get('fetch');
    expect(fetchListener).toBeTypeOf('function');

    expect(dispatchFetch(fetchListener!, '/_next/static/chunks/app.js')).toHaveBeenCalledOnce();
    expect(dispatchFetch(fetchListener!, '/_next/static/css/app.css')).toHaveBeenCalledOnce();
    expect(dispatchFetch(fetchListener!, '/images/sp_dark_icon.png')).toHaveBeenCalledOnce();

    expect(dispatchFetch(fetchListener!, '/api/dashboard')).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/staff/projects')).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/_next/image?url=/images/project-private.jpg')).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/downloads/private.pdf')).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/images/project-private.jpg')).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/_next/static/chunks/app.js?_rsc=secret')).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/_next/static/chunks/app.js', { method: 'POST' })).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener!, '/_next/static/chunks/app.js', {
      headers: { Authorization: 'Bearer private-token' },
    })).not.toHaveBeenCalled();
  });

  it('omits credentials when a reviewed static asset misses the cache', async () => {
    const { listeners, fetchMock } = loadWorker();
    const respondWith = dispatchFetch(listeners.get('fetch')!, '/_next/static/chunks/app.js');

    await respondWith.mock.calls[0]?.[0];

    const publicRequest = fetchMock.mock.calls[0]?.[0] as Request;
    expect(publicRequest.credentials).toBe('omit');
  });

  it('falls back to the network when Cache Storage cannot open or read', async () => {
    const opened = loadWorker();
    opened.cacheStorage.open.mockRejectedValueOnce(new Error('cache blocked'));
    const openResponse = dispatchFetch(
      opened.listeners.get('fetch')!,
      '/_next/static/chunks/open-fallback.js',
    );
    await expect(openResponse.mock.calls[0]?.[0]).resolves.toBeInstanceOf(Response);

    const matched = loadWorker();
    matched.cache.match.mockRejectedValueOnce(new Error('cache corrupt'));
    const matchResponse = dispatchFetch(
      matched.listeners.get('fetch')!,
      '/_next/static/chunks/match-fallback.js',
    );
    await expect(matchResponse.mock.calls[0]?.[0]).resolves.toBeInstanceOf(Response);
    expect(opened.fetchMock).toHaveBeenCalledOnce();
    expect(matched.fetchMock).toHaveBeenCalledOnce();
  });

  it('returns a successful network response when a best-effort cache write fails', async () => {
    const { listeners, cache, fetchMock } = loadWorker();
    cache.put.mockRejectedValueOnce(new Error('quota exceeded'));
    const respondWith = dispatchFetch(listeners.get('fetch')!, '/_next/static/chunks/write-fallback.js');

    await expect(respondWith.mock.calls[0]?.[0]).resolves.toBeInstanceOf(Response);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it('rejects Flight headers, navigation requests, range requests and cross-origin assets', () => {
    const { listeners } = loadWorker();
    const fetchListener = listeners.get('fetch')!;

    expect(dispatchFetch(fetchListener, '/_next/static/chunks/app.js', {
      headers: { RSC: '1' },
    })).not.toHaveBeenCalled();
    expect(dispatchFetch(fetchListener, '/_next/static/chunks/app.js', {
      headers: { Range: 'bytes=0-100' },
    })).not.toHaveBeenCalled();

    const navigation = vi.fn();
    fetchListener({
      request: {
        method: 'GET',
        mode: 'navigate',
        destination: 'document',
        headers: new Headers(),
        url: 'https://portal.example.test/dashboard',
      },
      respondWith: navigation,
    });
    expect(navigation).not.toHaveBeenCalled();

    const crossOrigin = vi.fn();
    fetchListener({
      request: new Request('https://storage.example.test/_next/static/chunks/app.js'),
      respondWith: crossOrigin,
    });
    expect(crossOrigin).not.toHaveBeenCalled();
  });

  it('exposes warm, purge, status and explicit update activation messages without auto-skipping install', () => {
    const { listeners, self } = loadWorker();
    expect(listeners.has('message')).toBe(true);
    expect(listeners.has('activate')).toBe(true);
    expect(listeners.has('install')).toBe(false);
    expect(self.skipWaiting).not.toHaveBeenCalled();

    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/public/sw.js'),
      'utf8',
    );
    expect(source).toContain('PORTAL_STATIC_CACHE_WARM');
    expect(source).toContain('PORTAL_STATIC_CACHE_PURGE');
    expect(source).toContain('PORTAL_STATIC_CACHE_STATUS');
    expect(source).toContain('PORTAL_STATIC_CACHE_ACTIVATE');
  });

  it('does not delete an older active release cache while a waiting release warms', async () => {
    const { listeners, cacheStorage } = loadWorker();
    const postMessage = vi.fn();
    let operation: Promise<unknown> | null = null;

    listeners.get('message')?.({
      data: {
        type: 'PORTAL_STATIC_CACHE_WARM',
        version: 'release-123',
        urls: ['https://portal.example.test/_next/static/chunks/app.js'],
      },
      ports: [{ postMessage }],
      waitUntil: (value: Promise<unknown>) => {
        operation = value;
      },
    });
    await operation;

    expect(postMessage).toHaveBeenCalledWith({
      ok: true,
      type: 'PORTAL_STATIC_CACHE_WARMED',
      version: 'release-123',
      warmed: 1,
    });
    expect(cacheStorage.delete).not.toHaveBeenCalledWith(
      'sanctuary-portal-static-v1:release-122',
    );
  });

  it('retires older release caches after an already-active release finishes warming', async () => {
    const { listeners, cacheStorage } = loadWorker({ activeWorkerVersion: 'release-123' });
    await cacheStorage.open('sanctuary-portal-static-v1:release-122');
    const postMessage = vi.fn();
    let operation: Promise<unknown> | null = null;

    listeners.get('message')?.({
      data: {
        type: 'PORTAL_STATIC_CACHE_WARM',
        version: 'release-123',
        urls: ['https://portal.example.test/_next/static/chunks/app.js'],
      },
      ports: [{ postMessage }],
      waitUntil: (value: Promise<unknown>) => {
        operation = value;
      },
    });
    await operation;

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(cacheStorage.delete).toHaveBeenCalledWith(
      'sanctuary-portal-static-v1:release-122',
    );
    expect(
      cacheStorage.delete.mock.calls.filter(
        ([name]) => name === 'sanctuary-portal-static-v1:release-123',
      ),
      'The candidate cache is reset once before warming, but cleanup must preserve it.',
    ).toHaveLength(1);
  });

  it('rejects stale-client warm requests for a different worker release', async () => {
    const { listeners, fetchMock, cacheStorage } = loadWorker();
    const postMessage = vi.fn();
    let operation: Promise<unknown> | null = null;

    listeners.get('message')?.({
      data: {
        type: 'PORTAL_STATIC_CACHE_WARM',
        version: 'release-122',
        urls: ['https://portal.example.test/_next/static/chunks/app.js'],
      },
      ports: [{ postMessage }],
      waitUntil: (value: Promise<unknown>) => {
        operation = value;
      },
    });
    await operation;

    expect(postMessage).toHaveBeenCalledWith({
      ok: false,
      type: 'PORTAL_STATIC_CACHE_WARMED',
      error: 'worker_version_mismatch',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });

  it('serializes concurrent warms and preserves a completed release when a later warm fails', async () => {
    const { listeners, cacheStorage, fetchMock, metadataCache } = loadWorker();
    fetchMock
      .mockResolvedValueOnce(new Response('', {
        status: 200,
        headers: { 'cache-control': 'public, max-age=31536000, immutable' },
      }))
      .mockRejectedValueOnce(new Error('transient network failure'));
    const firstReply = vi.fn();
    const secondReply = vi.fn();
    let firstOperation: Promise<unknown> | null = null;
    let secondOperation: Promise<unknown> | null = null;

    listeners.get('message')?.({
      data: {
        type: 'PORTAL_STATIC_CACHE_WARM',
        version: 'release-123',
        urls: ['https://portal.example.test/_next/static/chunks/first.js'],
      },
      ports: [{ postMessage: firstReply }],
      waitUntil: (value: Promise<unknown>) => { firstOperation = value; },
    });
    listeners.get('message')?.({
      data: {
        type: 'PORTAL_STATIC_CACHE_WARM',
        version: 'release-123',
        urls: ['https://portal.example.test/_next/static/chunks/second.js'],
      },
      ports: [{ postMessage: secondReply }],
      waitUntil: (value: Promise<unknown>) => { secondOperation = value; },
    });

    await Promise.all([firstOperation, secondOperation]);

    expect(firstReply).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(secondReply).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      error: 'warm_failed',
    }));
    expect(cacheStorage.delete).toHaveBeenCalledTimes(1);
    expect(metadataCache.put).toHaveBeenCalledOnce();
    expect(metadataCache.delete).toHaveBeenCalledOnce();
  });

  it('keeps the previous release when the active worker cache is incomplete', async () => {
    const { listeners, cacheStorage } = loadWorker();
    cacheStorage.keys.mockResolvedValue([
      'sanctuary-portal-static-v1:release-122',
      'sanctuary-portal-static-v1:release-123',
    ]);
    let activation: Promise<unknown> | null = null;

    listeners.get('activate')?.({
      waitUntil: (value: Promise<unknown>) => { activation = value; },
    });
    await activation;

    expect(cacheStorage.delete).not.toHaveBeenCalledWith(
      'sanctuary-portal-static-v1:release-122',
    );
  });

  it('does not trust a stale completion marker when its release cache is missing', async () => {
    const {
      listeners,
      cacheStorage,
      fetchMock,
      metadataCache,
    } = loadWorker();
    await cacheStorage.open('sanctuary-portal-static-v1:release-122');
    await cacheStorage.open('sanctuary-portal-static-meta-v1');
    await metadataCache.put(
      'https://portal.example.test/__portal-static-cache-meta__/complete/release-123',
      new Response('release-123'),
    );
    fetchMock.mockRejectedValueOnce(new Error('rollback asset unavailable'));
    const postMessage = vi.fn();
    let warm: Promise<unknown> | null = null;

    listeners.get('message')?.({
      data: {
        type: 'PORTAL_STATIC_CACHE_WARM',
        version: 'release-123',
        urls: ['https://portal.example.test/_next/static/chunks/rollback.js'],
      },
      ports: [{ postMessage }],
      waitUntil: (value: Promise<unknown>) => { warm = value; },
    });
    await warm;

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      error: 'warm_failed',
    }));
    expect(metadataCache.delete).toHaveBeenCalled();

    let activation: Promise<unknown> | null = null;
    listeners.get('activate')?.({
      waitUntil: (value: Promise<unknown>) => { activation = value; },
    });
    await activation;

    expect(cacheStorage.delete).not.toHaveBeenCalledWith(
      'sanctuary-portal-static-v1:release-122',
    );
  });
});
