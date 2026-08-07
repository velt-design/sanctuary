(() => {
  'use strict';

  const META_CACHE_NAME = 'sanctuary-portal-static-meta-v1';
  const STATIC_CACHE_PREFIX = 'sanctuary-portal-static-v1:';
  const SAFE_PUBLIC_PATHS = new Set([
    '/images/sp_dark_icon.png',
    '/logo-sanctuary.png',
    '/logo-sanctuary.svg',
  ]);
  const NEXT_STATIC_ASSET_EXTENSION = /\.(?:css|js|mjs|otf|ttf|wasm|woff2?)$/i;
  const CACHE_VERSION_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;
  const FORBIDDEN_RESPONSE_TYPE = /(?:application\/octet-stream|application\/pdf|text\/html|text\/x-component)/i;
  const warmOperations = new Map();

  function normalizeVersion(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return CACHE_VERSION_PATTERN.test(normalized) ? normalized : null;
  }

  const WORKER_VERSION = normalizeVersion(
    new URL(self.location.href).searchParams.get('v'),
  );

  function isFlightRequest(request, url) {
    if (url.searchParams.has('_rsc')) return true;
    if (request.headers.get('rsc') !== null) return true;
    if (request.headers.get('next-router-state-tree') !== null) return true;
    if (request.headers.get('next-router-prefetch') !== null) return true;
    if (request.headers.get('x-nextjs-data') !== null) return true;
    return (request.headers.get('accept') || '').toLowerCase().includes('text/x-component');
  }

  function isAllowedStaticPath(pathname) {
    if (SAFE_PUBLIC_PATHS.has(pathname)) return true;
    return pathname.startsWith('/_next/static/') && NEXT_STATIC_ASSET_EXTENSION.test(pathname);
  }

  function isCacheableStaticRequest(request) {
    if (!request || request.method !== 'GET') return false;
    if (request.mode === 'navigate' || request.destination === 'document') return false;
    if (request.headers.get('range') !== null) return false;
    if (request.headers.get('authorization') !== null) return false;

    let url;
    try {
      url = new URL(request.url);
    } catch {
      return false;
    }

    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.origin !== self.location.origin) return false;
    if (url.search || url.hash || isFlightRequest(request, url)) return false;
    if (url.pathname.startsWith('/api/')) return false;
    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/access-status')) return false;
    if (url.pathname.startsWith('/_next/image')) return false;
    if (/\.(?:blob|dwg|pdf)$/i.test(url.pathname)) return false;
    return isAllowedStaticPath(url.pathname);
  }

  function isCacheableStaticResponse(response, requestUrl) {
    if (!response || !response.ok || response.redirected || response.type === 'opaque') return false;
    const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
    if (cacheControl.includes('private') || cacheControl.includes('no-store')) return false;
    if ((response.headers.get('content-disposition') || '').toLowerCase().includes('attachment')) return false;
    if (FORBIDDEN_RESPONSE_TYPE.test(response.headers.get('content-type') || '')) return false;
    if (requestUrl.pathname.startsWith('/_next/static/') && !cacheControl.includes('immutable')) return false;
    return true;
  }

  function cacheName(version) {
    return `${STATIC_CACHE_PREFIX}${version}`;
  }

  function isCurrentWorkerActive() {
    const activeScriptUrl = self.registration?.active?.scriptURL;
    if (typeof activeScriptUrl !== 'string') return false;
    try {
      return new URL(activeScriptUrl).href === new URL(self.location.href).href;
    } catch {
      return false;
    }
  }

  function completionMarkerRequest(version) {
    return new Request(
      `${self.location.origin}/__portal-static-cache-meta__/complete/${encodeURIComponent(version)}`,
      { credentials: 'omit' },
    );
  }

  async function isVersionCacheComplete(version) {
    try {
      const names = await caches.keys();
      if (!names.includes(cacheName(version))) return false;
      const metadata = await caches.open(META_CACHE_NAME);
      return Boolean(await metadata.match(completionMarkerRequest(version)));
    } catch {
      return false;
    }
  }

  async function markVersionCacheComplete(version) {
    const metadata = await caches.open(META_CACHE_NAME);
    await metadata.put(
      completionMarkerRequest(version),
      new Response(version, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }),
    );
  }

  async function clearVersionCacheMarker(version) {
    try {
      const metadata = await caches.open(META_CACHE_NAME);
      await metadata.delete(completionMarkerRequest(version));
    } catch {
      // A missing/unavailable marker already means the release is incomplete.
    }
  }

  async function deleteOldVersionCaches(activeVersion) {
    if (!(await isVersionCacheComplete(activeVersion))) return;
    const activeName = cacheName(activeVersion);
    const names = await caches.keys();
    if (!names.includes(activeName)) return;
    await Promise.all(
      names
        .filter((name) => name.startsWith(STATIC_CACHE_PREFIX) && name !== activeName)
        .map(async (name) => {
          await caches.delete(name);
          await clearVersionCacheMarker(name.slice(STATIC_CACHE_PREFIX.length));
        }),
    );
  }

  async function purgeOwnedCaches() {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name === META_CACHE_NAME || name.startsWith(STATIC_CACHE_PREFIX))
        .map((name) => caches.delete(name)),
    );
  }

  async function warmStaticCache(versionValue, values) {
    const version = normalizeVersion(versionValue);
    if (!version) throw new Error('invalid_version');
    if (!WORKER_VERSION || version !== WORKER_VERSION) throw new Error('worker_version_mismatch');
    if (!Array.isArray(values) || values.length === 0) throw new Error('empty_asset_list');

    const urls = Array.from(new Set(values));
    const requests = urls.map((value) => new Request(value, {
      cache: 'reload',
      credentials: 'omit',
      method: 'GET',
    }));
    if (requests.some((request) => !isCacheableStaticRequest(request))) {
      throw new Error('unsafe_asset');
    }

    const candidateName = cacheName(version);
    const candidateWasComplete = await isVersionCacheComplete(version);
    if (!candidateWasComplete) {
      await clearVersionCacheMarker(version);
      await caches.delete(candidateName);
    }
    const candidate = await caches.open(candidateName);

    try {
      for (const request of requests) {
        const response = await fetch(request);
        const requestUrl = new URL(request.url);
        if (!isCacheableStaticResponse(response, requestUrl)) throw new Error('unsafe_response');
        await candidate.put(request, response.clone());
      }
      await markVersionCacheComplete(version);
      if (isCurrentWorkerActive()) {
        // A first activation can run before the authenticated warm has made
        // this release complete. Retire older releases now that the active
        // worker has a safe cache, but never delete the cache owned by a
        // different worker while this release is still waiting.
        await deleteOldVersionCaches(version).catch(() => undefined);
      }
      return { version, warmed: requests.length };
    } catch (error) {
      if (!candidateWasComplete) {
        await caches.delete(candidateName);
        await clearVersionCacheMarker(version);
      }
      throw error;
    }
  }

  function queueStaticCacheWarm(version, values) {
    const previous = warmOperations.get(version) || Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(() => warmStaticCache(version, values));
    warmOperations.set(version, operation);
    operation.finally(() => {
      if (warmOperations.get(version) === operation) warmOperations.delete(version);
    }).catch(() => undefined);
    return operation;
  }

  async function serveStaticAsset(request) {
    let cache = null;
    let cached = null;
    if (WORKER_VERSION) {
      try {
        cache = await caches.open(cacheName(WORKER_VERSION));
        cached = await cache.match(request);
      } catch {
        // Cache Storage can be blocked, corrupt, or quota constrained. Static
        // delivery must remain network-available even when offline support is not.
        cache = null;
      }
    }
    if (cached) return cached;

    const publicRequest = new Request(request, { credentials: 'omit' });
    const response = await fetch(publicRequest);
    const requestUrl = new URL(request.url);
    if (cache && isCacheableStaticResponse(response, requestUrl)) {
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  }

  function reply(event, payload) {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage(payload);
  }

  function warmErrorCode(error) {
    const code = error instanceof Error ? error.message : '';
    return [
      'invalid_version',
      'worker_version_mismatch',
      'empty_asset_list',
      'unsafe_asset',
      'unsafe_response',
    ].includes(code) ? code : 'warm_failed';
  }

  self.addEventListener('fetch', (event) => {
    if (!isCacheableStaticRequest(event.request)) return;
    event.respondWith(serveStaticAsset(event.request));
  });

  self.addEventListener('message', (event) => {
    const message = event.data || {};
    let operation;

    if (message.type === 'PORTAL_STATIC_CACHE_WARM') {
      operation = queueStaticCacheWarm(message.version, message.urls)
        .then(({ version, warmed }) => reply(event, {
          ok: true,
          type: 'PORTAL_STATIC_CACHE_WARMED',
          version,
          warmed,
        }))
        .catch((error) => reply(event, {
          ok: false,
          type: 'PORTAL_STATIC_CACHE_WARMED',
          error: warmErrorCode(error),
        }));
    } else if (message.type === 'PORTAL_STATIC_CACHE_PURGE') {
      operation = purgeOwnedCaches().then(() => reply(event, {
        ok: true,
        type: 'PORTAL_STATIC_CACHE_PURGED',
      }));
    } else if (message.type === 'PORTAL_STATIC_CACHE_STATUS') {
      operation = caches.keys().then((names) => reply(event, {
        ok: true,
        type: 'PORTAL_STATIC_CACHE_STATUS',
        version: WORKER_VERSION,
        caches: names.filter(
          (name) => name === META_CACHE_NAME || name.startsWith(STATIC_CACHE_PREFIX),
        ),
      }));
    } else if (message.type === 'PORTAL_STATIC_CACHE_ACTIVATE') {
      operation = Promise.resolve(self.skipWaiting()).then(() => reply(event, {
        ok: true,
        type: 'PORTAL_STATIC_CACHE_ACTIVATED',
      }));
    } else {
      return;
    }

    if (typeof event.waitUntil === 'function') event.waitUntil(operation);
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(Promise.all([
      self.clients.claim(),
      WORKER_VERSION ? deleteOldVersionCaches(WORKER_VERSION) : Promise.resolve(),
    ]));
  });
})();
