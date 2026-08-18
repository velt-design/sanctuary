import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { backgroundJobHandlers } from './handlers';
import { loadWorkerConfig } from './config';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

type ProductionSource = Readonly<{ relativePath: string; source: string }>;

function productionSources(directory = sourceRoot): readonly ProductionSource[] {
  const sources: ProductionSource[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...productionSources(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      sources.push({
        relativePath: path.relative(sourceRoot, absolutePath).replaceAll('\\', '/'),
        source: readFileSync(absolutePath, 'utf8'),
      });
    }
  }
  return sources.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function importedSpecifiers(source: string): readonly string[] {
  const matches = source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g);
  return [...matches].map((match) => match[1] ?? '');
}

function forbiddenImport(specifier: string): boolean {
  return (
    specifier === 'react' ||
    specifier.startsWith('react/') ||
    specifier === 'next' ||
    specifier.startsWith('next/') ||
    specifier === '@supabase/ssr' ||
    specifier === 'idb-keyval' ||
    specifier.startsWith('@/') ||
    specifier.startsWith('apps/portal') ||
    specifier.startsWith('apps/marketing') ||
    /^(?:\.\.\/)+(?:portal|marketing)(?:\/|$)/.test(specifier)
  );
}

describe('worker application boundaries', () => {
  it('does not import React, Next, browser owners, or another application', () => {
    const violations = productionSources().flatMap(({ relativePath, source }) =>
      importedSpecifiers(source)
        .filter(forbiddenImport)
        .map((specifier) => `${relativePath}: ${specifier}`),
    );

    expect(violations).toEqual([]);
  });

  it('keeps persistence behind the explicit RPC adapter', () => {
    const forbiddenPatterns = [
      /\.from\s*\(/,
      /\.schema\s*\(/,
      /\bpgmq\b/i,
      /\bprivate\./i,
    ];
    const violations = productionSources().flatMap(({ relativePath, source }) =>
      forbiddenPatterns.filter((pattern) => pattern.test(source)).map((pattern) => `${relativePath}: ${pattern.source}`),
    );

    expect(violations).toEqual([]);
    expect(
      productionSources()
        .filter(({ relativePath, source }) => relativePath !== 'backgroundJobsRpcClient.ts' && /\.rpc\s*\(/.test(source))
        .map(({ relativePath }) => relativePath),
    ).toEqual([]);
  });

  it('keeps service-role configuration and client construction in their two owners', () => {
    const sources = productionSources();
    expect(
      sources.filter(({ source }) => source.includes('SUPABASE_SERVICE_ROLE_KEY')).map(({ relativePath }) => relativePath),
    ).toEqual(['config.ts']);
    expect(sources.filter(({ source }) => source.includes('createClient(')).map(({ relativePath }) => relativePath)).toEqual([
      'backgroundJobsRpcClient.ts',
    ]);
    expect(
      sources
        .filter(({ source }) => importedSpecifiers(source).includes('@supabase/supabase-js'))
        .map(({ relativePath }) => relativePath),
    ).toEqual(['backgroundJobsRpcClient.ts']);
  });

  it('forbids raw console logging from production worker sources', () => {
    expect(
      productionSources()
        .filter(({ source }) => /\bconsole\s*\./.test(source))
        .map(({ relativePath }) => relativePath),
    ).toEqual([]);
  });

  it('registers only the effect-free synthetic handler and keeps the worker dark by default', () => {
    expect(Object.isFrozen(backgroundJobHandlers)).toBe(true);
    expect(Object.keys(backgroundJobHandlers)).toEqual(['ai_synthetic_v1']);
    expect(
      loadWorkerConfig({
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
        BACKGROUND_JOBS_WORKER_ID: 'worker-1',
      }).mode,
    ).toBe('dark');
  });
});
