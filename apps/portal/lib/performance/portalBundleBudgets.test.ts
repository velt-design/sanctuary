import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzePortalBundleRoute,
  budgetAtFivePercent,
  type PortalBundleRouteConfig,
} from './portalBundleBudgets';

let tempDir: string | null = null;

function write(file: string, contents: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function fixture(): { nextDir: string; config: PortalBundleRouteConfig } {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-bundle-budget-'));
  const nextDir = path.join(tempDir, '.next');
  const config: PortalBundleRouteConfig = {
    id: 'calculator',
    route: '/staff/example',
    routeKey: '/staff/example/page',
    clientReferenceManifest: 'server/app/staff/example/page_client-reference-manifest.js',
    reactLoadableManifest: 'server/app/staff/example/page/react-loadable-manifest.json',
    budgets: {
      initialRawBytes: 100,
      initialGzipBytes: 100,
      lazyTotalRawBytes: 100,
      lazyTotalGzipBytes: 100,
      largestLazyRawBytes: 100,
      largestLazyGzipBytes: 100,
    },
  };
  write(path.join(nextDir, config.clientReferenceManifest), `globalThis.__RSC_MANIFEST = {
    "/staff/example/page": { clientModules: { a: { async: false, chunks: ["/_next/static/a.js"] } } }
  };`);
  write(path.join(nextDir, config.reactLoadableManifest), JSON.stringify({ lazy: { files: ['static/lazy.js'] } }));
  write(path.join(nextDir, 'static/a.js'), Buffer.alloc(10, 1));
  write(path.join(nextDir, 'static/lazy.js'), Buffer.alloc(20, 2));
  return { nextDir, config };
}

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe('portal route bundle budgets', () => {
  it('analyzes an arbitrary configured route', () => {
    const { nextDir, config } = fixture();
    const report = analyzePortalBundleRoute({ nextDir, config });

    expect(report.route).toBe('/staff/example');
    expect(report.initial.rawBytes).toBe(10);
    expect(report.lazy.rawBytes).toBe(20);
    expect(report.failures).toEqual([]);
  });

  it('rounds a five-percent baseline up to the next KiB', () => {
    expect(budgetAtFivePercent(1_000)).toBe(2_048);
    expect(budgetAtFivePercent(2_048)).toBe(3_072);
  });

  it('reports changed manifest paths with the fresh-build recovery command', () => {
    const { nextDir, config } = fixture();
    config.clientReferenceManifest = 'server/app/staff/example/moved.js';
    expect(() => analyzePortalBundleRoute({ nextDir, config })).toThrow(/fresh portal build.*portal:bundle-budget/i);
  });
});
