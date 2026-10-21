import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = process.cwd();
const portalDirectory = path.join(root, 'apps/portal');
const portalPackage = JSON.parse(fs.readFileSync(path.join(portalDirectory, 'package.json'), 'utf8'));
const config = ts.readConfigFile(path.join(portalDirectory, 'tsconfig.json'), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, portalDirectory);

function unresolvedSharedWorkspaceImports(dependencies: Record<string, string>) {
  const pending = ['sharedEmails.ts', 'sharedEmailPreviewSender.ts'].map(file => path.join(portalDirectory, 'lib', file));
  const visited = new Set<string>();
  const unresolved = new Set<string>();
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const entry of ts.preProcessFile(fs.readFileSync(file, 'utf8'), true).importedFiles) {
      const specifier = entry.fileName;
      const workspaceName = specifier.startsWith('@sp/') ? specifier.split('/').slice(0, 2).join('/') : null;
      // Root npm ci links every workspace. A scoped deployment only has declared dependencies.
      if (workspaceName && !dependencies[workspaceName]) {
        unresolved.add(specifier);
        continue;
      }
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (workspaceName && !resolved) unresolved.add(specifier);
      if (!workspaceName && resolved && !resolved.isExternalLibraryImport && /\.[cm]?tsx?$/.test(resolved.resolvedFileName)) {
        pending.push(resolved.resolvedFileName);
      }
    }
  }
  return [...unresolved].sort();
}

it('resolves shared email types with only Portal-declared workspace dependencies', () => {
  expect(unresolvedSharedWorkspaceImports(portalPackage.dependencies)).toEqual([]);
});

it('detects the hidden configurator dependency when a full-workspace install would mask it', () => {
  const dependencies = { ...portalPackage.dependencies };
  delete dependencies['@sp/configurator'];
  expect(unresolvedSharedWorkspaceImports(dependencies)).toContain('@sp/configurator/website');
});
