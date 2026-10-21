// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkPortalMiddlewarePlacement } from '../scripts/check-portal-middleware-placement.mjs';

const roots: string[] = [];
const guard = path.resolve('scripts/check-portal-middleware-placement.mjs');
const portalPackage = JSON.parse(fs.readFileSync('apps/portal/package.json', 'utf8'));
const validOutput = { regions: ['bom1'], runtime: 'nodejs24.x', useWebApi: true };
const hosted = { VERCEL: '1' };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-output-'));
  roots.push(root);
  const portalDir = path.join(root, 'apps/portal');
  fs.mkdirSync(portalDir, { recursive: true });
  fs.writeFileSync(path.join(portalDir, 'vercel.json'), JSON.stringify({ functions: { 'middleware.ts': { regions: ['bom1'] } } }));
  return { root, portalDir };
}

function writeOutput(portalDir: string, value: unknown, distDir = '.next') {
  const file = path.join(portalDir, distDir, 'output/functions/_middleware.func/.vc-config.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('Portal generated middleware placement', () => {
  it('does not require adapter artifacts for an ordinary local build', () => {
    const { portalDir } = fixture();
    expect(checkPortalMiddlewarePlacement({ portalDir, env: {} })).toBe('local_build');
  });

  it('fails hosted and explicit local adapter builds when output is missing', () => {
    const { portalDir } = fixture();
    expect(checkPortalMiddlewarePlacement({ portalDir, env: hosted })).toBe('middleware_output_unreadable');
    expect(checkPortalMiddlewarePlacement({ portalDir, env: { NEXT_ADAPTER_PATH: '/adapter/index.js' } })).toBe('middleware_output_unreadable');
  });

  it.each(['{private-invalid', 'null', '[]'])('rejects malformed/non-object output without exposing it: %s', (output) => {
    const { portalDir } = fixture();
    writeOutput(portalDir, output);
    expect(checkPortalMiddlewarePlacement({ portalDir, env: hosted })).toBe('middleware_output_invalid');
  });

  it.each([undefined, ['syd1'], ['bom1', 'syd1'], ['all'], [], 'bom1', ['bom1', 'bom1']])('rejects missing, wrong or broad regions: %j', (regions) => {
    const { portalDir } = fixture();
    writeOutput(portalDir, { ...validOutput, regions });
    expect(checkPortalMiddlewarePlacement({ portalDir, env: hosted })).toBe('middleware_regions_mismatch');
  });

  it('rejects the observed all-region deployment shape even though it includes the required region', () => {
    const { portalDir } = fixture();
    writeOutput(portalDir, { ...validOutput, regions: ['arn1', 'bom1', 'cdg1', 'cle1', 'cpt1', 'dub1', 'fra1', 'gru1', 'hkg1', 'hnd1', 'iad1', 'icn1', 'kix1', 'lhr1', 'pdx1', 'sfo1', 'sin1', 'syd1', 'yul1'] });
    expect(checkPortalMiddlewarePlacement({ portalDir, env: hosted })).toBe('middleware_regions_mismatch');
  });

  it.each([{ runtime: 'edge' }, { runtime: 'nodejs22.x' }, { runtime: undefined }, { useWebApi: false }])('rejects incorrect middleware runtime semantics: %j', (change) => {
    const { portalDir } = fixture();
    writeOutput(portalDir, { ...validOutput, ...change });
    expect(checkPortalMiddlewarePlacement({ portalDir, env: hosted })).toBe('middleware_runtime_mismatch');
  });

  it('uses the actual configured distDir and does not fall back to a stale default artifact', () => {
    const { portalDir } = fixture();
    writeOutput(portalDir, validOutput);
    const env = { ...hosted, PORTAL_PLAYWRIGHT_DIST_DIR: ' .next-fixture ' };
    expect(checkPortalMiddlewarePlacement({ portalDir, env })).toBe('middleware_output_unreadable');
    const file = writeOutput(portalDir, validOutput, '.next-fixture');
    const before = fs.readFileSync(file);
    expect(checkPortalMiddlewarePlacement({ portalDir, env })).toBe('verified');
    expect(fs.readFileSync(file)).toEqual(before);
  });

  it.each(['missing', '{private-invalid', '{}', '{"functions":{"middleware.ts":{"regions":["bom1","syd1"]}}}'])('fails without a valid narrow source requirement: %s', (source) => {
    const { portalDir } = fixture();
    const file = path.join(portalDir, 'vercel.json');
    if (source === 'missing') fs.unlinkSync(file);
    else fs.writeFileSync(file, source);
    writeOutput(portalDir, validOutput);
    expect(checkPortalMiddlewarePlacement({ portalDir, env: hosted })).toMatch(/^source_/);
  });

  it.each(['valid', 'wrong', 'local', 'build-failure'])('runs the real npm postbuild after artifact creation and propagates failure: %s', (mode) => {
    const { root, portalDir } = fixture();
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.copyFileSync(guard, path.join(root, 'scripts/check-portal-middleware-placement.mjs'));
    const generated = mode === 'wrong' ? { ...validOutput, regions: ['syd1'] } : validOutput;
    fs.writeFileSync(path.join(portalDir, 'fixture-build.cjs'), mode === 'build-failure' ? 'process.exit(7);' : `
      const fs = require('node:fs');
      fs.mkdirSync('.next/output/functions/_middleware.func', {recursive:true});
      ${mode === 'local' ? '' : `fs.writeFileSync('.next/output/functions/_middleware.func/.vc-config.json', ${JSON.stringify(JSON.stringify(generated))});`}
    `);
    fs.writeFileSync(path.join(portalDir, 'package.json'), JSON.stringify({ scripts: {
      build: 'node fixture-build.cjs', postbuild: portalPackage.scripts.postbuild,
    } }));
    // npm sets this to the running npm CLI on both Windows and CI; no shell or network.
    expect(process.env.npm_execpath).toBeTruthy();
    const env = { ...process.env, VERCEL: mode === 'local' ? '' : '1', NEXT_ADAPTER_PATH: '', PORTAL_PLAYWRIGHT_DIST_DIR: '', npm_config_ignore_scripts: 'false', npm_config_audit: 'false', npm_config_update_notifier: 'false' };
    const result = spawnSync(process.execPath, [process.env.npm_execpath!, 'run', 'build'], { cwd: portalDir, env, encoding: 'utf8', timeout: 10_000 });
    expect(result.error).toBeUndefined();
    const output = result.stdout + result.stderr;
    if (mode === 'wrong') {
      expect(result.status).not.toBe(0);
      expect(output).toContain('[portal-middleware-placement] failed: middleware_regions_mismatch');
    } else if (mode === 'build-failure') {
      expect(result.status).not.toBe(0);
      expect(output).not.toContain('[portal-middleware-placement]');
    } else {
      expect(result.status).toBe(0);
      expect(output).toContain(`[portal-middleware-placement] ${mode === 'local' ? 'local_build' : 'verified'}`);
    }
  });
});
