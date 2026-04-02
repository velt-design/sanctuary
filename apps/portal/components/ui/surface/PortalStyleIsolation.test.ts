import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd(), 'apps/portal');
const PROJECT_CSS_IMPORT = ['@/app/staff/projects/', 'projects.module.css'].join('');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

describe('portal shared styles', () => {
  it('keeps projects.module.css isolated to project-specific surfaces', () => {
    const allowedPrefixes = [
      'apps/portal/app/staff/projects/',
      'apps/portal/components/projects/',
    ];

    const offenders = walk(ROOT)
      .filter((filePath) => {
        const normalized = normalizePath(path.relative(process.cwd(), filePath));
        if (normalized.endsWith('PortalStyleIsolation.test.ts')) return false;
        const source = fs.readFileSync(filePath, 'utf8');
        if (!source.includes(PROJECT_CSS_IMPORT)) return false;
        return !allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
      })
      .map((filePath) => normalizePath(path.relative(process.cwd(), filePath)));

    expect(
      offenders,
      offenders.length
        ? `Non-project portal files still depend on projects.module.css:\n${offenders.join('\n')}`
        : undefined,
    ).toEqual([]);
  });
});
