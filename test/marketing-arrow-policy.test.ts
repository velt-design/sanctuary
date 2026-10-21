import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const arrow = /[\u2190-\u21ff\u27f0-\u27ff\u2900-\u297f\u2b00-\u2b11\u2b45-\u2b4c\u2794-\u27bf\u{1f500}-\u{1f503}\u{1f519}-\u{1f51d}\u{1f800}-\u{1f8ff}]/u;
function hasArrow(value: string) {
  const decoded = value.replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_, hex, decimal) => String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10)))
    .replace(/\\([\da-f]{4,6})\s?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
  return arrow.test(decoded) || /&(?:[rludhnsew]+arr|[a-z]*arrow[a-z]*);/i.test(decoded);
}
function sourceLiterals(source: string, file: string) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const values: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) values.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(tree); return values;
}
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.next', '.generated', '__snapshots__'].includes(entry.name) || /\.(test|spec)\.|\.d\.ts$/.test(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() && ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.svg', '.json'].includes(extname(path)) ? [path] : [];
  });
}

describe('marketing arrow rendering policy', () => {
  it('detects font arrows in JSX, entities, escaped strings and generated CSS, while ignoring comments and SVG geometry', () => {
    for (const value of ['↗', '⬅️', '&rarr;', '&#8594;', '&#x2192;', '\\2192']) expect(hasArrow(value)).toBe(true);
    expect(sourceLiterals("// → is not rendered\nconst Icon=()=> <svg><path d='M4 12h16'/></svg>;", 'fixture.tsx').some(hasArrow)).toBe(false);
    expect(sourceLiterals("const label='\\u2192';", 'fixture.ts').some(hasArrow)).toBe(true);
  });

  it('keeps all marketing source and public text assets free of renderable arrow glyphs', () => {
    const root = resolve('apps/marketing');
    const offenders: string[] = [];
    for (const file of files(root)) {
      const source = readFileSync(file, 'utf8');
      const values = /\.[jt]sx?$/.test(file) ? sourceLiterals(source, file) : [source.replace(/\/\*[\s\S]*?\*\//g, '')];
      if (values.some(hasArrow)) offenders.push(relative(root, file));
    }
    expect(offenders, 'Use a decorative SVG or CSS mask, preserving the containing control’s label and action.').toEqual([]);
  });
});
