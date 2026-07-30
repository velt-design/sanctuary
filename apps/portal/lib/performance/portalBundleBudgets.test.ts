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

  it('finds Turbopack lazy loader groups when the loadable manifest is empty', () => {
    const { nextDir, config } = fixture();
    config.budgets = {
      initialRawBytes: 1_000,
      initialGzipBytes: 1_000,
      lazyTotalRawBytes: 1_000,
      lazyTotalGzipBytes: 1_000,
      largestLazyRawBytes: 1_000,
      largestLazyGzipBytes: 1_000,
    };
    write(path.join(nextDir, config.reactLoadableManifest), '{}');
    write(
      path.join(nextDir, 'static/a.js'),
      'e.v(t=>Promise.all(["static/chunks/lazy-a.css","static/chunks/lazy-a.js"].map(t=>e.l(t))).then(()=>t(1)))',
    );
    write(path.join(nextDir, 'static/chunks/lazy-a.css'), Buffer.alloc(12, 3));
    write(path.join(nextDir, 'static/chunks/lazy-a.js'), Buffer.alloc(18, 4));

    const report = analyzePortalBundleRoute({ nextDir, config });

    expect(report.lazy.entries).toHaveLength(1);
    expect(report.lazy.rawBytes).toBe(30);
    expect(report.lazy.largestEntry?.rawBytes).toBe(30);
  });

  it('reconciles a stale loadable JavaScript hash with the emitted loader for the same module', () => {
    const { nextDir, config } = fixture();
    write(
      path.join(nextDir, 'static/a.js'),
      'e.v(t=>Promise.all(["static/chunks/emitted.css","static/chunks/emitted.js"].map(t=>e.l(t))).then(()=>t(42)))',
    );
    write(path.join(nextDir, config.reactLoadableManifest), JSON.stringify({
      42: { id: 42, files: ['static/chunks/stale.js', 'static/chunks/emitted.css'] },
    }));
    write(path.join(nextDir, 'static/chunks/emitted.css'), Buffer.alloc(12, 3));
    write(path.join(nextDir, 'static/chunks/emitted.js'), Buffer.alloc(18, 4));

    const report = analyzePortalBundleRoute({ nextDir, config });

    expect(report.lazy.entries).toHaveLength(1);
    expect(report.lazy.entries[0]?.files.map((file) => file.file)).toEqual([
      'static/chunks/emitted.css',
      'static/chunks/emitted.js',
    ]);
    expect(report.lazy.rawBytes).toBe(30);
  });

  it('fails closed when a stale loadable hash has no matching emitted module', () => {
    const { nextDir, config } = fixture();
    write(
      path.join(nextDir, 'static/a.js'),
      'e.v(t=>Promise.all(["static/chunks/emitted.js"].map(t=>e.l(t))).then(()=>t(41)))',
    );
    write(path.join(nextDir, config.reactLoadableManifest), JSON.stringify({
      42: { id: 42, files: ['static/chunks/stale.js'] },
    }));
    write(path.join(nextDir, 'static/chunks/emitted.js'), Buffer.alloc(18, 4));

    expect(() => analyzePortalBundleRoute({ nextDir, config }))
      .toThrow(/stale\.js.*fresh portal build.*portal:bundle-budget/i);
  });

  it('retains module identity when two loaders share an emitted chunk group', () => {
    const { nextDir, config } = fixture();
    write(
      path.join(nextDir, 'static/a.js'),
      [
        'e.v(t=>Promise.all(["static/chunks/shared.js"].map(t=>e.l(t))).then(()=>t(41)))',
        'e.v(t=>Promise.all(["static/chunks/shared.js"].map(t=>e.l(t))).then(()=>t(42)))',
      ].join(';'),
    );
    write(path.join(nextDir, config.reactLoadableManifest), JSON.stringify({
      42: { id: 42, files: ['static/chunks/stale.js'] },
    }));
    write(path.join(nextDir, 'static/chunks/shared.js'), Buffer.alloc(18, 4));

    const report = analyzePortalBundleRoute({ nextDir, config });

    expect(report.lazy.files.map((file) => file.file)).toEqual(['static/chunks/shared.js']);
  });

  it('ignores missing artifacts from unrelated global loader modules', () => {
    const { nextDir, config } = fixture();
    write(
      path.join(nextDir, 'static/a.js'),
      'e.v(t=>Promise.all(["static/chunks/route.js"].map(t=>e.l(t))).then(()=>t(42)))',
    );
    write(path.join(nextDir, config.reactLoadableManifest), JSON.stringify({
      42: { id: 42, files: ['static/chunks/stale.js'] },
    }));
    write(path.join(nextDir, 'static/chunks/route.js'), Buffer.alloc(18, 4));
    write(
      path.join(nextDir, 'static/chunks/unrelated-loader.js'),
      'e.v(t=>Promise.all(["static/chunks/missing-unrelated.js"].map(t=>e.l(t))).then(()=>t(99)))',
    );

    const report = analyzePortalBundleRoute({ nextDir, config });

    expect(report.lazy.files.map((file) => file.file)).toEqual(['static/chunks/route.js']);
  });

  it('does not charge route entry CSS again when a lazy manifest repeats it', () => {
    const { nextDir, config } = fixture();
    write(path.join(nextDir, config.clientReferenceManifest), `globalThis.__RSC_MANIFEST = {
      "/staff/example/page": {
        clientModules: { a: { async: false, chunks: ["/_next/static/a.js"] } },
        entryCSSFiles: { layout: [{ path: "static/entry.css", inlined: false }] }
      }
    };`);
    write(path.join(nextDir, config.reactLoadableManifest), JSON.stringify({
      lazy: { files: ['static/entry.css', 'static/lazy.js'] },
    }));
    write(path.join(nextDir, 'static/entry.css'), Buffer.alloc(30, 3));

    const report = analyzePortalBundleRoute({ nextDir, config });

    expect(report.initial.rawBytes).toBe(10);
    expect(report.lazy.rawBytes).toBe(20);
    expect(report.lazy.entries[0]?.files.map((file) => file.file)).toEqual(['static/lazy.js']);
  });

  it('reports changed manifest paths with the fresh-build recovery command', () => {
    const { nextDir, config } = fixture();
    config.clientReferenceManifest = 'server/app/staff/example/moved.js';
    expect(() => analyzePortalBundleRoute({ nextDir, config })).toThrow(/fresh portal build.*portal:bundle-budget/i);
  });
});
