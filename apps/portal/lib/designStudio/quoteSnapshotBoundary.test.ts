// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/** Follow runtime imports through real package/alias resolution. Type-only
 * canonical models are allowed; their implementation must stay out of Portal's
 * globally mounted local-first quote validation graph. */
function runtimeDependencies(entry: string): string[] {
  const configFile = path.resolve('apps/portal/tsconfig.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFile));
  const pending = [path.resolve(entry)], visited = new Set<string>();
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      let specifier: ts.Expression | undefined;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) continue;
        if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          && clause.namedBindings.elements.every(item => item.isTypeOnly)) continue;
        specifier = node.moduleSpecifier;
      } else if (ts.isExportDeclaration(node)) {
        if (node.isTypeOnly) continue;
        if (node.exportClause && ts.isNamedExports(node.exportClause)
          && node.exportClause.elements.every(item => item.isTypeOnly)) continue;
        specifier = node.moduleSpecifier;
      }
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      const resolved = ts.resolveModuleName(specifier.text, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved && !resolved.includes('/node_modules/') && !resolved.includes('\\node_modules\\')
        && !resolved.endsWith('.d.ts')) pending.push(path.resolve(resolved));
    }
  }
  return [...visited].map(file => path.relative(process.cwd(), file).split(path.sep).join('/'));
}

describe('shared Portal quote validation boundary', () => {
  it('keeps quote preparation and Studio contracts outside the globally mounted cache handlers', () => {
    const files = runtimeDependencies('apps/portal/components/sync/LocalFirstPortalMutations.tsx');
    expect(files).toContain('apps/portal/lib/localFirst/portalEntities.ts');
    expect(files).toContain('apps/portal/lib/localFirst/portalEntityValues.ts');
    expect(files.filter(file => file.startsWith('apps/portal/lib/designStudio/')
      || file === 'apps/portal/lib/localFirst/quotePreparation.ts'
      || file === 'apps/portal/lib/quotes/mapping.ts')).toEqual([]);
  });

  it('retains strict handoff validation in the dedicated quote preparation owner', () => {
    const files = runtimeDependencies('apps/portal/lib/localFirst/quotePreparation.ts');
    expect(files).toContain('apps/portal/lib/quotes/mapping.ts');
    expect(files).toContain('apps/portal/lib/designStudio/authoringView.ts');
    expect(files).toContain('apps/portal/lib/designStudio/spatialValidation.ts');
  });

  it('resolves the strict Studio contract without importing geometry or renderer implementations', () => {
    const files = runtimeDependencies('apps/portal/lib/quotes/mapping.ts');
    expect(files).toContain('apps/portal/lib/designStudio/authoringView.ts');
    expect(files).toContain('apps/portal/lib/designStudio/websiteDesignContract.ts');
    expect(files).toContain('apps/portal/lib/designStudio/studioAttachmentContract.ts');
    expect(files).toContain('packages/configurator/src/website/parser.ts');
    expect(files.filter(file => file.startsWith('packages/geometry/')
      || file.startsWith('packages/configurator/src/geometry/')
      || file.startsWith('packages/configurator/src/react/')
      || file.startsWith('apps/portal/lib/drawings/'))).toEqual([]);
  });

  it('exposes the structural website entry through the package contract', () => {
    const pkg = JSON.parse(fs.readFileSync('packages/configurator/package.json', 'utf8'));
    expect(pkg.exports['./website/contract']).toBe('./src/website/contract/index.ts');
  });
});
