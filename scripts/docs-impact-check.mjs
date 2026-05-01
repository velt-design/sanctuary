import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHANGE_ROUTING_DOC = 'docs/change-routing.md';
const DOC_PATHS = new Set(['AGENTS.md', 'README.md']);
const STRICT = process.env.DOCS_IMPACT_STRICT === '1';

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function markdownTableRows(text, heading, nextHeadingPattern = /^## /m) {
  const headingIndex = text.indexOf(`## ${heading}`);
  if (headingIndex === -1) return [];

  const afterHeading = text.slice(headingIndex + heading.length + 3);
  const nextHeading = afterHeading.search(nextHeadingPattern);
  const section = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|\s*-+/.test(line))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()));
}

function extractBacktickValues(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function globToRegExp(pattern) {
  let source = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i += 1;
      } else {
        source += '[^/]*';
      }
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function isDocPath(filePath) {
  return filePath === 'AGENTS.md' || filePath === 'README.md' || filePath.startsWith('docs/');
}

function isOwnerDoc(value) {
  return DOC_PATHS.has(value) || value.startsWith('docs/') || value.endsWith('/README.md');
}

function changedFiles() {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (process.env.CI === 'true' && baseRef) {
    const fromBase = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', `origin/${baseRef}...HEAD`]);
    if (fromBase.length > 0) return [...new Set(fromBase.map(normalizePath))];
  }

  const tracked = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']);
  const untracked = runGit(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked].map(normalizePath))];
}

function ownershipRows() {
  if (!exists(CHANGE_ROUTING_DOC)) {
    console.error(`docs-impact: missing ${CHANGE_ROUTING_DOC}`);
    process.exit(STRICT ? 1 : 0);
  }

  const text = readText(CHANGE_ROUTING_DOC);
  return markdownTableRows(text, 'Path Ownership Map', /^## Common Task Cards/m)
    .filter((row) => row.length >= 3 && row[0] !== 'Paths')
    .flatMap(([pathsCell, readFirstCell]) => {
      const ownerDocs = extractBacktickValues(readFirstCell).filter(isOwnerDoc);
      return extractBacktickValues(pathsCell).map((pattern) => ({
        pattern,
        matcher: globToRegExp(pattern),
        ownerDocs,
      }));
    });
}

function main() {
  const files = changedFiles();
  const docsChanged = new Set(files.filter(isDocPath));
  const behaviorFiles = files.filter((file) => !isDocPath(file));

  console.log('docs-impact: advisory check');

  if (files.length === 0) {
    console.log('docs-impact: no changed files detected');
    return;
  }

  if (behaviorFiles.length === 0) {
    console.log('docs-impact: docs-only changes detected; no behavior impact check needed');
    return;
  }

  const rows = ownershipRows();
  const findings = [];
  for (const file of behaviorFiles) {
    const matches = rows.filter((row) => row.matcher.test(file));
    for (const match of matches) {
      const ownerDocsChanged = match.ownerDocs.some((doc) => docsChanged.has(doc));
      if (!ownerDocsChanged) {
        findings.push({
          file,
          pattern: match.pattern,
          ownerDocs: match.ownerDocs,
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log('docs-impact: changed behavior files either have matching owner docs updated or do not map to a docs owner row');
    return;
  }

  console.log('docs-impact: advisory findings');
  console.log('The following changed files map to owner docs, but no matching owner doc changed:');
  for (const finding of findings) {
    console.log(`- ${finding.file}`);
    console.log(`  matched: ${finding.pattern}`);
    console.log(`  suggested docs: ${finding.ownerDocs.length > 0 ? finding.ownerDocs.join(', ') : 'none listed'}`);
  }
  console.log('Update the relevant owner doc if behavior, data flow, tests, or known risks changed.');

  if (STRICT) {
    process.exit(1);
  }
}

main();
