import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeScheduleBundleBudgets,
  assertScheduleBundleBudgets,
  ScheduleBundleBudgetError,
  type ScheduleBundleBudgets,
} from './scheduleBundleBudgets';

let tempDir = '';

function writeFile(file: string, contents: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function writeBytes(nextDir: string, file: string, size: number, byte: number) {
  writeFile(path.join(nextDir, file), Buffer.alloc(size, byte));
}

function generousBudgets(overrides?: Partial<ScheduleBundleBudgets>): Partial<ScheduleBundleBudgets> {
  return {
    initialRawBytes: 1_000_000,
    initialGzipBytes: 1_000_000,
    lazyTotalRawBytes: 1_000_000,
    lazyTotalGzipBytes: 1_000_000,
    largestLazyRawBytes: 1_000_000,
    largestLazyGzipBytes: 1_000_000,
    ...(overrides ?? {}),
  };
}

function createFixtureNextDir() {
  const nextDir = path.join(tempDir, '.next');
  writeFile(
    path.join(nextDir, 'server/app/staff/schedule/page_client-reference-manifest.js'),
    `globalThis.__RSC_MANIFEST = {
      "/staff/schedule/page": {
        clientModules: {
          "sync-a": { async: false, chunks: ["/_next/static/chunks/sync-a.js", "/_next/static/chunks/sync-shared.js"] },
          "sync-duplicate": { async: false, chunks: ["/_next/static/chunks/sync-a.js"] },
          "async-ignored": { async: true, chunks: ["/_next/static/chunks/async-ignored.js"] }
        }
      }
    };`,
  );
  writeFile(
    path.join(nextDir, 'server/app/staff/schedule/page/react-loadable-manifest.json'),
    JSON.stringify({
      101: { id: 101, files: ['static/chunks/lazy-a.js', 'static/chunks/lazy-shared.css'] },
      202: { id: 202, files: ['/_next/static/chunks/lazy-shared.css', 'static/chunks/lazy-b.js'] },
    }),
  );

  writeBytes(nextDir, 'static/chunks/sync-a.js', 10, 1);
  writeBytes(nextDir, 'static/chunks/sync-shared.js', 20, 2);
  writeBytes(nextDir, 'static/chunks/async-ignored.js', 90, 3);
  writeBytes(nextDir, 'static/chunks/lazy-a.js', 30, 4);
  writeBytes(nextDir, 'static/chunks/lazy-shared.css', 40, 5);
  writeBytes(nextDir, 'static/chunks/lazy-b.js', 50, 6);
  return nextDir;
}

describe('schedule bundle budget parser', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-bundle-budget-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('counts duplicate chunks once and reports raw and gzip sizes', () => {
    const nextDir = createFixtureNextDir();
    const report = analyzeScheduleBundleBudgets({ nextDir, budgets: generousBudgets(), topContributors: 3 });

    expect(report.initial.rawBytes).toBe(30);
    expect(report.initial.files.map((file) => file.file).sort()).toEqual([
      'static/chunks/sync-a.js',
      'static/chunks/sync-shared.js',
    ]);
    expect(report.lazy.rawBytes).toBe(120);
    expect(report.lazy.largestEntry).toEqual(expect.objectContaining({
      id: '202',
      rawBytes: 90,
      gzipBytes: expect.any(Number),
    }));
    expect(report.initial.gzipBytes).toBeGreaterThan(0);
    expect(report.lazy.gzipBytes).toBeGreaterThan(0);
    expect(report.topContributors).toHaveLength(3);
    expect(report.topContributors[0]).toEqual(expect.objectContaining({
      file: 'static/chunks/lazy-b.js',
      rawBytes: 50,
      gzipBytes: expect.any(Number),
    }));
    expect(report.failures).toEqual([]);
  });

  it('fails with an actionable message when .next is missing', () => {
    expect(() => analyzeScheduleBundleBudgets({ nextDir: path.join(tempDir, 'missing') })).toThrowError(
      /Run npm run build:portal first/,
    );
  });

  it('fails with an actionable message when schedule manifests are missing', () => {
    const nextDir = path.join(tempDir, '.next');
    fs.mkdirSync(nextDir, { recursive: true });

    expect(() => analyzeScheduleBundleBudgets({ nextDir })).toThrowError(/Run npm run build:portal first/);
  });

  it('fails when initial sync chunks exceed budget', () => {
    const nextDir = createFixtureNextDir();

    expect(() => assertScheduleBundleBudgets({
      nextDir,
      budgets: generousBudgets({ initialRawBytes: 29 }),
    })).toThrowError(ScheduleBundleBudgetError);
  });

  it('fails when lazy totals exceed budget', () => {
    const nextDir = createFixtureNextDir();

    expect(() => assertScheduleBundleBudgets({
      nextDir,
      budgets: generousBudgets({ lazyTotalRawBytes: 119 }),
    })).toThrowError(/lazyTotalRawBytes/);
  });

  it('fails when the largest lazy entry exceeds budget', () => {
    const nextDir = createFixtureNextDir();

    expect(() => assertScheduleBundleBudgets({
      nextDir,
      budgets: generousBudgets({ largestLazyRawBytes: 89 }),
    })).toThrowError(/largestLazyRawBytes/);
  });
});
