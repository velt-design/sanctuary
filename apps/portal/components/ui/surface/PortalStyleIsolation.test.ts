import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const ROOT = path.resolve(process.cwd(), 'apps/portal');
const PROJECT_CSS_IMPORT = ['@/app/staff/projects/', 'projects.module.css'].join('');
// These are generated/dependency directories excluded by the repository .gitignore.
const GENERATED_DIRECTORIES = new Set(['.next', 'node_modules', 'dist', 'out']);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (GENERATED_DIRECTORIES.has(entry.name)) continue;
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
  it('covers nested Portal source without traversing ignored build and dependency output', () => {
    const root = path.join(ROOT, '__source_discovery_fixture__');
    const entry = (name: string, directory: boolean) => ({
      name,
      isDirectory: () => directory,
      isFile: () => !directory,
    } as fs.Dirent);
    const tree = new Map<string, fs.Dirent[]>([
      [root, ['.next', 'node_modules', 'dist', 'out', 'components', 'lib'].map(name => entry(name, true))],
      [path.join(root, 'components'), [entry('nested', true), entry('style.css', false)]],
      [path.join(root, 'components', 'nested'), [entry('Page.tsx', false)]],
      [path.join(root, 'lib'), [entry('source.ts', false), entry('.next-like.ts', false)]],
    ]);
    const readdir = vi.spyOn(fs, 'readdirSync').mockImplementation(((dir: fs.PathLike) => {
      const entries = tree.get(String(dir));
      if (!entries) throw new Error('Discovery entered generated output.');
      return entries;
    }) as unknown as typeof fs.readdirSync);
    try {
      expect(walk(root)).toEqual([
        path.join(root, 'components', 'nested', 'Page.tsx'),
        path.join(root, 'lib', 'source.ts'),
        path.join(root, 'lib', '.next-like.ts'),
      ]);
      expect(readdir.mock.calls.map(([dir]) => String(dir))).toEqual([
        root, path.join(root, 'components'), path.join(root, 'components', 'nested'), path.join(root, 'lib'),
      ]);
    } finally {
      readdir.mockRestore();
    }
  });
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
