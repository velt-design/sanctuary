import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC_ROOTS = ['AGENTS.md', 'README.md', 'docs'];
const DENSE_LINE_THRESHOLD = 120;
const NAVIGATION_CUES = [
  /^## Index$/m,
  /^## Read First$/m,
  /^## When To Use$/m,
  /^## How To Use/m,
  /^## Path Ownership Map$/m,
  /^## Canonical Reference Docs$/m,
];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function walkFiles(relPath) {
  const absPath = path.join(ROOT, relPath);
  const stat = fs.statSync(absPath);
  if (stat.isFile()) return [toPosix(relPath)];

  const results = [];
  for (const entry of fs.readdirSync(absPath, { withFileTypes: true })) {
    const child = path.join(relPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(child));
    } else if (entry.isFile()) {
      results.push(toPosix(child));
    }
  }
  return results;
}

function docFiles() {
  const files = [];
  for (const root of DOC_ROOTS) {
    if (!fs.existsSync(path.join(ROOT, root))) continue;
    for (const file of walkFiles(root)) {
      if (file.endsWith('.md')) files.push(file);
    }
  }
  return files;
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function navigationCue(text) {
  return NAVIGATION_CUES.some((pattern) => pattern.test(text));
}

function main() {
  const rows = docFiles()
    .map((file) => {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return {
        file,
        lines: lineCount(text),
        hasNavigationCue: navigationCue(text),
      };
    })
    .filter((row) => row.lines > DENSE_LINE_THRESHOLD)
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

  console.log('docs-navigation: advisory report');
  console.log(`Dense threshold: > ${DENSE_LINE_THRESHOLD} lines`);

  if (rows.length === 0) {
    console.log('No dense docs found.');
    return;
  }

  console.log('');
  console.log('| File | Lines | Navigation cue |');
  console.log('| --- | ---: | --- |');
  for (const row of rows) {
    console.log(`| ${row.file} | ${row.lines} | ${row.hasNavigationCue ? 'found' : 'missing'} |`);
  }

  const missingCount = rows.filter((row) => !row.hasNavigationCue).length;
  console.log('');
  console.log(`${missingCount} dense doc(s) are missing a simple navigation cue.`);
  console.log('This report is advisory only; add routing/index sections when a dense doc becomes hard to scan.');
}

main();
