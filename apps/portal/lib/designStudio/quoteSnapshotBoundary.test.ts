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
  it('keeps the public root component slot independent of the installed Studio frame and entry lifetime',()=>{
    const files=runtimeDependencies('apps/portal/components/designStudio/StudioDocumentSlot.tsx');
    expect(files.filter(file=>/\/(?:StudioDocument|studioOpeningTransport|studioSessionLifecycle|studioLifecycle|studioDocumentNavigation|StudioNativeLink)\.[jt]sx?$/.test(file))).toEqual([]);
    expect(runtimeDependencies('apps/portal/components/layout/PortalShell.tsx')).not.toContain('apps/portal/components/designStudio/StudioNavigationCapture.tsx');
    expect(fs.readFileSync('apps/portal/app/layout.tsx','utf8')).not.toContain('StudioNavigationCapture');
  });
  it('keeps retained journal readers outside common native navigation lifetime imports',()=>{
    for(const entry of ['apps/portal/lib/designStudio/studioDocumentNavigation.ts','apps/portal/components/designStudio/StudioDocument.tsx']){
      const files=runtimeDependencies(entry);
      expect(files.filter(file=>/\/(?:workingCopy|saveTransport|createTransport|priceSaveTransport|quoteReviewSaveTransport|quoteDraftSaveTransport|studioLifecycle)\.ts$/.test(file))).toEqual([]);
    }
  });
  it('keeps the page-local Studio editor and canvas loaders outside the shared root admission frame',()=>{
    const files=runtimeDependencies('apps/portal/components/designStudio/StudioDocument.tsx');
    expect(files.filter(file=>/\/(StudioDocumentPage|StudioAuthoringLoader|studioLeafLoading|StudioWebsiteEditor|StudioHouseCanvas)\./.test(file))).toEqual([]);
    expect(runtimeDependencies('apps/portal/components/designStudio/StudioDocumentPage.tsx')).toContain('apps/portal/components/designStudio/studioLeafLoading.ts');
  });
  it('keeps quote preparation and Studio contracts outside the globally mounted cache handlers', () => {
    const files = runtimeDependencies('apps/portal/components/sync/LocalFirstPortalMutations.tsx');
    expect(files).toContain('apps/portal/lib/localFirst/portalEntities.ts');
    expect(files).toContain('apps/portal/lib/localFirst/portalEntityValues.ts');
    expect(files.filter(file => file.startsWith('apps/portal/lib/designStudio/')
      || file === 'apps/portal/lib/localFirst/quotePreparation.ts'
      || file === 'apps/portal/lib/quotes/mapping.ts')).toEqual([]);
  });

  it('retains strict handoff validation in the dedicated quote preparation owner', () => {
    const files = runtimeDependencies('apps/portal/lib/localFirst/studioQuotePreparation.ts');
    expect(files).toContain('apps/portal/lib/quotes/mapping.ts');
    expect(files).toContain('apps/portal/lib/designStudio/authoringView.ts');
    expect(files).toContain('apps/portal/lib/designStudio/spatialValidation.ts');
  });

  it('keeps Calculator save previews outside the strict Studio validation graph', () => {
    const files = runtimeDependencies('apps/portal/app/staff/calculator/calculatorEstimateSave.ts');
    expect(files).toContain('apps/portal/lib/quotes/calculatorMapping.ts');
    expect(files.filter(file => file.startsWith('apps/portal/lib/designStudio/')
      || file === 'apps/portal/lib/quotes/mapping.ts')).toEqual([]);
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
