import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as Three from 'three';
import { expect, it } from 'vitest';
import { sceneCatalogue } from './sceneCatalogue';

const root = process.cwd();
const roots = [
  'packages/geometry-viewer/src/react', 'packages/configurator/src/react',
  'apps/portal/components/drawings', 'apps/portal/components/designStudio',
  'apps/marketing/components/configurator-prototype',
];
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(path.join(dir, entry.name)) :
      /\.[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path.join(dir, entry.name)] : []);
}

it('keeps every current scene intrinsic available without a full namespace fallback', () => {
  const missing: string[] = [];
  for (const file of roots.flatMap((dir) => files(path.join(root, dir)))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        const constructor = tag[0].toUpperCase() + tag.slice(1);
        // SVG/HTML path and source are not Three scene objects.
        if (/^[a-z]/.test(tag) && !['path', 'source', 'primitive'].includes(tag)
          && constructor in Three && !(constructor in sceneCatalogue)) missing.push(`${file}:${tag}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(missing).toEqual([]);
});

it('uses public package APIs and no remaining full Canvas registration consumer', () => {
  const violations: string[] = [];
  for (const file of roots.flatMap((dir) => files(path.join(root, dir)))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (specifier.startsWith('@react-three/fiber/')) violations.push(`${file}: private Fiber import`);
      const clause = statement.importClause;
      if (specifier !== '@react-three/fiber' || clause?.isTypeOnly) continue;
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) violations.push(`${file}: namespace Fiber import`);
      if (bindings && ts.isNamedImports(bindings) && bindings.elements.some(
        (element) => !element.isTypeOnly && (element.propertyName ?? element.name).text === 'Canvas',
      )) violations.push(`${file}: Canvas import`);
    }
  }
  expect(violations).toEqual([]);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'packages/geometry-viewer/package.json'), 'utf8'));
  expect(pkg.exports['./react/canvas']).toBe('./src/react/canvas/index.ts');
  expect(pkg.dependencies['its-fine']).toBe('2.0.0');
  expect(pkg.dependencies['react-use-measure']).toBe('2.1.7');
});
