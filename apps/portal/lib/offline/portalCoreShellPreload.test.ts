import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  PORTAL_CORE_SHELL_KEYS,
  createPortalCoreShellPreloader,
  waitForPortalServiceWorkerReady,
  type PortalCoreShellKey,
  type PortalCoreShellLoader,
} from './portalCoreShellPreload';

function loaders(
  overrides: Partial<Record<PortalCoreShellKey, PortalCoreShellLoader>> = {},
): Record<PortalCoreShellKey, PortalCoreShellLoader> {
  return Object.fromEntries(
    PORTAL_CORE_SHELL_KEYS.map((key) => [key, overrides[key] ?? vi.fn(async () => ({ default: key }))]),
  ) as Record<PortalCoreShellKey, PortalCoreShellLoader>;
}

describe('portal core-shell code preload', () => {
  it('loads requested data-free shell modules concurrently and deduplicates later calls', async () => {
    const shellLoaders = loaders();
    const preload = createPortalCoreShellPreloader(shellLoaders);

    await expect(preload(['all-route-frames'])).resolves.toEqual({
      loaded: ['all-route-frames'],
      failed: [],
    });
    await expect(preload(['all-route-frames'])).resolves.toEqual({
      loaded: ['all-route-frames'],
      failed: [],
    });

    expect(shellLoaders['all-route-frames']).toHaveBeenCalledOnce();
  });

  it('reports a failed optional shell without rejecting the remaining preload', async () => {
    const shellLoaders = loaders({
      'all-route-frames': vi.fn(async () => {
        throw new Error('chunk unavailable');
      }),
    });
    const preload = createPortalCoreShellPreloader(shellLoaders);

    await expect(preload(['all-route-frames'])).resolves.toEqual({
      loaded: [],
      failed: ['all-route-frames'],
    });
    await preload(['all-route-frames']);
    expect(shellLoaders['all-route-frames']).toHaveBeenCalledTimes(2);
  });

  it('waits for service-worker readiness but has a bounded fallback', async () => {
    await expect(waitForPortalServiceWorkerReady({
      timeoutMs: 20,
      serviceWorker: { ready: Promise.resolve({} as ServiceWorkerRegistration) },
    })).resolves.toBe('ready');

    await expect(waitForPortalServiceWorkerReady({
      timeoutMs: 1,
      serviceWorker: { ready: new Promise<ServiceWorkerRegistration>(() => {}) },
    })).resolves.toBe('timeout');

    await expect(waitForPortalServiceWorkerReady({ serviceWorker: null })).resolves.toBe('unsupported');
  });

  it('imports shell/frame modules only and never asks Next to prefetch RSC', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/lib/offline/portalCoreShellPreload.ts'),
      'utf8',
    );

    expect(source).toContain('loadPortalExactRouteFrameModule');
    expect(source).not.toMatch(/router\.prefetch|fetch\(|apiJson|useQuery|supabase/i);

    const moduleCacheSource = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/lib/offline/portalCoreShellModuleCache.ts'),
      'utf8',
    );
    expect(moduleCacheSource).toContain("import('@/components/page-state/PortalExactRouteFrame')");
    expect(moduleCacheSource).not.toMatch(/router\.prefetch|fetch\(|apiJson|useQuery|supabase/i);

    const shellSource = readFileSync(
      path.resolve(process.cwd(), 'apps/portal/components/page-state/PortalExactRouteFrame.tsx'),
      'utf8',
    );
    expect(shellSource).not.toMatch(/router\.prefetch|fetch\(|apiJson|useQuery|supabase/i);
  });
});
