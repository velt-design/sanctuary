import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateAuditReport,
  findExecutableXlsxImports,
  validateXlsxDependencyPolicy,
  validateXlsxImportPolicy,
} from '../scripts/audit-toolchain.mjs';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'sanctuary-toolchain-audit-'));
  temporaryDirectories.push(directory);
  return directory;
}

function allowedAuditReport() {
  return {
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 },
    },
    vulnerabilities: {
      xlsx: {
        severity: 'high',
        isDirect: true,
        fixAvailable: false,
        nodes: ['node_modules/xlsx'],
        via: [
          { url: 'https://github.com/advisories/GHSA-4r6h-8v6p-xvw6' },
          { url: 'https://github.com/advisories/GHSA-5pgg-2g8v-p4x9' },
        ],
      },
    },
  };
}

function writeDependencyFixture(directory: string): void {
  mkdirSync(path.join(directory, 'apps', 'portal'), { recursive: true });
  writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      workspaces: ['apps/*'],
      dependencies: {},
      devDependencies: { xlsx: '^0.18.5' },
    }),
  );
  writeFileSync(
    path.join(directory, 'apps', 'portal', 'package.json'),
    JSON.stringify({ name: 'portal', dependencies: {}, devDependencies: {} }),
  );
  writeFileSync(
    path.join(directory, 'package-lock.json'),
    JSON.stringify({
      packages: {
        '': { devDependencies: { xlsx: '^0.18.5' } },
        'node_modules/xlsx': { version: '0.18.5', dev: true },
      },
    }),
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('toolchain audit allowlist', () => {
  it('accepts only the two isolated xlsx advisory exceptions', () => {
    expect(evaluateAuditReport(allowedAuditReport())).toEqual([]);
  });

  it('rejects every non-xlsx vulnerability', () => {
    const report = allowedAuditReport();
    Object.assign(report.vulnerabilities, {
      vite: {
        severity: 'high',
        isDirect: false,
        fixAvailable: true,
        nodes: ['node_modules/vite'],
        via: [{ url: 'https://github.com/advisories/GHSA-unexpected-vite' }],
      },
    });

    expect(evaluateAuditReport(report)).toContain('Unexpected high vulnerability in vite.');
  });

  it('fails closed when npm audit omits its expected report structure', () => {
    expect(evaluateAuditReport({})).toEqual([
      'npm audit JSON is missing vulnerability metadata.',
      'npm audit JSON is missing the vulnerabilities map.',
    ]);
  });

  it('fails closed when vulnerability metadata contradicts the package map', () => {
    const report = allowedAuditReport();
    report.metadata.vulnerabilities.total = 2;

    expect(evaluateAuditReport(report)).toContain(
      'npm audit vulnerability metadata does not match its package map.',
    );
  });

  it('rejects new or fixable xlsx advisories', () => {
    const report = allowedAuditReport();
    report.vulnerabilities.xlsx.fixAvailable = true;
    report.vulnerabilities.xlsx.via.push({
      url: 'https://github.com/advisories/GHSA-new-xlsx-risk',
    });

    expect(evaluateAuditReport(report)).toEqual(
      expect.arrayContaining([
        'A fix is available for xlsx; remove the exception and upgrade it.',
        'Unexpected xlsx advisory GHSA-new-xlsx-risk.',
      ]),
    );
  });
});

describe('xlsx dependency and import boundaries', () => {
  it('accepts xlsx only as the locked root development dependency', () => {
    const directory = temporaryDirectory();
    writeDependencyFixture(directory);

    expect(validateXlsxDependencyPolicy(directory)).toEqual([]);
  });

  it('rejects production or workspace xlsx declarations', () => {
    const directory = temporaryDirectory();
    writeDependencyFixture(directory);
    writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        workspaces: ['apps/*'],
        dependencies: { xlsx: '^0.18.5' },
        devDependencies: { xlsx: '^0.18.5' },
      }),
    );
    writeFileSync(
      path.join(directory, 'apps', 'portal', 'package.json'),
      JSON.stringify({ name: 'portal', dependencies: { xlsx: '^0.18.5' } }),
    );

    expect(validateXlsxDependencyPolicy(directory)).toEqual(
      expect.arrayContaining([
        'xlsx must not be declared in root dependencies.',
        'xlsx must stay root-only; found it in apps/portal/package.json dependencies.',
      ]),
    );
  });

  it('permits the legacy importer and rejects bare or subpath imports elsewhere', () => {
    const directory = temporaryDirectory();
    const moduleName = ['xl', 'sx'].join('');
    mkdirSync(path.join(directory, 'scripts'), { recursive: true });
    mkdirSync(path.join(directory, 'apps', 'portal'), { recursive: true });
    writeFileSync(
      path.join(directory, 'scripts', 'import-running-jobs-legacy.ts'),
      `import * as XLSX from '${moduleName}';`,
    );

    expect(findExecutableXlsxImports(directory)).toEqual([
      'scripts/import-running-jobs-legacy.ts',
    ]);
    expect(validateXlsxImportPolicy(directory)).toEqual([]);

    writeFileSync(
      path.join(directory, 'apps', 'portal', 'unexpected.ts'),
      `import {\n  read,\n} from '${moduleName}';`,
    );
    writeFileSync(
      path.join(directory, 'apps', 'portal', 'unexpected-subpath-static.ts'),
      `import { read } from '${moduleName}/xlsx.mjs';`,
    );
    writeFileSync(
      path.join(directory, 'apps', 'portal', 'unexpected-subpath-dynamic.ts'),
      `export const loader = () => import('${moduleName}/dist/cpexcel.full.mjs');`,
    );
    writeFileSync(
      path.join(directory, 'apps', 'portal', 'unexpected-subpath-require.cjs'),
      `module.exports = require('${moduleName}/xlsx.js');`,
    );

    expect(validateXlsxImportPolicy(directory)).toEqual([
      'xlsx executable imports must be exactly scripts/import-running-jobs-legacy.ts; found apps/portal/unexpected-subpath-dynamic.ts, apps/portal/unexpected-subpath-require.cjs, apps/portal/unexpected-subpath-static.ts, apps/portal/unexpected.ts, scripts/import-running-jobs-legacy.ts.',
    ]);
  });
});
